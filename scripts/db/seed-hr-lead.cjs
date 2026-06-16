/* eslint-disable @typescript-eslint/no-require-imports */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { getMysqlConfig, loadLocalEnv } = require('./env.cjs');

async function main() {
  loadLocalEnv(process.cwd());
  const connection = await mysql.createConnection(getMysqlConfig());

  const headId = '8bc34f0a-1f66-4269-b805-8b9187ae9939';
  const testUserId = '9f5a0a68-6f7f-4de7-9c54-1c18c40f2d01';
  const businessTeamId = '58d314c2-dd6b-4bd9-a825-4779c8105cad';
  const hrLeadId = '3c9374c3-1e51-4b52-99f3-cb2aa94f2e11';
  const hrTeamId = '31d6abdf-d44c-4b5b-8c42-65a6fb9370e8';
  const pendingExpenseId = 'texp-pending-20260615-0001';
  const hrApprovalStepId = 'appr-texp-20260615-hr-final';
  const approvedTripId = 'btrip-settlement-ready-20260615';
  const approvedExpenseId = 'texp-settlement-ready-20260615';
  const passwordHash = await bcrypt.hash('new123!@', 12);

  await connection.beginTransaction();
  try {
    await connection.execute(
      `
        INSERT INTO users (id, email, password_hash, force_password_change, name, role, status, approved_by, approved_at)
        VALUES (?, 'hr.chunbong@aicc.local', ?, FALSE, '춘봉이', 'OPERATOR', 'APPROVED', ?, CURRENT_TIMESTAMP(3))
        ON DUPLICATE KEY UPDATE
          password_hash = VALUES(password_hash),
          force_password_change = FALSE,
          name = VALUES(name),
          role = 'OPERATOR',
          status = 'APPROVED',
          approved_by = VALUES(approved_by),
          approved_at = COALESCE(approved_at, VALUES(approved_at))
      `,
      [hrLeadId, passwordHash, headId],
    );

    await connection.execute(
      `
        INSERT INTO teams (id, name, head_user_id)
        VALUES (?, '인사팀', ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          head_user_id = VALUES(head_user_id)
      `,
      [hrTeamId, hrLeadId],
    );

    await connection.execute(
      `
        INSERT INTO employee_profiles (user_id, team_id, position, employment_type, hire_date, years_of_service)
        VALUES (?, ?, 'MANAGER', 'P', '2021-01-04', 5)
        ON DUPLICATE KEY UPDATE
          team_id = VALUES(team_id),
          position = VALUES(position),
          employment_type = VALUES(employment_type),
          hire_date = VALUES(hire_date),
          years_of_service = VALUES(years_of_service)
      `,
      [hrLeadId, hrTeamId],
    );

    await connection.execute(
      `
        INSERT INTO approval_steps (id, target_type, target_id, step_order, approver_id, status)
        VALUES (?, 'TRIP_EXPENSE', ?, 2, ?, 'PENDING')
        ON DUPLICATE KEY UPDATE
          approver_id = VALUES(approver_id),
          status = CASE WHEN status = 'APPROVED' THEN status ELSE 'PENDING' END
      `,
      [hrApprovalStepId, pendingExpenseId, hrLeadId],
    );

    await connection.execute(
      `
        INSERT INTO leave_requests (id, requester_id, team_id, request_type, start_date, end_date, half_day, reason, status)
        VALUES (?, ?, ?, 'BUSINESS_TRIP', '2026-06-05', '2026-06-05', NULL, ?, 'APPROVED')
        ON DUPLICATE KEY UPDATE
          status = 'APPROVED',
          reason = VALUES(reason),
          start_date = VALUES(start_date),
          end_date = VALUES(end_date)
      `,
      [
        approvedTripId,
        testUserId,
        businessTeamId,
        'ㅇ 날짜 : 2026-06-05\nㅇ 목적 : 정산 권한 테스트\nㅇ 장소 : 대전 고객센터',
      ],
    );

    await connection.execute(
      `
        INSERT INTO trip_expense_requests (
          id, business_trip_request_id, requester_id, team_id, origin, destination, trip_scope, transport_type,
          train_fare_amount, car_depreciation_amount, other_amount, lodging_nights,
          daily_allowance_amount, lodging_amount, total_amount, memo, status, settlement_status
        )
        VALUES (?, ?, ?, ?, '서울역', '대전역', 'OUT_CITY', 'TRAIN', 42000, 0, 8000, 0, 50000, 0, 100000, ?, 'APPROVED', 'PENDING')
        ON DUPLICATE KEY UPDATE
          status = 'APPROVED',
          settlement_status = 'PENDING',
          total_amount = VALUES(total_amount),
          memo = VALUES(memo)
      `,
      [approvedExpenseId, approvedTripId, testUserId, businessTeamId, '인사팀 팀장 정산 권한 확인용 승인 완료 출장여비입니다.'],
    );

    await connection.execute(
      `
        INSERT INTO user_team_memberships (user_id, team_id, team_role)
        VALUES (?, ?, 'HEAD')
        ON DUPLICATE KEY UPDATE team_role = 'HEAD'
      `,
      [hrLeadId, hrTeamId],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }

  const [rows] = await connection.query(
    `
      SELECT u.name, u.email, u.role, t.name AS team_name, m.team_role
      FROM users u
      JOIN user_team_memberships m ON m.user_id = u.id
      JOIN teams t ON t.id = m.team_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [hrLeadId],
  );

  const [expenses] = await connection.query(
    `
      SELECT id, status, settlement_status
      FROM trip_expense_requests
      WHERE id IN (?, ?)
      ORDER BY id
    `,
    [pendingExpenseId, approvedExpenseId],
  );

  console.log(JSON.stringify({ hrLead: rows[0], expenses }, null, 2));
  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
