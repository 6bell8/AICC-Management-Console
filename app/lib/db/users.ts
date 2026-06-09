import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { randomUUID } from 'crypto';

import { getMysqlPool } from './mysql';

export const USER_ROLES = ['HEAD', 'ADMIN', 'OPERATOR', 'VIEWER'] as const;
export const USER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  forcePasswordChange: boolean;
  createdAt: string;
  updatedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
};

export type UserWithPassword = AuthUser & {
  passwordHash: string;
};

type UserRow = RowDataPacket & {
  id: string;
  email: string;
  password_hash: string;
  force_password_change: 0 | 1 | boolean;
  name: string;
  role: UserRole;
  status: UserStatus;
  approved_by: string | null;
  approved_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string | null) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapUser(row: UserRow): UserWithPassword {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    forcePasswordChange: Boolean(row.force_password_change),
    name: row.name,
    role: row.role,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: toIso(row.approved_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

export function withoutPassword(user: UserWithPassword): AuthUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function getUserByEmail(email: string) {
  const pool = getMysqlPool();
  const [rows] = await pool.query<UserRow[]>(
    `
      SELECT id, email, password_hash, force_password_change, name, role, status, approved_by, approved_at, created_at, updated_at
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email.trim().toLowerCase()],
  );

  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getUserById(id: string) {
  const pool = getMysqlPool();
  const [rows] = await pool.query<UserRow[]>(
    `
      SELECT id, email, password_hash, force_password_change, name, role, status, approved_by, approved_at, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ? mapUser(rows[0]) : null;
}

export async function listUsers() {
  const pool = getMysqlPool();
  const [rows] = await pool.query<UserRow[]>(
    `
      SELECT id, email, password_hash, force_password_change, name, role, status, approved_by, approved_at, created_at, updated_at
      FROM users
      ORDER BY FIELD(status, 'PENDING', 'APPROVED', 'REJECTED'), created_at DESC
    `,
  );

  return rows.map(mapUser).map(withoutPassword);
}

export async function listUsersPage(input: {
  page: number;
  pageSize: number;
  search?: string;
  status?: UserStatus | 'ALL';
  role?: UserRole | 'ALL';
  teamId?: string | 'ALL' | 'UNASSIGNED';
}) {
  const pool = getMysqlPool();
  const page = Math.max(1, input.page);
  const pageSize = Math.min(100, Math.max(1, input.pageSize));
  const where: string[] = [];
  const params: unknown[] = [];
  const search = input.search?.trim();

  if (search) {
    where.push('(u.name LIKE ? OR u.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (input.status && input.status !== 'ALL') {
    where.push('u.status = ?');
    params.push(input.status);
  }
  if (input.role && input.role !== 'ALL') {
    where.push('u.role = ?');
    params.push(input.role);
  }
  if (input.teamId && input.teamId !== 'ALL') {
    if (input.teamId === 'UNASSIGNED') {
      where.push('ep.team_id IS NULL');
    } else {
      where.push('ep.team_id = ?');
      params.push(input.teamId);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [countRows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COUNT(*) AS total
      FROM users u
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      ${whereSql}
    `,
    params,
  );
  const total = Number(countRows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const offset = (safePage - 1) * pageSize;

  const [rows] = await pool.query<UserRow[]>(
    `
      SELECT u.id, u.email, u.password_hash, u.force_password_change, u.name, u.role, u.status, u.approved_by, u.approved_at, u.created_at, u.updated_at
      FROM users u
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      ${whereSql}
      ORDER BY FIELD(u.status, 'PENDING', 'APPROVED', 'REJECTED'), u.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset],
  );

  const [summaryRows] = await pool.query<RowDataPacket[]>(
    `
      SELECT
        SUM(status = 'PENDING') AS pending_count,
        SUM(status = 'APPROVED') AS approved_count,
        SUM(role IN ('HEAD', 'ADMIN')) AS admin_count
      FROM users
    `,
  );
  const summary = summaryRows[0] ?? {};

  return {
    users: rows.map(mapUser).map(withoutPassword),
    total,
    page: safePage,
    pageSize,
    summary: {
      pending: Number(summary.pending_count ?? 0),
      approved: Number(summary.approved_count ?? 0),
      admin: Number(summary.admin_count ?? 0),
    },
  };
}

export async function createSignupUser(input: { email: string; passwordHash: string; name: string }) {
  const id = randomUUID();
  const pool = getMysqlPool();
  await pool.execute(
    `
      INSERT INTO users (id, email, password_hash, name, role, status)
      VALUES (?, ?, ?, ?, 'VIEWER', 'PENDING')
    `,
    [id, input.email.trim().toLowerCase(), input.passwordHash, input.name.trim()],
  );

  const user = await getUserById(id);
  if (!user) throw new Error('Failed to create user');
  return withoutPassword(user);
}

export async function upsertHeadUser(input: { email: string; passwordHash: string; name: string }) {
  const id = randomUUID();
  const pool = getMysqlPool();
  await pool.execute(
    `
      INSERT INTO users (id, email, password_hash, name, role, status, approved_at)
      VALUES (?, ?, ?, ?, 'HEAD', 'APPROVED', CURRENT_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        name = VALUES(name),
        role = 'HEAD',
        status = 'APPROVED',
        approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP(3))
    `,
    [id, input.email.trim().toLowerCase(), input.passwordHash, input.name.trim()],
  );
}

export async function upsertGuestUser() {
  const email = (process.env.AUTH_GUEST_EMAIL || 'portfolio-guest@aicc.local').trim().toLowerCase();
  const name = (process.env.AUTH_GUEST_NAME || '포트폴리오 게스트').trim();
  const id = randomUUID();
  const pool = getMysqlPool();

  await pool.execute(
    `
      INSERT INTO users (id, email, password_hash, name, role, status, approved_at)
      VALUES (?, ?, 'guest-login-disabled', ?, 'VIEWER', 'APPROVED', CURRENT_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        role = 'VIEWER',
        status = 'APPROVED',
        approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP(3))
    `,
    [id, email, name],
  );

  const user = await getUserByEmail(email);
  if (!user) throw new Error('Failed to create guest user');
  return withoutPassword(user);
}

export async function updateUserControl(
  id: string,
  input: { status?: UserStatus; role?: UserRole; approvedBy: string },
) {
  const current = await getUserById(id);
  if (!current) return null;
  if (current.role === 'HEAD') throw new Error('HEAD account cannot be changed');

  const nextStatus = input.status ?? current.status;
  const nextRole = input.role ?? current.role;
  const pool = getMysqlPool();

  await pool.execute(
    `
      UPDATE users
      SET status = ?,
          role = ?,
          approved_by = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_by END,
          approved_at = CASE WHEN ? = 'APPROVED' THEN CURRENT_TIMESTAMP(3) ELSE approved_at END
      WHERE id = ?
    `,
    [nextStatus, nextRole, nextStatus, input.approvedBy, nextStatus, id],
  );

  const updated = await getUserById(id);
  return updated ? withoutPassword(updated) : null;
}

export async function resetUserPassword(id: string, passwordHash: string) {
  const current = await getUserById(id);
  if (!current) return null;

  const pool = getMysqlPool();
  await pool.execute(
    `
      UPDATE users
      SET password_hash = ?,
          force_password_change = TRUE
      WHERE id = ?
    `,
    [passwordHash, id],
  );

  const updated = await getUserById(id);
  return updated ? withoutPassword(updated) : null;
}

export async function changeUserPassword(id: string, passwordHash: string) {
  const current = await getUserById(id);
  if (!current) return null;

  const pool = getMysqlPool();
  await pool.execute(
    `
      UPDATE users
      SET password_hash = ?,
          force_password_change = FALSE
      WHERE id = ?
    `,
    [passwordHash, id],
  );

  const updated = await getUserById(id);
  return updated ? withoutPassword(updated) : null;
}

export async function deleteUser(id: string) {
  const current = await getUserById(id);
  if (!current) return { deleted: false };
  if (current.role === 'HEAD') throw new Error('HEAD account cannot be deleted');

  const pool = getMysqlPool();
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM users WHERE id = ?', [id]);
  return { deleted: result.affectedRows > 0 };
}
