import { randomUUID } from 'crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

import type { AuthUser } from './users';
import { getMysqlPool } from './mysql';
import { createSecurityAuditLog } from './securityAudit';
import { canSettleTripExpenses } from '../auth/authorization';
import type { EligibleBusinessTrip, TransportType, TripExpenseAttachment, TripExpenseRequest, TripScope } from '../types/tripExpense';

type EligibleTripRow = RowDataPacket & {
  id: string;
  start_date: Date | string;
  end_date: Date | string;
  requester_name: string;
  team_name: string | null;
  reason: string | null;
};

type TripExpenseRow = RowDataPacket & {
  id: string;
  business_trip_request_id: string;
  requester_id: string;
  requester_name: string;
  team_id: string | null;
  team_name: string | null;
  origin: string;
  destination: string;
  trip_scope: TripScope;
  transport_type: TransportType;
  train_fare_amount: string | number;
  car_depreciation_amount: string | number;
  other_amount: string | number;
  lodging_nights: string | number;
  daily_allowance_amount: string | number;
  lodging_amount: string | number;
  total_amount: string | number;
  memo: string | null;
  status: TripExpenseRequest['status'];
  settlement_status: TripExpenseRequest['settlementStatus'];
  settled_by_name: string | null;
  settled_at: Date | string | null;
  payment_date: Date | string | null;
  payment_account: string | null;
  settlement_memo: string | null;
  approver_name: string | null;
  approval_step_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type TripExpenseAttachmentRow = RowDataPacket & {
  id: string;
  trip_expense_request_id: string;
  storage_provider: TripExpenseAttachment['storageProvider'];
  storage_key: string;
  original_filename: string;
  mime_type: string;
  file_size: string | number;
  created_at: Date | string;
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

function mapEligibleTrip(row: EligibleTripRow): EligibleBusinessTrip {
  return {
    id: row.id,
    startDate: toDateOnly(row.start_date),
    endDate: toDateOnly(row.end_date),
    requesterName: row.requester_name,
    teamName: row.team_name,
    reason: row.reason,
  };
}

function mapTripExpense(row: TripExpenseRow): TripExpenseRequest {
  return {
    id: row.id,
    businessTripRequestId: row.business_trip_request_id,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    teamId: row.team_id,
    teamName: row.team_name,
    origin: row.origin,
    destination: row.destination,
    tripScope: row.trip_scope,
    transportType: row.transport_type,
    trainFareAmount: Number(row.train_fare_amount ?? 0),
    carDepreciationAmount: Number(row.car_depreciation_amount ?? 0),
    otherAmount: Number(row.other_amount ?? 0),
    lodgingNights: Number(row.lodging_nights ?? 0),
    dailyAllowanceAmount: Number(row.daily_allowance_amount ?? 0),
    lodgingAmount: Number(row.lodging_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    memo: row.memo,
    status: row.status,
    settlementStatus: row.settlement_status ?? 'PENDING',
    settledByName: row.settled_by_name,
    settledAt: toIso(row.settled_at),
    paymentDate: row.payment_date == null ? null : toDateOnly(row.payment_date),
    paymentAccount: row.payment_account,
    settlementMemo: row.settlement_memo,
    approverName: row.approver_name,
    approvalStepId: row.approval_step_id,
    attachments: [],
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function mapAttachment(row: TripExpenseAttachmentRow): TripExpenseAttachment {
  return {
    id: row.id,
    storageProvider: row.storage_provider,
    storageKey: row.storage_key,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size ?? 0),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

async function createNotification(input: {
  userId: string;
  type: 'APPROVAL_REQUESTED' | 'APPROVAL_APPROVED' | 'APPROVAL_REJECTED' | 'REQUEST_CANCELLED' | 'SYSTEM';
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

export async function listEligibleBusinessTrips(user: AuthUser) {
  const pool = getMysqlPool();
  const [rows] = await pool.query<EligibleTripRow[]>(
    `
      SELECT lr.id, lr.start_date, lr.end_date, requester.name AS requester_name, t.name AS team_name, lr.reason
      FROM leave_requests lr
      JOIN users requester ON requester.id = lr.requester_id
      LEFT JOIN teams t ON t.id = lr.team_id
      LEFT JOIN trip_expense_requests ter ON ter.business_trip_request_id = lr.id
      WHERE lr.requester_id = ?
        AND lr.request_type = 'BUSINESS_TRIP'
        AND lr.status = 'APPROVED'
        AND lr.end_date < CURDATE()
        AND ter.id IS NULL
      ORDER BY lr.end_date DESC
    `,
    [user.id],
  );
  return rows.map(mapEligibleTrip);
}

export async function listTripExpenseRequests(user: AuthUser) {
  const pool = getMysqlPool();
  const params: unknown[] = [];
  const where: string[] = [];
  const canSettle = await canSettleTripExpenses(user);

  if (!canSettle) {
    where.push(
      `(ter.requester_id = ? OR EXISTS (
        SELECT 1
        FROM approval_steps access_aps
        WHERE access_aps.target_type = 'TRIP_EXPENSE'
          AND access_aps.target_id = ter.id
          AND access_aps.approver_id = ?
      ))`,
    );
    params.push(user.id, user.id);
  }

  const [rows] = await pool.query<TripExpenseRow[]>(
    `
      SELECT
        ter.id, ter.business_trip_request_id, ter.requester_id, requester.name AS requester_name,
        ter.team_id, t.name AS team_name, ter.origin, ter.destination, ter.trip_scope, ter.transport_type,
        ter.train_fare_amount, ter.car_depreciation_amount, ter.other_amount,
        ter.lodging_nights, ter.daily_allowance_amount, ter.lodging_amount, ter.total_amount,
        ter.memo, ter.status, ter.settlement_status, settled_user.name AS settled_by_name,
        ter.settled_at, ter.payment_date, ter.payment_account, ter.settlement_memo,
        approver.name AS approver_name, aps.id AS approval_step_id,
        ter.created_at, ter.updated_at
      FROM trip_expense_requests ter
      JOIN users requester ON requester.id = ter.requester_id
      LEFT JOIN teams t ON t.id = ter.team_id
      LEFT JOIN approval_steps aps
        ON aps.target_type = 'TRIP_EXPENSE'
       AND aps.target_id = ter.id
       AND aps.status = 'PENDING'
       AND NOT EXISTS (
         SELECT 1
         FROM approval_steps prev
         WHERE prev.target_type = aps.target_type
           AND prev.target_id = aps.target_id
           AND prev.step_order < aps.step_order
           AND prev.status <> 'APPROVED'
      )
      LEFT JOIN users approver ON approver.id = aps.approver_id
      LEFT JOIN users settled_user ON settled_user.id = ter.settled_by
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ter.created_at DESC
    `,
    params,
  );
  const items = rows.map(mapTripExpense);
  if (items.length === 0) return items;

  const [attachmentRows] = await pool.query<TripExpenseAttachmentRow[]>(
    `
      SELECT id, trip_expense_request_id, storage_provider, storage_key, original_filename, mime_type, file_size, created_at
      FROM trip_expense_attachments
      WHERE trip_expense_request_id IN (${items.map(() => '?').join(', ')})
      ORDER BY created_at ASC
    `,
    items.map((item) => item.id),
  );
  const attachmentsByRequest = new Map<string, TripExpenseAttachment[]>();
  for (const row of attachmentRows) {
    const list = attachmentsByRequest.get(row.trip_expense_request_id) ?? [];
    list.push(mapAttachment(row));
    attachmentsByRequest.set(row.trip_expense_request_id, list);
  }

  return items.map((item) => ({ ...item, attachments: attachmentsByRequest.get(item.id) ?? [] }));
}

export async function settleTripExpenseRequest(input: {
  user: AuthUser;
  id: string;
  paymentDate: string;
  paymentAccount?: string;
  settlementMemo?: string;
}) {
  if (!(await canSettleTripExpenses(input.user))) {
    throw new Error('출장여비 정산은 관리자 또는 인사팀 팀장만 처리할 수 있습니다.');
  }

  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT id, requester_id, status, settlement_status, total_amount
      FROM trip_expense_requests
      WHERE id = ?
      LIMIT 1
    `,
    [input.id],
  );
  const current = rows[0];
  if (!current) throw new Error('출장여비 신청을 찾지 못했습니다.');
  if (current.status !== 'APPROVED') throw new Error('승인 완료된 출장여비만 정산 처리할 수 있습니다.');

  await pool.execute(
    `
      UPDATE trip_expense_requests
      SET settlement_status = 'PAID',
          settled_by = ?,
          settled_at = CURRENT_TIMESTAMP(3),
          payment_date = ?,
          payment_account = ?,
          settlement_memo = ?
      WHERE id = ?
    `,
    [input.user.id, input.paymentDate, input.paymentAccount?.trim() || null, input.settlementMemo?.trim() || null, input.id],
  );

  await createSecurityAuditLog({
    actorId: input.user.id,
    targetUserId: String(current.requester_id),
    action: 'TRIP_EXPENSE_SETTLED',
    details: {
      tripExpenseRequestId: input.id,
      totalAmount: Number(current.total_amount ?? 0),
      paymentDate: input.paymentDate,
      paymentAccount: input.paymentAccount?.trim() || null,
      settlementMemo: input.settlementMemo?.trim() || null,
    },
  });

  await createNotification({
    userId: String(current.requester_id),
    type: 'SYSTEM',
    title: '출장여비 정산 완료',
    message: `출장여비 ${Number(current.total_amount ?? 0).toLocaleString()}원이 정산 완료되었습니다.`,
    targetType: 'TRIP_EXPENSE',
    targetId: input.id,
  });
}

async function findHrFinalApproverId(connection: PoolConnection) {
  const [hrRows] = await connection.query<RowDataPacket[]>(
    `
      SELECT t.id, t.name, COALESCE(t.head_user_id, team_head.user_id) AS approver_id
      FROM teams t
      LEFT JOIN user_team_memberships team_head ON team_head.team_id = t.id AND team_head.team_role = 'HEAD'
      WHERE t.name IN ('인사팀', 'HR', 'Human Resources')
      ORDER BY FIELD(t.name, '인사팀', 'HR', 'Human Resources'), t.created_at ASC
    `,
  );
  const hrTeamWithApprover = hrRows.find((row) => row.approver_id);
  if (hrTeamWithApprover?.approver_id) return String(hrTeamWithApprover.approver_id);
  if (hrRows.length > 0) {
    throw new Error('출장여비 최종 결재를 받을 인사팀 팀장을 먼저 지정해 주세요.');
  }

  const [fallbackRows] = await connection.query<RowDataPacket[]>(
    `
      SELECT id
      FROM users
      WHERE status = 'APPROVED' AND role IN ('ADMIN', 'HEAD')
      ORDER BY FIELD(role, 'ADMIN', 'HEAD'), created_at ASC
      LIMIT 1
    `,
  );
  return fallbackRows[0]?.id ? String(fallbackRows[0].id) : null;
}

export async function createTripExpenseRequest(input: {
  user: AuthUser;
  businessTripRequestId: string;
  origin: string;
  destination: string;
  tripScope: TripScope;
  transportType: TransportType;
  trainFareAmount: number;
  carDepreciationAmount: number;
  otherAmount: number;
  lodgingNights: number;
  memo?: string;
}) {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();
  const id = randomUUID();
  const approvalStepId = randomUUID();
  const hrApprovalStepId = randomUUID();
  const dailyAllowanceAmount = input.tripScope === 'OUT_CITY' ? 50_000 : 30_000;
  const lodgingNights = Math.max(0, Math.floor(Number(input.lodgingNights || 0)));
  const lodgingAmount = lodgingNights * 150_000;
  const totalAmount = input.trainFareAmount + input.carDepreciationAmount + input.otherAmount + dailyAllowanceAmount + lodgingAmount;

  try {
    await connection.beginTransaction();

    const [trips] = await connection.query<RowDataPacket[]>(
      `
        SELECT
          lr.id,
          lr.requester_id,
          lr.team_id,
          COALESCE(t.head_user_id, team_head.user_id, head_user.id, lr.requester_id) AS approver_id
        FROM leave_requests lr
        LEFT JOIN teams t ON t.id = lr.team_id
        LEFT JOIN user_team_memberships team_head ON team_head.team_id = lr.team_id AND team_head.team_role = 'HEAD'
        LEFT JOIN users head_user ON head_user.role = 'HEAD' AND head_user.status = 'APPROVED'
        LEFT JOIN trip_expense_requests ter ON ter.business_trip_request_id = lr.id
        WHERE lr.id = ?
          AND lr.requester_id = ?
          AND lr.request_type = 'BUSINESS_TRIP'
          AND lr.status = 'APPROVED'
          AND lr.end_date < CURDATE()
          AND ter.id IS NULL
        ORDER BY
          CASE
            WHEN t.head_user_id IS NOT NULL THEN 1
            WHEN team_head.user_id IS NOT NULL THEN 2
            WHEN head_user.id IS NOT NULL THEN 3
            ELSE 4
          END
        LIMIT 1
      `,
      [input.businessTripRequestId, input.user.id],
    );
    const trip = trips[0];
    if (!trip) throw new Error('여비 신청 가능한 승인 완료 출장 건을 찾지 못했습니다.');
    const firstApproverId = String(trip.approver_id || input.user.id);
    const hrApproverId = await findHrFinalApproverId(connection);

    await connection.execute(
      `
        INSERT INTO trip_expense_requests (
          id, business_trip_request_id, requester_id, team_id, origin, destination, trip_scope, transport_type,
          train_fare_amount, car_depreciation_amount, other_amount, lodging_nights,
          daily_allowance_amount, lodging_amount, total_amount, memo, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `,
      [
        id,
        input.businessTripRequestId,
        input.user.id,
        trip.team_id ?? null,
        input.origin,
        input.destination,
        input.tripScope,
        input.transportType,
        input.trainFareAmount,
        input.carDepreciationAmount,
        input.otherAmount,
        lodgingNights,
        dailyAllowanceAmount,
        lodgingAmount,
        totalAmount,
        input.memo?.trim() || null,
      ],
    );

    await connection.execute(
      `
        INSERT INTO approval_steps (id, target_type, target_id, step_order, approver_id, status)
        VALUES (?, 'TRIP_EXPENSE', ?, 1, ?, 'PENDING')
      `,
      [approvalStepId, id, firstApproverId],
    );

    if (hrApproverId && hrApproverId !== firstApproverId) {
      await connection.execute(
        `
          INSERT INTO approval_steps (id, target_type, target_id, step_order, approver_id, status)
          VALUES (?, 'TRIP_EXPENSE', ?, 2, ?, 'PENDING')
        `,
        [hrApprovalStepId, id, hrApproverId],
      );
    }

    await connection.commit();
    await createNotification({
      userId: firstApproverId,
      type: 'APPROVAL_REQUESTED',
      title: '출장여비 결재 요청',
      message: `${input.origin} - ${input.destination} 출장여비 결재가 요청되었습니다.`,
      targetType: 'TRIP_EXPENSE',
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

export async function canAccessTripExpenseRequest(user: AuthUser, tripExpenseRequestId: string) {
  if (await canSettleTripExpenses(user)) return true;

  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT ter.id
      FROM trip_expense_requests ter
      LEFT JOIN approval_steps aps ON aps.target_type = 'TRIP_EXPENSE' AND aps.target_id = ter.id AND aps.step_order = 1
      WHERE ter.id = ?
        AND (ter.requester_id = ? OR aps.approver_id = ?)
      LIMIT 1
    `,
    [tripExpenseRequestId, user.id, user.id],
  );
  return Boolean(rows[0]);
}

export async function addTripExpenseAttachment(input: {
  user: AuthUser;
  tripExpenseRequestId: string;
  storageProvider: TripExpenseAttachment['storageProvider'];
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
}) {
  const pool = getMysqlPool();
  const [requests] = await pool.query<RowDataPacket[]>(
    `
      SELECT id
      FROM trip_expense_requests
      WHERE id = ? AND requester_id = ?
      LIMIT 1
    `,
    [input.tripExpenseRequestId, input.user.id],
  );
  if (!requests[0]) throw new Error('첨부파일을 등록할 수 있는 출장여비 신청 건이 아닙니다.');

  const id = randomUUID();
  await pool.execute(
    `
      INSERT INTO trip_expense_attachments (
        id, trip_expense_request_id, storage_provider, storage_key, original_filename, mime_type, file_size, uploaded_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.tripExpenseRequestId,
      input.storageProvider,
      input.storageKey,
      input.originalFilename,
      input.mimeType,
      input.fileSize,
      input.user.id,
    ],
  );
  return id;
}

export async function getTripExpenseAttachmentForUser(user: AuthUser, attachmentId: string) {
  const pool = getMysqlPool();
  const params: unknown[] = [attachmentId];
  const canSettle = await canSettleTripExpenses(user);
  const accessWhere =
    canSettle
      ? ''
      : 'AND (ter.requester_id = ? OR aps.approver_id = ?)';

  if (accessWhere) params.push(user.id, user.id);

  const [rows] = await pool.query<TripExpenseAttachmentRow[]>(
    `
      SELECT tea.id, tea.trip_expense_request_id, tea.storage_provider, tea.storage_key, tea.original_filename,
             tea.mime_type, tea.file_size, tea.created_at
      FROM trip_expense_attachments tea
      JOIN trip_expense_requests ter ON ter.id = tea.trip_expense_request_id
      LEFT JOIN approval_steps aps ON aps.target_type = 'TRIP_EXPENSE' AND aps.target_id = ter.id AND aps.step_order = 1
      WHERE tea.id = ?
        ${accessWhere}
      LIMIT 1
    `,
    params,
  );

  return rows[0] ? mapAttachment(rows[0]) : null;
}
