import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';

export const PERMISSION_DELEGATION_SCOPES = ['TEAM_MANAGER', 'APPROVAL', 'TEAM_HR', 'TEAM_CALENDAR'] as const;
export const PERMISSION_DELEGATION_STATUSES = ['ACTIVE', 'CANCELLED', 'EXPIRED'] as const;

export type PermissionDelegationScope = (typeof PERMISSION_DELEGATION_SCOPES)[number];
export type PermissionDelegationStatus = (typeof PERMISSION_DELEGATION_STATUSES)[number];

export type PermissionDelegation = {
  id: string;
  delegatorUserId: string;
  delegatorName: string;
  delegateeUserId: string;
  delegateeName: string;
  teamId: string;
  teamName: string;
  scope: PermissionDelegationScope;
  startsAt: string;
  endsAt: string;
  reason: string;
  status: PermissionDelegationStatus;
  createdBy: string | null;
  createdAt: string;
  cancelledBy: string | null;
  cancelledAt: string | null;
};

type DelegationRow = RowDataPacket & {
  id: string;
  delegator_user_id: string;
  delegator_name: string;
  delegatee_user_id: string;
  delegatee_name: string;
  team_id: string;
  team_name: string;
  permission_scope: PermissionDelegationScope;
  starts_at: Date | string;
  ends_at: Date | string;
  reason: string | null;
  status: PermissionDelegationStatus;
  created_by: string | null;
  created_at: Date | string;
  cancelled_by: string | null;
  cancelled_at: Date | string | null;
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

function mapDelegation(row: DelegationRow): PermissionDelegation {
  return {
    id: row.id,
    delegatorUserId: row.delegator_user_id,
    delegatorName: row.delegator_name,
    delegateeUserId: row.delegatee_user_id,
    delegateeName: row.delegatee_name,
    teamId: row.team_id,
    teamName: row.team_name,
    scope: row.permission_scope,
    startsAt: toDateOnly(row.starts_at),
    endsAt: toDateOnly(row.ends_at),
    reason: row.reason ?? '',
    status: row.status,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    cancelledBy: row.cancelled_by,
    cancelledAt: toIso(row.cancelled_at),
  };
}

export async function ensurePermissionDelegationsTable() {
  if (!schemaReady) {
    schemaReady = getMysqlPool().execute(`
      CREATE TABLE IF NOT EXISTS permission_delegations (
        id CHAR(36) NOT NULL,
        delegator_user_id CHAR(36) NOT NULL,
        delegatee_user_id CHAR(36) NOT NULL,
        team_id CHAR(36) NOT NULL,
        permission_scope ENUM('TEAM_MANAGER', 'APPROVAL', 'TEAM_HR', 'TEAM_CALENDAR') NOT NULL DEFAULT 'TEAM_MANAGER',
        starts_at DATE NOT NULL,
        ends_at DATE NOT NULL,
        reason VARCHAR(500) NULL,
        status ENUM('ACTIVE', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
        created_by CHAR(36) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        cancelled_by CHAR(36) NULL,
        cancelled_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        INDEX idx_permission_delegations_delegatee (delegatee_user_id, status, starts_at, ends_at),
        INDEX idx_permission_delegations_team (team_id, status, starts_at, ends_at),
        CONSTRAINT fk_permission_delegations_delegator
          FOREIGN KEY (delegator_user_id) REFERENCES users (id)
          ON DELETE CASCADE,
        CONSTRAINT fk_permission_delegations_delegatee
          FOREIGN KEY (delegatee_user_id) REFERENCES users (id)
          ON DELETE CASCADE,
        CONSTRAINT fk_permission_delegations_team
          FOREIGN KEY (team_id) REFERENCES teams (id)
          ON DELETE CASCADE,
        CONSTRAINT fk_permission_delegations_created_by
          FOREIGN KEY (created_by) REFERENCES users (id)
          ON DELETE SET NULL,
        CONSTRAINT fk_permission_delegations_cancelled_by
          FOREIGN KEY (cancelled_by) REFERENCES users (id)
          ON DELETE SET NULL
      ) ENGINE=InnoDB
    `).then(() => undefined);
  }
  return schemaReady;
}

async function expireDelegations() {
  await ensurePermissionDelegationsTable();
  await getMysqlPool().execute(`
    UPDATE permission_delegations
    SET status = 'EXPIRED'
    WHERE status = 'ACTIVE' AND ends_at < CURDATE()
  `);
}

function baseSelectSql() {
  return `
    SELECT pd.id, pd.delegator_user_id, delegator.name AS delegator_name,
      pd.delegatee_user_id, delegatee.name AS delegatee_name,
      pd.team_id, t.name AS team_name, pd.permission_scope, pd.starts_at, pd.ends_at,
      pd.reason, pd.status, pd.created_by, pd.created_at, pd.cancelled_by, pd.cancelled_at
    FROM permission_delegations pd
    JOIN users delegator ON delegator.id = pd.delegator_user_id
    JOIN users delegatee ON delegatee.id = pd.delegatee_user_id
    JOIN teams t ON t.id = pd.team_id
  `;
}

export async function listPermissionDelegations() {
  await expireDelegations();
  const [rows] = await getMysqlPool().query<DelegationRow[]>(`
    ${baseSelectSql()}
    ORDER BY FIELD(pd.status, 'ACTIVE', 'EXPIRED', 'CANCELLED'), pd.starts_at DESC, pd.created_at DESC
    LIMIT 100
  `);
  return rows.map(mapDelegation);
}

export async function getActiveDelegatedTeamIds(userId: string, scopes: PermissionDelegationScope[] = ['TEAM_MANAGER']) {
  await expireDelegations();
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `
      SELECT DISTINCT team_id AS id
      FROM permission_delegations
      WHERE delegatee_user_id = ?
        AND status = 'ACTIVE'
        AND permission_scope IN (?)
        AND starts_at <= CURDATE()
        AND ends_at >= CURDATE()
    `,
    [userId, scopes],
  );
  return rows.map((row) => String(row.id)).filter(Boolean);
}

export async function createPermissionDelegation(input: {
  delegatorUserId: string;
  delegateeUserId: string;
  teamId: string;
  scope: PermissionDelegationScope;
  startsAt: string;
  endsAt: string;
  reason?: string;
  createdBy: string;
}) {
  await ensurePermissionDelegationsTable();
  const id = randomUUID();
  await getMysqlPool().execute(
    `
      INSERT INTO permission_delegations
        (id, delegator_user_id, delegatee_user_id, team_id, permission_scope, starts_at, ends_at, reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.delegatorUserId,
      input.delegateeUserId,
      input.teamId,
      input.scope,
      input.startsAt,
      input.endsAt,
      input.reason?.trim() || null,
      input.createdBy,
    ],
  );
  return getPermissionDelegationById(id);
}

export async function cancelPermissionDelegation(input: { id: string; cancelledBy: string }) {
  await ensurePermissionDelegationsTable();
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `
      UPDATE permission_delegations
      SET status = 'CANCELLED',
        cancelled_by = ?,
        cancelled_at = CURRENT_TIMESTAMP(3)
      WHERE id = ? AND status = 'ACTIVE'
    `,
    [input.cancelledBy, input.id],
  );
  return result.affectedRows > 0;
}

export async function getPermissionDelegationById(id: string) {
  await expireDelegations();
  const [rows] = await getMysqlPool().query<DelegationRow[]>(
    `
      ${baseSelectSql()}
      WHERE pd.id = ?
      LIMIT 1
    `,
    [id],
  );
  return rows[0] ? mapDelegation(rows[0]) : null;
}
