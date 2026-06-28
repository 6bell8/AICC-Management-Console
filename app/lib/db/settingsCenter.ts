import { randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';
import { getOrganizationSeal, getOrganizationSettings } from './erp';
import { listTeams } from './hr';
import { listPermissionDelegationPresets, listPermissionDelegations } from './permissionDelegations';

type CountRow = RowDataPacket & {
  total_count?: number;
  pending_count?: number;
  approved_count?: number;
  head_admin_count?: number;
  viewer_count?: number;
  force_password_change_count?: number;
};

type LeavePolicyRow = RowDataPacket & {
  id: string;
  position: string;
  min_years: number;
  max_years: number | null;
  granted_days: string | number;
  effective_from: Date | string;
  effective_to: Date | string | null;
};

export type LeavePolicyInput = {
  position: string;
  minYears: number;
  maxYears: number | null;
  grantedDays: number;
  effectiveFrom: string;
  effectiveTo: string | null;
};

type ApprovalRow = RowDataPacket & {
  pending_steps: number;
  trip_expense_steps: number;
  leave_steps: number;
};

type NotificationRow = RowDataPacket & {
  unread_count: number;
  total_count: number;
};

type ApprovedUserRow = RowDataPacket & {
  id: string;
  name: string;
  email: string;
  role: string;
  team_id: string | null;
  team_name: string | null;
};

function toDateOnly(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapLeavePolicy(row: LeavePolicyRow) {
  return {
    id: row.id,
    position: row.position,
    minYears: Number(row.min_years ?? 0),
    maxYears: row.max_years == null ? null : Number(row.max_years),
    grantedDays: Number(row.granted_days ?? 0),
    effectiveFrom: toDateOnly(row.effective_from),
    effectiveTo: toDateOnly(row.effective_to),
  };
}

export async function getSettingsCenterData() {
  const pool = getMysqlPool();
  const [organization, documentSeal, teams, permissionDelegations, permissionDelegationPresets] = await Promise.all([
    getOrganizationSettings(),
    getOrganizationSeal(),
    listTeams(),
    listPermissionDelegations(),
    listPermissionDelegationPresets(),
  ]);

  const [userRows] = await pool.query<CountRow[]>(`
    SELECT
      COUNT(*) AS total_count,
      SUM(status = 'PENDING') AS pending_count,
      SUM(status = 'APPROVED') AS approved_count,
      SUM(role IN ('HEAD', 'ADMIN')) AS head_admin_count,
      SUM(role = 'VIEWER') AS viewer_count,
      SUM(force_password_change = 1) AS force_password_change_count
    FROM users
  `);

  const [policyRows] = await pool.query<LeavePolicyRow[]>(`
    SELECT id, position, min_years, max_years, granted_days, effective_from, effective_to
    FROM leave_policies
    ORDER BY position ASC, min_years ASC
  `);

  const [approvalRows] = await pool.query<ApprovalRow[]>(`
    SELECT
      SUM(status = 'PENDING') AS pending_steps,
      SUM(target_type = 'TRIP_EXPENSE') AS trip_expense_steps,
      SUM(target_type = 'LEAVE_REQUEST') AS leave_steps
    FROM approval_steps
  `);

  const [notificationRows] = await pool.query<NotificationRow[]>(`
    SELECT
      SUM(read_at IS NULL) AS unread_count,
      COUNT(*) AS total_count
    FROM notifications
  `);

  const [approvedUserRows] = await pool.query<ApprovedUserRow[]>(`
    SELECT u.id, u.name, u.email, u.role, ep.team_id, t.name AS team_name
    FROM users u
    LEFT JOIN employee_profiles ep ON ep.user_id = u.id
    LEFT JOIN teams t ON t.id = ep.team_id
    WHERE u.status = 'APPROVED'
    ORDER BY COALESCE(t.name, '미지정') ASC, u.name ASC, u.email ASC
  `);

  const userSummary = userRows[0] ?? {};
  const approvalSummary = approvalRows[0] ?? {};
  const notificationSummary = notificationRows[0] ?? {};

  return {
    organization,
    documentSeal,
    teams,
    users: {
      total: Number(userSummary.total_count ?? 0),
      pending: Number(userSummary.pending_count ?? 0),
      approved: Number(userSummary.approved_count ?? 0),
      managers: Number(userSummary.head_admin_count ?? 0),
      viewers: Number(userSummary.viewer_count ?? 0),
      forcePasswordChange: Number(userSummary.force_password_change_count ?? 0),
    },
    approvedUsers: approvedUserRows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      teamId: row.team_id,
      teamName: row.team_name,
    })),
    permissionDelegations,
    permissionDelegationPresets,
    leavePolicies: policyRows.map(mapLeavePolicy),
    approvals: {
      pendingSteps: Number(approvalSummary.pending_steps ?? 0),
      tripExpenseSteps: Number(approvalSummary.trip_expense_steps ?? 0),
      leaveSteps: Number(approvalSummary.leave_steps ?? 0),
    },
    notifications: {
      unread: Number(notificationSummary.unread_count ?? 0),
      total: Number(notificationSummary.total_count ?? 0),
    },
  };
}

export async function createLeavePolicy(input: LeavePolicyInput) {
  const pool = getMysqlPool();
  const id = randomUUID();
  await pool.execute(
    `
      INSERT INTO leave_policies (id, position, min_years, max_years, granted_days, effective_from, effective_to)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [id, input.position, input.minYears, input.maxYears, input.grantedDays, input.effectiveFrom, input.effectiveTo],
  );
  return getLeavePolicyById(id);
}

export async function updateLeavePolicy(id: string, input: LeavePolicyInput) {
  const pool = getMysqlPool();
  await pool.execute(
    `
      UPDATE leave_policies
      SET position = ?, min_years = ?, max_years = ?, granted_days = ?, effective_from = ?, effective_to = ?
      WHERE id = ?
    `,
    [input.position, input.minYears, input.maxYears, input.grantedDays, input.effectiveFrom, input.effectiveTo, id],
  );
  return getLeavePolicyById(id);
}

export async function deleteLeavePolicy(id: string) {
  const pool = getMysqlPool();
  const [result] = await pool.execute('DELETE FROM leave_policies WHERE id = ?', [id]);
  return result;
}

export async function getLeavePolicyById(id: string) {
  const pool = getMysqlPool();
  const [rows] = await pool.query<LeavePolicyRow[]>(
    `
      SELECT id, position, min_years, max_years, granted_days, effective_from, effective_to
      FROM leave_policies
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );
  return rows[0] ? mapLeavePolicy(rows[0]) : null;
}
