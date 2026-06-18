import type { RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';
import type { AuthUser } from './users';

export type OrganizationSettings = {
  rootName: string;
  sealImageUrl: string;
  sealFileName: string;
  sealStorageKey: string;
  sealUpdatedAt: string | null;
};

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

async function ensureOrganizationSettingsTable() {
  const pool = getMysqlPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS organization_settings (
      id TINYINT NOT NULL DEFAULT 1,
      root_name VARCHAR(100) NOT NULL DEFAULT 'AICC 본부',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      CONSTRAINT chk_organization_settings_singleton CHECK (id = 1)
    ) ENGINE=InnoDB
  `);
  await ensureOrganizationSettingsColumn('seal_image_url', 'MEDIUMTEXT NULL AFTER root_name');
  await ensureOrganizationSettingsColumn('seal_file_name', 'VARCHAR(255) NULL AFTER seal_image_url');
  await ensureOrganizationSettingsColumn('seal_storage_key', 'VARCHAR(255) NULL AFTER seal_file_name');
  await ensureOrganizationSettingsColumn('seal_updated_at', 'DATETIME(3) NULL AFTER seal_storage_key');
  await pool.execute(`
    INSERT INTO organization_settings (id, root_name)
    VALUES (1, 'AICC 본부')
    ON DUPLICATE KEY UPDATE root_name = root_name
  `);
}

async function ensureOrganizationSettingsColumn(columnName: string, definition: string) {
  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'organization_settings'
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [columnName],
  );
  if (rows.length > 0) return;
  await pool.execute(`ALTER TABLE organization_settings ADD COLUMN ${columnName} ${definition}`);
}

export async function getOrganizationSettings() {
  await ensureOrganizationSettingsTable();
  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>('SELECT root_name FROM organization_settings WHERE id = 1 LIMIT 1');
  return {
    rootName: rows[0]?.root_name ? String(rows[0].root_name) : 'AICC 본부',
  };
}

export async function updateOrganizationRootName(rootName: string) {
  const nextName = rootName.trim();
  if (!nextName) throw new Error('ROOT명을 입력해 주세요.');
  if (nextName.length > 100) throw new Error('ROOT명은 100자 이하로 입력해 주세요.');
  await ensureOrganizationSettingsTable();
  const pool = getMysqlPool();
  await pool.execute(
    `
      INSERT INTO organization_settings (id, root_name)
      VALUES (1, ?)
      ON DUPLICATE KEY UPDATE root_name = VALUES(root_name)
    `,
    [nextName],
  );
  return getOrganizationSettings();
}

export async function getOrganizationSeal() {
  await ensureOrganizationSettingsTable();
  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT seal_image_url, seal_file_name, seal_storage_key, seal_updated_at FROM organization_settings WHERE id = 1 LIMIT 1',
  );
  const row = rows[0];
  return {
    sealImageUrl: row?.seal_image_url ? String(row.seal_image_url) : '',
    sealFileName: row?.seal_file_name ? String(row.seal_file_name) : '',
    sealStorageKey: row?.seal_storage_key ? String(row.seal_storage_key) : '',
    sealUpdatedAt: toIso(row?.seal_updated_at ?? null),
  };
}

export async function updateOrganizationSeal(input: { imageUrl: string; fileName: string; storageKey?: string | null }) {
  const imageUrl = input.imageUrl.trim();
  const fileName = input.fileName.trim();
  if (!imageUrl) throw new Error('전자직인 이미지를 선택해 주세요.');
  if (!fileName) throw new Error('전자직인 파일명을 확인해 주세요.');
  if (imageUrl.length > 1_200_000) throw new Error('전자직인 이미지는 900KB 이하 PNG 파일을 권장합니다.');

  await ensureOrganizationSettingsTable();
  const pool = getMysqlPool();
  await pool.execute(
    `
      INSERT INTO organization_settings (id, root_name, seal_image_url, seal_file_name, seal_storage_key, seal_updated_at)
      VALUES (1, 'AICC 본부', ?, ?, ?, NOW(3))
      ON DUPLICATE KEY UPDATE
        seal_image_url = VALUES(seal_image_url),
        seal_file_name = VALUES(seal_file_name),
        seal_storage_key = VALUES(seal_storage_key),
        seal_updated_at = VALUES(seal_updated_at)
    `,
    [imageUrl, fileName, input.storageKey?.trim() || null],
  );
  return getOrganizationSeal();
}

export async function deleteOrganizationSeal() {
  await ensureOrganizationSettingsTable();
  const pool = getMysqlPool();
  await pool.execute(
    `
      UPDATE organization_settings
      SET seal_image_url = NULL,
        seal_file_name = NULL,
        seal_storage_key = NULL,
        seal_updated_at = NULL
      WHERE id = 1
    `,
  );
  return getOrganizationSeal();
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
  const settings = await getOrganizationSettings();
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT
        t.id AS team_id, t.name AS team_name, t.head_user_id, head.name AS head_name,
        u.id AS user_id, u.name AS user_name, u.email, u.role, u.status,
        ep.position, ep.employment_type, ep.hire_date, ep.years_of_service
      FROM teams t
      LEFT JOIN users head ON head.id = t.head_user_id
      LEFT JOIN employee_profiles ep ON ep.team_id = t.id
      LEFT JOIN users u ON u.id = ep.user_id
      ORDER BY t.name ASC, FIELD(u.role, 'HEAD', 'ADMIN', 'OPERATOR', 'VIEWER'), u.name ASC
    `,
  );

  const teams = new Map<string, { id: string; name: string; headUserId?: string | null; headName: string; members: Array<Record<string, unknown>> }>();
  for (const row of rows) {
    const id = String(row.team_id);
    if (!teams.has(id)) {
      teams.set(id, { id, name: String(row.team_name), headName: row.head_name ? String(row.head_name) : '미지정', members: [] });
    }
    teams.get(id)!.headUserId = row.head_user_id ? String(row.head_user_id) : null;
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
    rootName: settings.rootName,
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
      ORDER BY used_leave_days DESC, request_count DESC
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

export async function getApprovalDocumentDetail(user: AuthUser, id: string) {
  const pool = getMysqlPool();
  const params: unknown[] = [id];
  const scope =
    user.role === 'HEAD' || user.role === 'ADMIN'
      ? ''
      : "AND (lr.requester_id = ? OR EXISTS (SELECT 1 FROM approval_steps access_aps WHERE access_aps.target_type = 'LEAVE_REQUEST' AND access_aps.target_id = lr.id AND access_aps.approver_id = ?))";
  if (scope) params.push(user.id, user.id);

  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT lr.id, lr.request_type, lr.status, lr.start_date, lr.end_date, lr.reason, lr.created_at, lr.updated_at,
        requester.name AS requester_name, requester.email AS requester_email, COALESCE(t.name, '팀 미지정') AS team_name
      FROM leave_requests lr
      JOIN users requester ON requester.id = lr.requester_id
      LEFT JOIN teams t ON t.id = lr.team_id
      WHERE lr.id = ?
      ${scope}
      LIMIT 1
    `,
    params,
  );
  const row = rows[0];
  if (!row) return null;

  const [stepRows] = await pool.query<RowDataPacket[]>(
    `
      SELECT aps.id, aps.step_order, aps.status, aps.comment, aps.decided_at, aps.created_at,
        approver.name AS approver_name, approver.email AS approver_email
      FROM approval_steps aps
      JOIN users approver ON approver.id = aps.approver_id
      WHERE aps.target_type = 'LEAVE_REQUEST' AND aps.target_id = ?
      ORDER BY aps.step_order ASC
    `,
    [id],
  );

  return {
    id: String(row.id),
    requestType: String(row.request_type),
    status: String(row.status),
    requesterName: String(row.requester_name),
    requesterEmail: String(row.requester_email),
    teamName: String(row.team_name),
    startDate: toDateOnly(row.start_date),
    endDate: toDateOnly(row.end_date),
    reason: row.reason ? String(row.reason) : '-',
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
    steps: stepRows.map((step) => ({
      id: String(step.id),
      order: Number(step.step_order ?? 1),
      status: String(step.status),
      comment: step.comment ? String(step.comment) : null,
      decidedAt: toIso(step.decided_at),
      createdAt: toIso(step.created_at) ?? new Date().toISOString(),
      approverName: String(step.approver_name),
      approverEmail: String(step.approver_email),
    })),
  };
}

type DashboardTeamScope = {
  teamIds?: string[];
};

function buildTeamTargetScope(alias: string, teamIds?: string[]) {
  if (!teamIds?.length) return { sql: '', params: [] as unknown[] };
  const placeholders = teamIds.map(() => '?').join(', ');
  return {
    sql: `
      AND EXISTS (
        SELECT 1
        FROM leave_requests scoped_lr
        WHERE ${alias}.target_type = 'LEAVE_REQUEST'
          AND scoped_lr.id = ${alias}.target_id
          AND scoped_lr.team_id IN (${placeholders})
        UNION ALL
        SELECT 1
        FROM trip_expense_requests scoped_ter
        WHERE ${alias}.target_type = 'TRIP_EXPENSE'
          AND scoped_ter.id = ${alias}.target_id
          AND scoped_ter.team_id IN (${placeholders})
      )
    `,
    params: [...teamIds, ...teamIds],
  };
}

function buildTeamColumnScope(column: string, teamIds?: string[]) {
  if (!teamIds?.length) return { sql: '', params: [] as unknown[] };
  const placeholders = teamIds.map(() => '?').join(', ');
  return {
    sql: `AND ${column} IN (${placeholders})`,
    params: teamIds,
  };
}

export async function getDashboardErpSummary(user: AuthUser, scope: DashboardTeamScope = {}) {
  const pool = getMysqlPool();
  const approvalScope = user.role === 'HEAD' || user.role === 'ADMIN' ? '' : 'AND aps.approver_id = ?';
  const approvalParams = user.role === 'HEAD' || user.role === 'ADMIN' ? [] : [user.id];
  const approvalTeamScope = buildTeamTargetScope('aps', scope.teamIds);
  const settlementTeamScope = buildTeamColumnScope('team_id', scope.teamIds);
  const leaveTeamScope = buildTeamColumnScope('team_id', scope.teamIds);
  const [approvalRows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COUNT(*) AS count
      FROM approval_steps aps
      WHERE aps.status = 'PENDING'
        AND NOT EXISTS (
          SELECT 1
          FROM approval_steps prev
          WHERE prev.target_type = aps.target_type
            AND prev.target_id = aps.target_id
            AND prev.step_order < aps.step_order
            AND prev.status <> 'APPROVED'
        )
        ${approvalScope}
        ${approvalTeamScope.sql}
    `,
    [...approvalParams, ...approvalTeamScope.params],
  );
  const [notificationRows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL',
    [user.id],
  );
  const [settlementRows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS amount
      FROM trip_expense_requests
      WHERE status = 'APPROVED' AND settlement_status = 'PENDING'
        ${settlementTeamScope.sql}
    `,
    settlementTeamScope.params,
  );
  const [leaveRows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COUNT(*) AS count
      FROM leave_requests
      WHERE YEAR(start_date) = YEAR(CURDATE())
        ${leaveTeamScope.sql}
    `,
    leaveTeamScope.params,
  );
  const [auditRows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COUNT(*) AS count
      FROM security_audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `,
  );

  return {
    pendingApprovals: Number(approvalRows[0]?.count ?? 0),
    unreadNotifications: Number(notificationRows[0]?.count ?? 0),
    pendingSettlements: Number(settlementRows[0]?.count ?? 0),
    pendingSettlementAmount: Number(settlementRows[0]?.amount ?? 0),
    yearlyLeaveRequests: Number(leaveRows[0]?.count ?? 0),
    recentAuditLogs: Number(auditRows[0]?.count ?? 0),
  };
}

export async function getDashboardActivityHeatmap(scope: DashboardTeamScope = {}) {
  const pool = getMysqlPool();
  const leaveTeamScope = buildTeamColumnScope('team_id', scope.teamIds);
  const approvalTeamScope = buildTeamTargetScope('aps', scope.teamIds);
  const expenseTeamScope = buildTeamColumnScope('team_id', scope.teamIds);
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT activity_date, activity_type, SUM(activity_count) AS count
      FROM (
        SELECT DATE(start_date) AS activity_date, 'leave' AS activity_type, COUNT(*) AS activity_count
        FROM leave_requests
        WHERE start_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND start_date < DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 1 DAY)
          ${leaveTeamScope.sql}
        GROUP BY DATE(start_date)

        UNION ALL

        SELECT DATE(created_at) AS activity_date, 'approval' AS activity_type, COUNT(*) AS activity_count
        FROM approval_steps aps
        WHERE aps.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND aps.created_at < DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 1 DAY)
          ${approvalTeamScope.sql}
        GROUP BY DATE(aps.created_at)

        UNION ALL

        SELECT DATE(starts_at) AS activity_date, 'reservation' AS activity_type, COUNT(*) AS activity_count
        FROM meeting_reservations
        WHERE starts_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND starts_at < DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 1 DAY)
          AND status <> 'CANCELLED'
          AND ${scope.teamIds?.length ? '1 = 0' : '1 = 1'}
        GROUP BY DATE(starts_at)

        UNION ALL

        SELECT DATE(created_at) AS activity_date, 'expense' AS activity_type, COUNT(*) AS activity_count
        FROM trip_expense_requests
        WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND created_at < DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 1 DAY)
          ${expenseTeamScope.sql}
        GROUP BY DATE(created_at)
      ) activities
      GROUP BY activity_date, activity_type
      ORDER BY activity_date ASC, activity_type ASC
    `,
    [...leaveTeamScope.params, ...approvalTeamScope.params, ...expenseTeamScope.params],
  );

  return rows.map((row) => ({
    date: toDateOnly(row.activity_date) ?? '',
    type: String(row.activity_type),
    count: Number(row.count ?? 0),
  }));
}
