/* eslint-disable @typescript-eslint/no-require-imports */
const { randomUUID } = require('crypto');
const mysql = require('mysql2/promise');
const { getMysqlConfig, loadLocalEnv } = require('./env.cjs');

async function main() {
  loadLocalEnv(process.cwd());
  const connection = await mysql.createConnection(getMysqlConfig());

  const headId = '8bc34f0a-1f66-4269-b805-8b9187ae9939';
  const teamId = '58d314c2-dd6b-4bd9-a825-4779c8105cad';
  const testUserId = '9f5a0a68-6f7f-4de7-9c54-1c18c40f2d01';
  const eligibleTripId = 'btrip-eligible-20260615-0001';
  const pendingTripId = 'btrip-expense-20260615-0001';
  const expenseId = 'texp-pending-20260615-0001';
  const stepId = 'appr-texp-20260615-0001';

  await connection.beginTransaction();
  try {
    await connection.execute(
      `
        INSERT INTO users (id, email, password_hash, name, role, status, approved_by, approved_at)
        VALUES (?, 'test.employee@aicc.local', 'local-test-login-disabled', '테스트 사원', 'OPERATOR', 'APPROVED', ?, CURRENT_TIMESTAMP(3))
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          role = 'OPERATOR',
          status = 'APPROVED'
      `,
      [testUserId, headId],
    );

    await connection.execute(
      `
        INSERT INTO employee_profiles (user_id, team_id, position, employment_type, hire_date, years_of_service)
        VALUES (?, ?, 'STAFF', 'P', '2024-01-02', 2)
        ON DUPLICATE KEY UPDATE
          team_id = VALUES(team_id),
          position = VALUES(position),
          employment_type = VALUES(employment_type),
          hire_date = VALUES(hire_date),
          years_of_service = VALUES(years_of_service)
      `,
      [testUserId, teamId],
    );

    await connection.execute(
      `
        INSERT INTO user_team_memberships (user_id, team_id, team_role)
        VALUES (?, ?, 'MEMBER')
        ON DUPLICATE KEY UPDATE team_role = 'MEMBER'
      `,
      [testUserId, teamId],
    );

    await connection.execute(
      `
        INSERT INTO leave_requests (id, requester_id, team_id, request_type, start_date, end_date, half_day, reason, status)
        VALUES (?, ?, ?, 'BUSINESS_TRIP', '2026-06-03', '2026-06-03', NULL, ?, 'APPROVED')
        ON DUPLICATE KEY UPDATE
          status = 'APPROVED',
          reason = VALUES(reason),
          start_date = VALUES(start_date),
          end_date = VALUES(end_date)
      `,
      [
        eligibleTripId,
        headId,
        teamId,
        'ㅇ 날짜 : 2026-06-03\nㅇ 목적 : 부산 고객사 AICC 구축 회의\nㅇ 장소 : 부산 센텀 고객센터',
      ],
    );

    await connection.execute(
      `
        INSERT INTO leave_requests (id, requester_id, team_id, request_type, start_date, end_date, half_day, reason, status)
        VALUES (?, ?, ?, 'BUSINESS_TRIP', '2026-06-04', '2026-06-04', NULL, ?, 'APPROVED')
        ON DUPLICATE KEY UPDATE
          status = 'APPROVED',
          reason = VALUES(reason),
          start_date = VALUES(start_date),
          end_date = VALUES(end_date)
      `,
      [
        pendingTripId,
        testUserId,
        teamId,
        'ㅇ 날짜 : 2026-06-04\nㅇ 목적 : 금융권 상담 품질 점검 미팅\nㅇ 장소 : 대전 고객센터',
      ],
    );

    await connection.execute(
      `
        INSERT INTO trip_expense_requests (
          id, business_trip_request_id, requester_id, team_id, origin, destination, trip_scope, transport_type,
          train_fare_amount, car_depreciation_amount, other_amount, lodging_nights,
          daily_allowance_amount, lodging_amount, total_amount, memo, status, settlement_status
        )
        VALUES (?, ?, ?, ?, '서울역', '대전역', 'OUT_CITY', 'TRAIN', 42000, 0, 8000, 0, 50000, 0, 100000, ?, 'PENDING', 'PENDING')
        ON DUPLICATE KEY UPDATE
          status = 'PENDING',
          settlement_status = 'PENDING',
          total_amount = VALUES(total_amount),
          memo = VALUES(memo)
      `,
      [expenseId, pendingTripId, testUserId, teamId, '테스트용 출장여비 결재 대기 건입니다.'],
    );

    await connection.execute(
      `
        INSERT INTO approval_steps (id, target_type, target_id, step_order, approver_id, status)
        VALUES (?, 'TRIP_EXPENSE', ?, 1, ?, 'PENDING')
        ON DUPLICATE KEY UPDATE
          approver_id = VALUES(approver_id),
          status = 'PENDING',
          comment = NULL,
          decided_at = NULL
      `,
      [stepId, expenseId, headId],
    );

    await connection.execute(
      `
        INSERT INTO notifications (id, user_id, type, title, message, target_type, target_id)
        VALUES (?, ?, 'APPROVAL_REQUESTED', '출장여비 결재 요청', '테스트 사원의 서울역 - 대전역 출장여비 결재가 요청되었습니다.', 'TRIP_EXPENSE', ?)
      `,
      [randomUUID(), headId, expenseId],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }

  const [summary] = await connection.query(
    `
      SELECT 'eligibleTrips' AS name, COUNT(1) AS count
      FROM leave_requests lr
      LEFT JOIN trip_expense_requests ter ON ter.business_trip_request_id = lr.id
      WHERE lr.requester_id = ?
        AND lr.request_type = 'BUSINESS_TRIP'
        AND lr.status = 'APPROVED'
        AND lr.end_date < CURDATE()
        AND ter.id IS NULL
      UNION ALL
      SELECT 'tripExpenses', COUNT(1) FROM trip_expense_requests
      UNION ALL
      SELECT 'pendingApprovals', COUNT(1) FROM approval_steps WHERE status = 'PENDING'
    `,
    [headId],
  );

  console.log(JSON.stringify(summary, null, 2));
  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
