import type { RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';
import type { AuthUser } from './users';

function toIso(value: Date | string | null) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toDateOnly(value: Date | string | null) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function listSecurityAuditLogs() {
  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT sal.id, sal.action, sal.details, sal.created_at,
        actor.name AS actor_name, actor.email AS actor_email,
        target.name AS target_name, target.email AS target_email
      FROM security_audit_logs sal
      LEFT JOIN users actor ON actor.id = sal.actor_id
      LEFT JOIN users target ON target.id = sal.target_user_id
      ORDER BY sal.created_at DESC
      LIMIT 100
    `,
  );

  return rows.map((row) => ({
    id: String(row.id),
    action: String(row.action),
    details: typeof row.details === 'string' ? row.details : JSON.stringify(row.details ?? {}),
    actorName: row.actor_name ? String(row.actor_name) : '-',
    actorEmail: row.actor_email ? String(row.actor_email) : null,
    targetName: row.target_name ? String(row.target_name) : '-',
    targetEmail: row.target_email ? String(row.target_email) : null,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  }));
}

export async function listOrganizationSnapshot() {
  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT
        t.id AS team_id, t.name AS team_name, head.name AS head_name,
        u.id AS user_id, u.name AS user_name, u.email, u.role, u.status,
        ep.position, ep.employment_type, ep.hire_date, ep.years_of_service
      FROM teams t
      LEFT JOIN users head ON head.id = t.head_user_id
      LEFT JOIN employee_profiles ep ON ep.team_id = t.id
      LEFT JOIN users u ON u.id = ep.user_id
      ORDER BY t.name ASC, FIELD(u.role, 'HEAD', 'ADMIN', 'OPERATOR', 'VIEWER'), u.name ASC
    `,
  );

  const teams = new Map<string, { id: string; name: string; headName: string; members: Array<Record<string, unknown>> }>();
  for (const row of rows) {
    const id = String(row.team_id);
    if (!teams.has(id)) {
      teams.set(id, { id, name: String(row.team_name), headName: row.head_name ? String(row.head_name) : '미지정', members: [] });
    }
    if (row.user_id) {
      teams.get(id)!.members.push({
        id: String(row.user_id),
        name: String(row.user_name),
        email: String(row.email),
        role: String(row.role),
        status: String(row.status),
        position: String(row.position ?? 'STAFF'),
        employmentType: String(row.employment_type ?? 'P'),
        hireDate: toDateOnly(row.hire_date),
        yearsOfService: Number(row.years_of_service ?? 0),
      });
    }
  }

  const [unassignedRows] = await pool.query<RowDataPacket[]>(
    `
      SELECT u.id, u.name, u.email, u.role, u.status,
        ep.position, ep.employment_type, ep.hire_date, ep.years_of_service
      FROM users u
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      WHERE ep.team_id IS NULL OR ep.user_id IS NULL
      ORDER BY u.created_at DESC
    `,
  );

  return {
    teams: Array.from(teams.values()),
    unassigned: unassignedRows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: String(row.role),
      status: String(row.status),
      position: String(row.position ?? 'STAFF'),
      employmentType: String(row.employment_type ?? 'P'),
      hireDate: toDateOnly(row.hire_date),
      yearsOfService: Number(row.years_of_service ?? 0),
    })),
  };
}

export async function listLeaveStats() {
  const pool = getMysqlPool();
  const [summaryRows] = await pool.query<RowDataPacket[]>(
    `
      SELECT
        COUNT(*) AS total_requests,
        SUM(status = 'PENDING') AS pending_requests,
        SUM(status = 'APPROVED') AS approved_requests,
        SUM(status = 'REJECTED') AS rejected_requests,
        SUM(CASE WHEN status = 'APPROVED' AND request_type IN ('ANNUAL', 'AM_HALF', 'PM_HALF') THEN
          CASE WHEN request_type IN ('AM_HALF', 'PM_HALF') THEN 0.5 ELSE DATEDIFF(end_date, start_date) + 1 END
        ELSE 0 END) AS used_leave_days
      FROM leave_requests
      WHERE YEAR(start_date) = YEAR(CURDATE())
    `,
  );
  const [teamRows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COALESCE(t.name, '팀 미지정') AS team_name,
        COUNT(*) AS request_count,
        SUM(lr.status = 'APPROVED') AS approved_count,
        SUM(CASE WHEN lr.status = 'APPROVED' AND lr.request_type IN ('ANNUAL', 'AM_HALF', 'PM_HALF') THEN
          CASE WHEN lr.request_type IN ('AM_HALF', 'PM_HALF') THEN 0.5 ELSE DATEDIFF(lr.end_date, lr.start_date) + 1 END
        ELSE 0 END) AS used_leave_days
      FROM leave_requests lr
      LEFT JOIN teams t ON t.id = lr.team_id
      WHERE YEAR(lr.start_date) = YEAR(CURDATE())
      GROUP BY COALESCE(t.name, '팀 미지정')
      ORDER BY request_count DESC
    `,
  );
  const [recentRows] = await pool.query<RowDataPacket[]>(
    `
      SELECT lr.id, requester.name AS requester_name, COALESCE(t.name, '팀 미지정') AS team_name,
        lr.request_type, lr.status, lr.start_date, lr.end_date, lr.created_at
      FROM leave_requests lr
      JOIN users requester ON requester.id = lr.requester_id
      LEFT JOIN teams t ON t.id = lr.team_id
      ORDER BY lr.created_at DESC
      LIMIT 12
    `,
  );

  const summary = summaryRows[0] ?? {};
  return {
    summary: {
      totalRequests: Number(summary.total_requests ?? 0),
      pendingRequests: Number(summary.pending_requests ?? 0),
      approvedRequests: Number(summary.approved_requests ?? 0),
      rejectedRequests: Number(summary.rejected_requests ?? 0),
      usedLeaveDays: Number(summary.used_leave_days ?? 0),
    },
    teams: teamRows.map((row) => ({
      teamName: String(row.team_name),
      requestCount: Number(row.request_count ?? 0),
      approvedCount: Number(row.approved_count ?? 0),
      usedLeaveDays: Number(row.used_leave_days ?? 0),
    })),
    recent: recentRows.map((row) => ({
      id: String(row.id),
      requesterName: String(row.requester_name),
      teamName: String(row.team_name),
      requestType: String(row.request_type),
      status: String(row.status),
      startDate: toDateOnly(row.start_date),
      endDate: toDateOnly(row.end_date),
      createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    })),
  };
}

export async function listApprovalDocuments(user: AuthUser) {
  const pool = getMysqlPool();
  const params: unknown[] = [];
  const scope =
    user.role === 'HEAD' || user.role === 'ADMIN'
      ? ''
      : 'WHERE lr.requester_id = ? OR aps.approver_id = ?';
  if (scope) params.push(user.id, user.id);

  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT lr.id, lr.request_type, lr.status AS request_status, lr.start_date, lr.end_date, lr.reason, lr.created_at,
        requester.name AS requester_name, COALESCE(t.name, '팀 미지정') AS team_name,
        COUNT(aps.id) AS step_count,
        SUM(aps.status = 'APPROVED') AS approved_steps,
        SUM(aps.status = 'REJECTED') AS rejected_steps
      FROM leave_requests lr
      JOIN users requester ON requester.id = lr.requester_id
      LEFT JOIN teams t ON t.id = lr.team_id
      LEFT JOIN approval_steps aps ON aps.target_type = 'LEAVE_REQUEST' AND aps.target_id = lr.id
      ${scope}
      GROUP BY lr.id, lr.request_type, lr.status, lr.start_date, lr.end_date, lr.reason, lr.created_at, requester.name, t.name
      ORDER BY lr.created_at DESC
      LIMIT 80
    `,
    params,
  );

  return rows.map((row) => ({
    id: String(row.id),
    requestType: String(row.request_type),
    status: String(row.request_status),
    requesterName: String(row.requester_name),
    teamName: String(row.team_name),
    startDate: toDateOnly(row.start_date),
    endDate: toDateOnly(row.end_date),
    reason: row.reason ? String(row.reason) : '-',
    stepCount: Number(row.step_count ?? 0),
    approvedSteps: Number(row.approved_steps ?? 0),
    rejectedSteps: Number(row.rejected_steps ?? 0),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  }));
}
