import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getTeamScope, isGlobalAdmin } from '../auth/authorization';
import type { FamilyEventDashboardSummary, FamilyEventRequest, FamilyEventStatus, FamilyEventType } from '../types/familyEvent';
import type { AuthUser } from './users';
import { getMysqlPool } from './mysql';
import { createSecurityAuditLog } from './securityAudit';

type FamilyEventRow = RowDataPacket & {
  id: string;
  requester_id: string;
  requester_name: string;
  requester_email: string;
  team_id: string | null;
  team_name: string | null;
  event_type: FamilyEventType;
  relation_name: string | null;
  event_date: Date | string;
  location: string | null;
  note: string | null;
  wreath_required: 0 | 1 | boolean;
  status: FamilyEventStatus;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type CountRow = RowDataPacket & {
  count: number;
};

let schemaReady: Promise<void> | null = null;

function toIso(value: Date | string | null) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toDateOnly(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapFamilyEvent(row: FamilyEventRow): FamilyEventRequest {
  return {
    id: row.id,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    teamId: row.team_id,
    teamName: row.team_name,
    eventType: row.event_type,
    relation: row.relation_name ?? '',
    eventDate: toDateOnly(row.event_date),
    location: row.location ?? '',
    note: row.note ?? '',
    wreathRequired: Boolean(row.wreath_required),
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewerName: row.reviewer_name,
    reviewedAt: toIso(row.reviewed_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

async function ensureFamilyEventsTable() {
  if (!schemaReady) {
    schemaReady = getMysqlPool().execute(`
      CREATE TABLE IF NOT EXISTS family_event_requests (
        id CHAR(36) NOT NULL,
        requester_id CHAR(36) NOT NULL,
        team_id CHAR(36) NULL,
        event_type ENUM('MARRIAGE', 'BIRTH', 'FUNERAL', 'FIRST_BIRTHDAY', 'HOSPITAL', 'OTHER') NOT NULL,
        relation_name VARCHAR(80) NULL,
        event_date DATE NOT NULL,
        location VARCHAR(255) NULL,
        note TEXT NULL,
        support_amount INT NOT NULL DEFAULT 0,
        wreath_required BOOLEAN NOT NULL DEFAULT FALSE,
        status ENUM('PENDING', 'CONFIRMED', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
        reviewed_by CHAR(36) NULL,
        reviewed_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_family_event_requests_requester (requester_id, created_at),
        INDEX idx_family_event_requests_team_status (team_id, status, event_date),
        INDEX idx_family_event_requests_status_date (status, event_date),
        CONSTRAINT fk_family_event_requests_requester
          FOREIGN KEY (requester_id) REFERENCES users (id)
          ON DELETE CASCADE,
        CONSTRAINT fk_family_event_requests_team
          FOREIGN KEY (team_id) REFERENCES teams (id)
          ON DELETE SET NULL,
        CONSTRAINT fk_family_event_requests_reviewer
          FOREIGN KEY (reviewed_by) REFERENCES users (id)
          ON DELETE SET NULL
      ) ENGINE=InnoDB
    `).then(() => undefined);
  }
  return schemaReady;
}

function baseSelectSql() {
  return `
      SELECT fer.id, fer.requester_id, requester.name AS requester_name, requester.email AS requester_email,
        fer.team_id, t.name AS team_name, fer.event_type, fer.relation_name, fer.event_date,
      fer.location, fer.note, fer.wreath_required, fer.status,
      fer.reviewed_by, reviewer.name AS reviewer_name, fer.reviewed_at, fer.created_at, fer.updated_at
    FROM family_event_requests fer
    JOIN users requester ON requester.id = fer.requester_id
    LEFT JOIN teams t ON t.id = fer.team_id
    LEFT JOIN users reviewer ON reviewer.id = fer.reviewed_by
  `;
}

export async function listFamilyEventRequests(input: { user: AuthUser; status?: FamilyEventStatus | 'ALL' }) {
  await ensureFamilyEventsTable();
  const where: string[] = [];
  const params: unknown[] = [];

  if (input.status && input.status !== 'ALL') {
    where.push('fer.status = ?');
    params.push(input.status);
  }

  const [rows] = await getMysqlPool().query<FamilyEventRow[]>(
    `
      ${baseSelectSql()}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY FIELD(fer.status, 'PENDING', 'CONFIRMED', 'COMPLETED', 'REJECTED'), fer.event_date DESC, fer.created_at DESC
    `,
    params,
  );
  return rows.map(mapFamilyEvent);
}

async function isHrStaff(user: Pick<AuthUser, 'id' | 'role'>) {
  if (isGlobalAdmin(user)) return true;
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `
      SELECT 1
      FROM employee_profiles ep
      LEFT JOIN teams t ON t.id = ep.team_id
      WHERE ep.user_id = ?
        AND (
          t.name LIKE '%인사%'
          OR UPPER(t.name) IN ('HR', 'HUMAN RESOURCES')
        )
      LIMIT 1
    `,
    [user.id],
  );
  return Boolean(rows[0]);
}

export async function getFamilyEventReviewScope(user: AuthUser) {
  if (isGlobalAdmin(user)) return { canReview: true, scope: 'ALL' as const, teamIds: [] as string[] };
  if (await isHrStaff(user)) return { canReview: true, scope: 'ALL' as const, teamIds: [] as string[] };
  const teamScope = await getTeamScope(user);
  if (teamScope.scope === 'TEAM') return { canReview: true, scope: 'TEAM' as const, teamIds: teamScope.teamIds };
  return { canReview: false, scope: 'NONE' as const, teamIds: [] as string[] };
}

export async function createFamilyEventRequest(input: {
  requester: AuthUser;
  eventType: FamilyEventType;
  relation: string;
  eventDate: string;
  location?: string;
  note?: string;
  wreathRequired?: boolean;
}) {
  await ensureFamilyEventsTable();
  const pool = getMysqlPool();
  const [profileRows] = await pool.query<RowDataPacket[]>('SELECT team_id FROM employee_profiles WHERE user_id = ? LIMIT 1', [input.requester.id]);
  const teamId = profileRows[0]?.team_id ? String(profileRows[0].team_id) : null;
  const id = randomUUID();

  await pool.execute(
    `
      INSERT INTO family_event_requests
        (id, requester_id, team_id, event_type, relation_name, event_date, location, note, support_amount, wreath_required)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.requester.id,
      teamId,
      input.eventType,
      input.relation.trim() || null,
      input.eventDate,
      input.location?.trim() || null,
      input.note?.trim() || null,
      0,
      Boolean(input.wreathRequired),
    ],
  );

  await createSecurityAuditLog({
    actorId: input.requester.id,
    targetUserId: input.requester.id,
    action: 'SETTINGS_UPDATED',
    details: { area: 'family_event', action: 'create', id, eventType: input.eventType },
  });

  return id;
}

export async function updateFamilyEventStatus(input: { user: AuthUser; id: string; status: Exclude<FamilyEventStatus, 'PENDING'> }) {
  await ensureFamilyEventsTable();
  const scope = await getFamilyEventReviewScope(input.user);
  if (!scope.canReview) throw new Error('경조사 처리 권한이 없습니다.');

  const params: Array<string | string[]> = [input.status, input.user.id, input.id];
  const scopeSql = scope.scope === 'TEAM' ? 'AND team_id IN (?)' : '';
  if (scope.scope === 'TEAM') params.push(scope.teamIds);
  const [result] = await getMysqlPool().query<ResultSetHeader>(
    `
      UPDATE family_event_requests
      SET status = ?,
        reviewed_by = ?,
        reviewed_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?
      ${scopeSql}
    `,
    params,
  );

  if (result.affectedRows > 0) {
    await createSecurityAuditLog({
      actorId: input.user.id,
      targetUserId: null,
      action: 'SETTINGS_UPDATED',
      details: { area: 'family_event', action: 'status', id: input.id, status: input.status },
    });
  }
  return result.affectedRows > 0;
}

export async function getFamilyEventDashboardSummary(user: AuthUser): Promise<FamilyEventDashboardSummary> {
  await ensureFamilyEventsTable();
  void user;
  const [upcomingRows] = await getMysqlPool().query<CountRow[]>(
    `SELECT COUNT(*) AS count FROM family_event_requests fer WHERE fer.event_date >= CURDATE()`,
  );
  const [recentRows] = await getMysqlPool().query<FamilyEventRow[]>(
    `
      ${baseSelectSql()}
      ORDER BY fer.created_at DESC
      LIMIT 3
    `,
  );
  return {
    upcomingCount: Number(upcomingRows[0]?.count ?? 0),
    recentItems: recentRows.map(mapFamilyEvent).map((item) => ({
      id: item.id,
      eventType: item.eventType,
      relation: item.relation,
      eventDate: item.eventDate,
    })),
  };
}
