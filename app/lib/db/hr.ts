import { randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';
import { createSecurityAuditLog } from './securityAudit';
import type { AuthUser } from './users';
import { buildLeaveNotionPayload, createNotionCalendarPage } from '../integrations/notionCalendar';
import type {
  ApprovalItem,
  ApprovalStatus,
  EmployeePosition,
  EmployeeProfile,
  EmploymentType,
  LeaveBalanceSummary,
  LeaveRequest,
  NotificationItem,
  RequestType,
  Team,
} from '../types/hr';

type TeamRow = RowDataPacket & {
  id: string;
  name: string;
  head_user_id: string | null;
  head_name: string | null;
};

type LeaveRow = RowDataPacket & {
  id: string;
  requester_id: string;
  requester_name: string;
  team_id: string | null;
  team_name: string | null;
  request_type: RequestType;
  start_date: Date | string;
  end_date: Date | string;
  half_day: 'AM' | 'PM' | null;
  reason: string | null;
  status: LeaveRequest['status'];
  approver_id: string | null;
  approver_name: string | null;
  approval_status: ApprovalStatus | null;
  approval_step_id?: string;
  notion_sync_status: 'PENDING' | 'SYNCED' | 'FAILED' | null;
  notion_page_id: string | null;
  notion_page_url: string | null;
  notion_synced_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type NotificationRow = RowDataPacket & {
  id: string;
  type: string;
  title: string;
  message: string;
  target_type: string | null;
  target_id: string | null;
  read_at: Date | string | null;
  created_at: Date | string;
};

type EmployeeProfileRow = RowDataPacket & {
  user_id: string;
  team_id: string | null;
  team_name: string | null;
  position: EmployeePosition;
  employment_type: EmploymentType | null;
  hire_date: Date | string | null;
  years_of_service: number;
  used_days?: string | number | null;
};

type LeaveBalanceRow = RowDataPacket & {
  employment_type: EmploymentType | null;
  hire_date: Date | string | null;
  years_of_service: number | null;
  used_days: string | number | null;
};

type CountsRow = RowDataPacket & {
  unread_notifications: number;
  pending_approvals: number;
};

function toIso(value: Date | string | null) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toDateOnly(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    headUserId: row.head_user_id,
    headName: row.head_name,
  };
}

function mapLeave(row: LeaveRow): LeaveRequest {
  return {
    id: row.id,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    teamId: row.team_id,
    teamName: row.team_name,
    requestType: row.request_type,
    startDate: toDateOnly(row.start_date),
    endDate: toDateOnly(row.end_date),
    halfDay: row.half_day,
    reason: row.reason,
    status: row.status,
    approverId: row.approver_id,
    approverName: row.approver_name,
    approvalStatus: row.approval_status,
    notionSyncStatus: row.notion_sync_status,
    notionPageId: row.notion_page_id,
    notionPageUrl: row.notion_page_url,
    notionSyncedAt: toIso(row.notion_synced_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function mapNotification(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    targetType: row.target_type,
    targetId: row.target_id,
    readAt: toIso(row.read_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

function mapEmployeeProfile(row: EmployeeProfileRow): EmployeeProfile {
  const employmentType = row.employment_type ?? 'P';
  const grantedDays = calculateGrantedDays({
    employmentType,
    hireDate: row.hire_date == null ? null : toDateOnly(row.hire_date),
    yearsOfService: Number(row.years_of_service ?? 0),
  });
  const usedDays = Number(row.used_days ?? 0);
  return {
    userId: row.user_id,
    teamId: row.team_id,
    teamName: row.team_name,
    position: row.position,
    employmentType,
    hireDate: row.hire_date == null ? null : toDateOnly(row.hire_date),
    yearsOfService: Number(row.years_of_service ?? 0),
    grantedDays,
    usedDays,
    remainingDays: Math.max(0, grantedDays - usedDays),
  };
}

function fullMonthsSince(dateValue: string | null) {
  if (!dateValue) return 0;
  const start = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

export function calculateGrantedDays(input: { employmentType: EmploymentType; hireDate: string | null; yearsOfService?: number | null }) {
  const yearsOfService = Math.max(0, Math.floor(Number(input.yearsOfService ?? 0)));
  if (input.employmentType === 'P') return Math.min(25, 15 + yearsOfService * 2);
  return fullMonthsSince(input.hireDate);
}

function getLeaveUseSql() {
  return `
    SELECT requester_id,
      SUM(
        CASE
          WHEN request_type IN ('AM_HALF', 'PM_HALF') THEN 0.5
          WHEN request_type = 'ANNUAL' THEN DATEDIFF(end_date, start_date) + 1
          ELSE 0
        END
      ) AS used_days
    FROM leave_requests
    WHERE status = 'APPROVED'
      AND YEAR(start_date) = YEAR(CURDATE())
    GROUP BY requester_id
  `;
}

function getRequestUseDays(input: { requestType: RequestType; startDate: string; endDate: string }) {
  if (input.requestType === 'AM_HALF' || input.requestType === 'PM_HALF') return 0.5;
  if (input.requestType !== 'ANNUAL') return 0;
  const start = new Date(`${input.startDate}T00:00:00`);
  const end = new Date(`${input.endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / dayMs) + 1);
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  throw new Error('날짜 형식은 YYYY-MM-DD 이어야 합니다.');
}

function getRequestTypeLabel(type: RequestType) {
  switch (type) {
    case 'AM_HALF':
      return '오전 반차';
    case 'PM_HALF':
      return '오후 반차';
    case 'BUSINESS_TRIP':
      return '출장';
    case 'TRIP_EXPENSE':
      return '출장 여비';
    case 'SICK':
      return '병가';
    case 'OFFICIAL':
      return '공가';
    case 'COMP':
      return '대체휴무';
    default:
      return '연차';
  }
}

async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  message: string;
  targetType?: string;
  targetId?: string;
}) {
  const pool = getMysqlPool();
  await pool.execute(
    `
      INSERT INTO notifications (id, user_id, type, title, message, target_type, target_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [randomUUID(), input.userId, input.type, input.title, input.message, input.targetType ?? null, input.targetId ?? null],
  );
}

export async function listTeams() {
  const pool = getMysqlPool();
  const [rows] = await pool.query<TeamRow[]>(
    `
      SELECT t.id, t.name, t.head_user_id, u.name AS head_name
      FROM teams t
      LEFT JOIN users u ON u.id = t.head_user_id
      ORDER BY t.name ASC
    `,
  );
  return rows.map(mapTeam);
}

export async function createTeam(input: { name: string; headUserId?: string | null }) {
  const pool = getMysqlPool();
  const id = randomUUID();
  await pool.execute(
    `
      INSERT INTO teams (id, name, head_user_id)
      VALUES (?, ?, ?)
    `,
    [id, input.name.trim(), input.headUserId || null],
  );
  return id;
}

export async function updateTeam(input: { id: string; name: string; headUserId?: string | null }) {
  const pool = getMysqlPool();
  await pool.execute(
    `
      UPDATE teams
      SET name = ?, head_user_id = ?
      WHERE id = ?
    `,
    [input.name.trim(), input.headUserId || null, input.id],
  );
}

export async function deleteTeam(id: string) {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('UPDATE employee_profiles SET team_id = NULL WHERE team_id = ?', [id]);
    await connection.execute('DELETE FROM user_team_memberships WHERE team_id = ?', [id]);
    await connection.execute('DELETE FROM teams WHERE id = ?', [id]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listEmployeeProfiles() {
  const pool = getMysqlPool();
  const [rows] = await pool.query<EmployeeProfileRow[]>(
    `
      SELECT
        ep.user_id, ep.team_id, t.name AS team_name, ep.position, ep.employment_type,
        ep.hire_date, ep.years_of_service, COALESCE(used.used_days, 0) AS used_days
      FROM employee_profiles ep
      LEFT JOIN teams t ON t.id = ep.team_id
      LEFT JOIN (${getLeaveUseSql()}) used ON used.requester_id = ep.user_id
      ORDER BY ep.updated_at DESC
    `,
  );
  return rows.map(mapEmployeeProfile);
}

export async function getLeaveBalanceForUser(userId: string): Promise<LeaveBalanceSummary> {
  const pool = getMysqlPool();
  const [rows] = await pool.query<LeaveBalanceRow[]>(
    `
      SELECT ep.employment_type, ep.hire_date, ep.years_of_service, COALESCE(used.used_days, 0) AS used_days
      FROM users u
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      LEFT JOIN (${getLeaveUseSql()}) used ON used.requester_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId],
  );
  const row = rows[0];
  const employmentType = row?.employment_type ?? 'P';
  const hireDate = row?.hire_date == null ? null : toDateOnly(row.hire_date);
  const grantedDays = calculateGrantedDays({ employmentType, hireDate, yearsOfService: Number(row?.years_of_service ?? 0) });
  const usedDays = Number(row?.used_days ?? 0);
  return {
    employmentType,
    grantedDays,
    usedDays,
    remainingDays: Math.max(0, grantedDays - usedDays),
  };
}

export async function upsertEmployeeProfile(input: {
  userId: string;
  teamId?: string | null;
  position: EmployeePosition;
  employmentType: EmploymentType;
  hireDate?: string | null;
  yearsOfService: number;
}) {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();
  const teamId = input.teamId || null;
  const hireDate = input.hireDate || null;

  try {
    await connection.beginTransaction();
    await connection.execute(
      `
        INSERT INTO employee_profiles (user_id, team_id, position, employment_type, hire_date, years_of_service)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          team_id = VALUES(team_id),
          position = VALUES(position),
          employment_type = VALUES(employment_type),
          hire_date = VALUES(hire_date),
          years_of_service = VALUES(years_of_service)
      `,
      [input.userId, teamId, input.position, input.employmentType, hireDate, Math.max(0, input.yearsOfService)],
    );

    if (teamId) {
      await connection.execute(
        `
          INSERT INTO user_team_memberships (user_id, team_id, team_role)
          VALUES (?, ?, 'MEMBER')
          ON DUPLICATE KEY UPDATE team_role = VALUES(team_role)
        `,
        [input.userId, teamId],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function ensureDefaultTeamForUser(user: AuthUser) {
  const pool = getMysqlPool();
  const [membership] = await pool.query<RowDataPacket[]>(
    `
      SELECT t.id
      FROM user_team_memberships m
      JOIN teams t ON t.id = m.team_id
      WHERE m.user_id = ?
      LIMIT 1
    `,
    [user.id],
  );
  if (membership[0]?.id) return String(membership[0].id);

  const teamId = randomUUID();
  await pool.execute(
    `
      INSERT INTO teams (id, name, head_user_id)
      VALUES (?, '기본팀', ?)
      ON DUPLICATE KEY UPDATE head_user_id = COALESCE(head_user_id, VALUES(head_user_id))
    `,
    [teamId, user.role === 'HEAD' ? user.id : null],
  );

  const [teams] = await pool.query<RowDataPacket[]>('SELECT id FROM teams WHERE name = ? LIMIT 1', ['기본팀']);
  const defaultTeamId = String(teams[0].id);
  await pool.execute(
    `
      INSERT INTO user_team_memberships (user_id, team_id, team_role)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE team_role = VALUES(team_role)
    `,
    [user.id, defaultTeamId, user.role === 'HEAD' ? 'HEAD' : 'MEMBER'],
  );
  return defaultTeamId;
}

export type LeaveVisibilityScope = 'ALL' | 'TEAM' | 'SELF';

export async function getLeaveVisibilityForUser(user: AuthUser): Promise<{ scope: LeaveVisibilityScope; teamIds: string[] }> {
  if (user.role === 'HEAD' || user.role === 'ADMIN') {
    return { scope: 'ALL', teamIds: [] };
  }

  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT DISTINCT team_id AS id
      FROM user_team_memberships
      WHERE user_id = ? AND team_role = 'HEAD'
      UNION
      SELECT id
      FROM teams
      WHERE head_user_id = ?
    `,
    [user.id, user.id],
  );
  const teamIds = rows.map((row) => String(row.id)).filter(Boolean);
  if (teamIds.length > 0) return { scope: 'TEAM', teamIds };

  return { scope: 'SELF', teamIds: [] };
}

export async function listLeaveRequests(input: { user: AuthUser; month?: string }) {
  const pool = getMysqlPool();
  const params: unknown[] = [];
  const where: string[] = [];
  const visibility = await getLeaveVisibilityForUser(input.user);

  if (input.month && /^\d{4}-\d{2}$/.test(input.month)) {
    where.push('lr.start_date < DATE_ADD(?, INTERVAL 1 MONTH)');
    where.push('lr.end_date >= ?');
    params.push(`${input.month}-01`, `${input.month}-01`);
  }

  if (visibility.scope === 'SELF') {
    where.push('lr.requester_id = ?');
    params.push(input.user.id);
  } else if (visibility.scope === 'TEAM') {
    const placeholders = visibility.teamIds.map(() => '?').join(', ');
    where.push(`(lr.team_id IN (${placeholders}) OR lr.requester_id = ?)`);
    params.push(...visibility.teamIds, input.user.id);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query<LeaveRow[]>(
    `
      SELECT
        lr.id, lr.requester_id, requester.name AS requester_name,
        lr.team_id, t.name AS team_name, lr.request_type, lr.start_date, lr.end_date,
        lr.half_day, lr.reason, lr.status,
        aps.approver_id, approver.name AS approver_name, aps.status AS approval_status,
        sync.sync_status AS notion_sync_status,
        sync.external_page_id AS notion_page_id,
        sync.external_url AS notion_page_url,
        sync.synced_at AS notion_synced_at,
        lr.created_at, lr.updated_at
      FROM leave_requests lr
      JOIN users requester ON requester.id = lr.requester_id
      LEFT JOIN teams t ON t.id = lr.team_id
      LEFT JOIN approval_steps aps ON aps.target_type = 'LEAVE_REQUEST' AND aps.target_id = lr.id AND aps.step_order = 1
      LEFT JOIN users approver ON approver.id = aps.approver_id
      LEFT JOIN approval_calendar_syncs sync ON sync.target_type = 'LEAVE_REQUEST' AND sync.target_id = lr.id AND sync.provider = 'NOTION'
      ${whereSql}
      ORDER BY lr.start_date ASC, lr.created_at DESC
    `,
    params,
  );

  return rows.map(mapLeave);
}

export async function createLeaveRequest(input: {
  requester: AuthUser;
  requestType: RequestType;
  startDate: string;
  endDate: string;
  reason?: string;
}) {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();
  const id = randomUUID();
  const approvalStepId = randomUUID();
  const startDate = normalizeDate(input.startDate);
  const endDate = normalizeDate(input.endDate || input.startDate);
  const halfDay = input.requestType === 'AM_HALF' ? 'AM' : input.requestType === 'PM_HALF' ? 'PM' : null;
  const requestedDays = getRequestUseDays({ requestType: input.requestType, startDate, endDate });

  if (requestedDays > 0) {
    const balance = await getLeaveBalanceForUser(input.requester.id);
    if (requestedDays > balance.remainingDays) {
      throw new Error(`잔여 연차가 부족합니다. 현재 잔여 ${balance.remainingDays}일, 신청 ${requestedDays}일입니다.`);
    }
  }

  try {
    await connection.beginTransaction();

    const teamId = await ensureDefaultTeamForUser(input.requester);
    const [teams] = await connection.query<RowDataPacket[]>(
      `
        SELECT t.id, COALESCE(t.head_user_id, ?) AS approver_id
        FROM teams t
        WHERE t.id = ?
        LIMIT 1
      `,
      [input.requester.id, teamId],
    );
    const approverId = String(teams[0]?.approver_id || input.requester.id);

    await connection.execute(
      `
        INSERT INTO leave_requests (
          id, requester_id, team_id, request_type, start_date, end_date, half_day, reason, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `,
      [id, input.requester.id, teamId, input.requestType, startDate, endDate, halfDay, input.reason?.trim() || null],
    );

    await connection.execute(
      `
        INSERT INTO approval_steps (id, target_type, target_id, step_order, approver_id, status)
        VALUES (?, 'LEAVE_REQUEST', ?, 1, ?, 'PENDING')
      `,
      [approvalStepId, id, approverId],
    );

    await connection.commit();

    await createNotification({
      userId: approverId,
      type: 'APPROVAL_REQUESTED',
      title: `${input.requester.name}님 ${getRequestTypeLabel(input.requestType)} 결재 요청`,
      message: `${startDate}${startDate !== endDate ? ` ~ ${endDate}` : ''} 일정의 결재가 요청되었습니다.`,
      targetType: 'LEAVE_REQUEST',
      targetId: id,
    });

    return id;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listApprovalItems(user: AuthUser) {
  const pool = getMysqlPool();
  const approvalScope = user.role === 'HEAD' || user.role === 'ADMIN' ? '' : 'AND aps.approver_id = ?';
  const approvalParams = user.role === 'HEAD' || user.role === 'ADMIN' ? [] : [user.id];
  const leaveParams: unknown[] = [...approvalParams];
  const tripExpenseParams: unknown[] = [...approvalParams];

  const [leaveRows] = await pool.query<(LeaveRow & { approval_step_id: string })[]>(
    `
      SELECT
        aps.id AS approval_step_id,
        aps.step_order AS approval_step_order,
        lr.id, lr.requester_id, requester.name AS requester_name,
        lr.team_id, t.name AS team_name, lr.request_type, lr.start_date, lr.end_date,
        lr.half_day, lr.reason, lr.status,
        aps.approver_id, approver.name AS approver_name, aps.status AS approval_status,
        sync.sync_status AS notion_sync_status,
        sync.external_page_id AS notion_page_id,
        sync.external_url AS notion_page_url,
        sync.synced_at AS notion_synced_at,
        lr.created_at, lr.updated_at
      FROM approval_steps aps
      JOIN leave_requests lr ON lr.id = aps.target_id
      JOIN users requester ON requester.id = lr.requester_id
      LEFT JOIN teams t ON t.id = lr.team_id
      LEFT JOIN users approver ON approver.id = aps.approver_id
      LEFT JOIN approval_calendar_syncs sync ON sync.target_type = 'LEAVE_REQUEST' AND sync.target_id = lr.id AND sync.provider = 'NOTION'
      WHERE aps.target_type = 'LEAVE_REQUEST'
        AND aps.status = 'PENDING'
        AND NOT EXISTS (
          SELECT 1
          FROM approval_steps prev
          WHERE prev.target_type = aps.target_type
            AND prev.target_id = aps.target_id
            AND prev.step_order < aps.step_order
            AND prev.status <> 'APPROVED'
        )
        ${approvalScope}
      ORDER BY lr.start_date ASC, lr.created_at ASC
    `,
    leaveParams,
  );

  const [tripExpenseRows] = await pool.query<RowDataPacket[]>(
    `
      SELECT
        aps.id AS approval_step_id,
        aps.step_order AS approval_step_order,
        ter.id,
        ter.requester_id,
        requester.name AS requester_name,
        ter.team_id,
        t.name AS team_name,
        'TRIP_EXPENSE' AS request_type,
        trip.start_date,
        trip.end_date,
        NULL AS half_day,
        CONCAT(ter.origin, ' - ', ter.destination, ' / ', FORMAT(ter.total_amount, 0), '원', IF(ter.memo IS NULL OR ter.memo = '', '', CONCAT(' / ', ter.memo))) AS reason,
        ter.status,
        aps.approver_id,
        approver.name AS approver_name,
        aps.status AS approval_status,
        NULL AS notion_sync_status,
        NULL AS notion_page_id,
        NULL AS notion_page_url,
        NULL AS notion_synced_at,
        ter.created_at,
        ter.updated_at
      FROM approval_steps aps
      JOIN trip_expense_requests ter ON ter.id = aps.target_id
      JOIN leave_requests trip ON trip.id = ter.business_trip_request_id
      JOIN users requester ON requester.id = ter.requester_id
      LEFT JOIN teams t ON t.id = ter.team_id
      LEFT JOIN users approver ON approver.id = aps.approver_id
      WHERE aps.target_type = 'TRIP_EXPENSE'
        AND aps.status = 'PENDING'
        AND NOT EXISTS (
          SELECT 1
          FROM approval_steps prev
          WHERE prev.target_type = aps.target_type
            AND prev.target_id = aps.target_id
            AND prev.step_order < aps.step_order
            AND prev.status <> 'APPROVED'
        )
        ${approvalScope}
      ORDER BY trip.end_date ASC, ter.created_at ASC
    `,
    tripExpenseParams,
  );

  const leaveItems = leaveRows.map((row) => ({
    ...mapLeave(row),
    approvalStepId: row.approval_step_id,
    approvalStepOrder: Number(row.approval_step_order ?? 1),
  })) satisfies ApprovalItem[];
  const tripExpenseItems = tripExpenseRows.map((row) => ({
    ...mapLeave(row as LeaveRow),
    approvalStepId: String(row.approval_step_id),
    approvalStepOrder: Number(row.approval_step_order ?? 1),
  })) satisfies ApprovalItem[];

  return [...leaveItems, ...tripExpenseItems];
}

export type CalendarSyncResult = {
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  mode: 'mock' | 'real' | null;
  externalPageId: string | null;
  externalUrl: string | null;
  error: string | null;
};

async function syncApprovedLeaveRequestToNotion(targetId: string): Promise<CalendarSyncResult> {
  const pool = getMysqlPool();

  await pool.execute(
    `
      INSERT INTO approval_calendar_syncs (id, target_type, target_id, provider, sync_status)
      VALUES (?, 'LEAVE_REQUEST', ?, 'NOTION', 'PENDING')
      ON DUPLICATE KEY UPDATE
        sync_status = 'PENDING',
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP(3)
    `,
    [randomUUID(), targetId],
  );

  const [rows] = await pool.query<LeaveRow[]>(
    `
      SELECT
        lr.id, lr.requester_id, requester.name AS requester_name,
        lr.team_id, t.name AS team_name, lr.request_type, lr.start_date, lr.end_date,
        lr.half_day, lr.reason, lr.status,
        aps.approver_id, approver.name AS approver_name, aps.status AS approval_status,
        sync.sync_status AS notion_sync_status,
        sync.external_page_id AS notion_page_id,
        sync.external_url AS notion_page_url,
        sync.synced_at AS notion_synced_at,
        lr.created_at, lr.updated_at
      FROM leave_requests lr
      JOIN users requester ON requester.id = lr.requester_id
      LEFT JOIN teams t ON t.id = lr.team_id
      LEFT JOIN approval_steps aps ON aps.target_type = 'LEAVE_REQUEST' AND aps.target_id = lr.id AND aps.step_order = 1
      LEFT JOIN users approver ON approver.id = aps.approver_id
      LEFT JOIN approval_calendar_syncs sync ON sync.target_type = 'LEAVE_REQUEST' AND sync.target_id = lr.id AND sync.provider = 'NOTION'
      WHERE lr.id = ?
      LIMIT 1
    `,
    [targetId],
  );

  const leave = rows[0] ? mapLeave(rows[0]) : null;
  if (!leave) {
    const error = 'Leave request not found for Notion sync';
    await pool.execute(
      `
        UPDATE approval_calendar_syncs
        SET sync_status = 'FAILED', last_error = ?
        WHERE target_type = 'LEAVE_REQUEST' AND target_id = ? AND provider = 'NOTION'
      `,
      [error, targetId],
    );
    return { status: 'FAILED', mode: null, externalPageId: null, externalUrl: null, error };
  }

  try {
    const result = await createNotionCalendarPage(
      buildLeaveNotionPayload({ leave, typeLabel: getRequestTypeLabel(leave.requestType) }),
    );

    await pool.execute(
      `
        UPDATE approval_calendar_syncs
        SET sync_status = 'SYNCED',
            external_page_id = ?,
            external_url = ?,
            last_error = NULL,
            synced_at = CURRENT_TIMESTAMP(3)
        WHERE target_type = 'LEAVE_REQUEST' AND target_id = ? AND provider = 'NOTION'
      `,
      [result.externalPageId, result.externalUrl, targetId],
    );

    return {
      status: 'SYNCED',
      mode: result.mode,
      externalPageId: result.externalPageId,
      externalUrl: result.externalUrl,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Notion calendar sync failed';
    await pool.execute(
      `
        UPDATE approval_calendar_syncs
        SET sync_status = 'FAILED', last_error = ?
        WHERE target_type = 'LEAVE_REQUEST' AND target_id = ? AND provider = 'NOTION'
      `,
      [message, targetId],
    );
    return { status: 'FAILED', mode: null, externalPageId: null, externalUrl: null, error: message };
  }
}

export async function decideApproval(input: { user: AuthUser; stepId: string; decision: 'APPROVED' | 'REJECTED'; comment?: string }) {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [stepRows] = await connection.query<RowDataPacket[]>(
      `
        SELECT id, target_type, approver_id, target_id, step_order
        FROM approval_steps
        WHERE id = ? AND status = 'PENDING'
        LIMIT 1
      `,
      [input.stepId],
    );
    const pendingStep = stepRows[0];
    if (!pendingStep) throw new Error('처리할 결재 건을 찾지 못했습니다.');
    if (input.user.role !== 'HEAD' && input.user.role !== 'ADMIN' && pendingStep.approver_id !== input.user.id) {
      throw new Error('결재 권한이 없습니다.');
    }

    if (pendingStep.target_type === 'TRIP_EXPENSE') {
      const [targets] = await connection.query<RowDataPacket[]>(
        `
          SELECT ter.id, ter.requester_id
          FROM trip_expense_requests ter
          WHERE ter.id = ?
          LIMIT 1
        `,
        [pendingStep.target_id],
      );
      const target = targets[0];
      if (!target) throw new Error('출장여비 신청 건을 찾지 못했습니다.');

      await connection.execute(
        `
          UPDATE approval_steps
          SET status = ?, comment = ?, decided_at = CURRENT_TIMESTAMP(3)
          WHERE id = ?
        `,
        [input.decision, input.comment?.trim() || null, input.stepId],
      );

      if (input.decision === 'REJECTED') {
        await connection.execute('UPDATE trip_expense_requests SET status = ? WHERE id = ?', ['REJECTED', pendingStep.target_id]);
        await connection.commit();

        await createSecurityAuditLog({
          actorId: input.user.id,
          targetUserId: String(target.requester_id),
          action: 'TRIP_EXPENSE_REJECTED',
          details: {
            tripExpenseRequestId: String(pendingStep.target_id),
            approvalStepId: input.stepId,
            stepOrder: Number(pendingStep.step_order ?? 1),
            comment: input.comment?.trim() || null,
          },
        });

        await createNotification({
          userId: String(target.requester_id),
          type: 'APPROVAL_REJECTED',
          title: '출장여비 신청이 반려되었습니다.',
          message: input.comment?.trim() || `${input.user.name}님이 결재를 반려했습니다.`,
          targetType: 'TRIP_EXPENSE',
          targetId: String(pendingStep.target_id),
        });

        return { calendarSync: null };
      }

      const [nextSteps] = await connection.query<RowDataPacket[]>(
        `
          SELECT aps.id, aps.approver_id, approver.name AS approver_name
          FROM approval_steps aps
          JOIN users approver ON approver.id = aps.approver_id
          WHERE aps.target_type = 'TRIP_EXPENSE'
            AND aps.target_id = ?
            AND aps.status = 'PENDING'
            AND aps.step_order > (
              SELECT current_step.step_order
              FROM approval_steps current_step
              WHERE current_step.id = ?
              LIMIT 1
            )
          ORDER BY aps.step_order ASC
          LIMIT 1
        `,
        [pendingStep.target_id, input.stepId],
      );
      const nextStep = nextSteps[0];
      if (nextStep) {
        await connection.commit();

        await createSecurityAuditLog({
          actorId: input.user.id,
          targetUserId: String(target.requester_id),
          action: 'TRIP_EXPENSE_APPROVED',
          details: {
            tripExpenseRequestId: String(pendingStep.target_id),
            approvalStepId: input.stepId,
            stepOrder: Number(pendingStep.step_order ?? 1),
            finalApproval: false,
            nextApproverId: String(nextStep.approver_id),
          },
        });

        await createNotification({
          userId: String(nextStep.approver_id),
          type: 'APPROVAL_REQUESTED',
          title: '출장여비 최종 결재 요청',
          message: '팀장 결재가 완료된 출장여비 신청의 최종 결재가 요청되었습니다.',
          targetType: 'TRIP_EXPENSE',
          targetId: String(pendingStep.target_id),
        });

        return { calendarSync: null };
      }

      await connection.execute('UPDATE trip_expense_requests SET status = ? WHERE id = ?', ['APPROVED', pendingStep.target_id]);
      await connection.commit();

      await createSecurityAuditLog({
        actorId: input.user.id,
        targetUserId: String(target.requester_id),
        action: 'TRIP_EXPENSE_APPROVED',
        details: {
          tripExpenseRequestId: String(pendingStep.target_id),
          approvalStepId: input.stepId,
          stepOrder: Number(pendingStep.step_order ?? 1),
          finalApproval: true,
          comment: input.comment?.trim() || null,
        },
      });

      await createNotification({
        userId: String(target.requester_id),
        type: 'APPROVAL_APPROVED',
        title: '출장여비 신청이 최종 승인되었습니다.',
        message: input.comment?.trim() || `${input.user.name}님이 출장여비 최종 결재를 승인했습니다.`,
        targetType: 'TRIP_EXPENSE',
        targetId: String(pendingStep.target_id),
      });

      return { calendarSync: null };
    }

    const [rows] = await connection.query<RowDataPacket[]>(
      `
        SELECT aps.id, aps.approver_id, aps.target_id, lr.requester_id, requester.name AS requester_name, lr.request_type
        FROM approval_steps aps
        JOIN leave_requests lr ON lr.id = aps.target_id
        JOIN users requester ON requester.id = lr.requester_id
        WHERE aps.id = ? AND aps.status = 'PENDING'
        LIMIT 1
      `,
      [input.stepId],
    );
    const step = rows[0];
    if (!step) throw new Error('처리할 결재 건을 찾지 못했습니다.');
    if (input.user.role !== 'HEAD' && input.user.role !== 'ADMIN' && step.approver_id !== input.user.id) {
      throw new Error('결재 권한이 없습니다.');
    }

    await connection.execute(
      `
        UPDATE approval_steps
        SET status = ?, comment = ?, decided_at = CURRENT_TIMESTAMP(3)
        WHERE id = ?
      `,
      [input.decision, input.comment?.trim() || null, input.stepId],
    );
    await connection.execute('UPDATE leave_requests SET status = ? WHERE id = ?', [input.decision, step.target_id]);
    await connection.commit();

    await createNotification({
      userId: String(step.requester_id),
      type: input.decision === 'APPROVED' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
      title: `${getRequestTypeLabel(step.request_type)} 신청이 ${input.decision === 'APPROVED' ? '승인' : '반려'}되었습니다`,
      message: input.comment?.trim() || `${input.user.name}님이 결재를 처리했습니다.`,
      targetType: 'LEAVE_REQUEST',
      targetId: String(step.target_id),
    });
    if (input.decision === 'APPROVED') {
      return { calendarSync: await syncApprovedLeaveRequestToNotion(String(step.target_id)) };
    }

    return { calendarSync: null };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listNotifications(userId: string) {
  const pool = getMysqlPool();
  const [rows] = await pool.query<NotificationRow[]>(
    `
      SELECT id, type, title, message, target_type, target_id, read_at, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [userId],
  );
  return rows.map(mapNotification);
}

export async function markNotificationRead(userId: string, id: string) {
  const pool = getMysqlPool();
  await pool.execute('UPDATE notifications SET read_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND user_id = ?', [id, userId]);
}

export async function markAllNotificationsRead(userId: string) {
  const pool = getMysqlPool();
  await pool.execute('UPDATE notifications SET read_at = CURRENT_TIMESTAMP(3) WHERE user_id = ? AND read_at IS NULL', [userId]);
}

export async function getNotificationCounts(user: AuthUser) {
  const pool = getMysqlPool();
  const [rows] = await pool.query<CountsRow[]>(
    `
      SELECT
        (SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL) AS unread_notifications,
        (
          SELECT COUNT(*)
          FROM approval_steps aps
          WHERE aps.status = 'PENDING'
            AND (? IN ('HEAD', 'ADMIN') OR aps.approver_id = ?)
            AND NOT EXISTS (
              SELECT 1
              FROM approval_steps prev
              WHERE prev.target_type = aps.target_type
                AND prev.target_id = aps.target_id
                AND prev.step_order < aps.step_order
                AND prev.status <> 'APPROVED'
            )
        ) AS pending_approvals
    `,
    [user.id, user.role, user.id],
  );

  return {
    unreadNotifications: Number(rows[0]?.unread_notifications ?? 0),
    pendingApprovals: Number(rows[0]?.pending_approvals ?? 0),
  };
}
