import type { RowDataPacket } from 'mysql2/promise';

import { getLeaveBalanceForUser, getNotificationCounts, listApprovalItems } from './hr';
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

export async function getPersonalDashboard(user: AuthUser) {
  const pool = getMysqlPool();
  const [profileRows, leaveRows, tripRows, notificationRows] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `
        SELECT ep.position, ep.employment_type, ep.hire_date, ep.years_of_service,
          t.name AS team_name, head.name AS team_head_name
        FROM users u
        LEFT JOIN employee_profiles ep ON ep.user_id = u.id
        LEFT JOIN teams t ON t.id = ep.team_id
        LEFT JOIN users head ON head.id = t.head_user_id
        WHERE u.id = ?
        LIMIT 1
      `,
      [user.id],
    ),
    pool.query<RowDataPacket[]>(
      `
        SELECT id, request_type, status, start_date, end_date, created_at
        FROM leave_requests
        WHERE requester_id = ?
        ORDER BY created_at DESC
        LIMIT 5
      `,
      [user.id],
    ),
    pool.query<RowDataPacket[]>(
      `
        SELECT id, origin, destination, status, settlement_status, total_amount, created_at
        FROM trip_expense_requests
        WHERE requester_id = ?
        ORDER BY created_at DESC
        LIMIT 5
      `,
      [user.id],
    ),
    pool.query<RowDataPacket[]>(
      `
        SELECT id, type, title, message, read_at, created_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 5
      `,
      [user.id],
    ),
  ]);

  const [profileResult, leaveResult, tripResult, notificationResult] = [profileRows[0], leaveRows[0], tripRows[0], notificationRows[0]];
  const [balance, counts, approvals] = await Promise.all([
    getLeaveBalanceForUser(user.id),
    getNotificationCounts(user),
    listApprovalItems(user),
  ]);
  const profile = profileResult[0] ?? {};

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    profile: {
      teamName: profile.team_name ? String(profile.team_name) : '팀 미지정',
      teamHeadName: profile.team_head_name ? String(profile.team_head_name) : '미지정',
      position: profile.position ? String(profile.position) : 'STAFF',
      employmentType: profile.employment_type ? String(profile.employment_type) : 'P',
      hireDate: toDateOnly(profile.hire_date),
      yearsOfService: Number(profile.years_of_service ?? 0),
    },
    balance,
    counts: {
      unreadNotifications: counts.unreadNotifications,
      pendingApprovals: counts.pendingApprovals,
      pendingMyApprovals: approvals.length,
    },
    recentLeaveRequests: leaveResult.map((row) => ({
      id: String(row.id),
      requestType: String(row.request_type),
      status: String(row.status),
      startDate: toDateOnly(row.start_date),
      endDate: toDateOnly(row.end_date),
      createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    })),
    recentTripExpenses: tripResult.map((row) => ({
      id: String(row.id),
      origin: String(row.origin ?? ''),
      destination: String(row.destination ?? ''),
      status: String(row.status),
      settlementStatus: String(row.settlement_status),
      totalAmount: Number(row.total_amount ?? 0),
      createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    })),
    recentNotifications: notificationResult.map((row) => ({
      id: String(row.id),
      type: String(row.type),
      title: String(row.title),
      message: String(row.message),
      readAt: toIso(row.read_at),
      createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    })),
  };
}
