import { createHash, randomInt, randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';
import { getUserByEmail, getUserById, withoutPassword, type AuthUser } from './users';

export type KakaoLinkStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type KakaoLinkSessionStatus = 'WAITING_EMAIL' | 'COMPLETED' | 'EXPIRED';

type KakaoUserLinkRow = RowDataPacket & {
  user_id: string;
};

type KakaoLinkAdminRow = RowDataPacket & {
  id: string | null;
  user_id: string | null;
  kakao_user_key: string;
  channel_id: string | null;
  status: KakaoLinkStatus | null;
  verified_at: Date | string | null;
  requested_at: Date | string | null;
  approved_by: string | null;
  decided_at: Date | string | null;
  rejected_reason: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
  user_status: string | null;
  approver_name: string | null;
};

type KakaoRecentRow = RowDataPacket & {
  kakao_user_key: string;
  channel_id: string | null;
  payload: unknown;
  last_seen_at: Date | string;
  message_count: number;
  link_status: KakaoLinkStatus | null;
};

type CountRow = RowDataPacket & {
  total: number;
};

type VerificationRow = RowDataPacket & {
  id: string;
  kakao_user_key: string;
  channel_id: string | null;
  user_id: string;
};

type KakaoLinkSessionRow = RowDataPacket & {
  id: string;
  kakao_user_key: string;
  channel_id: string | null;
  status: KakaoLinkSessionStatus;
  expires_at: Date | string;
};

let schemaReady: Promise<void> | null = null;

function toIso(value: Date | string | null) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function parsePayload(payload: unknown) {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (payload && typeof payload === 'object') return payload as Record<string, unknown>;
  return {};
}

function getUtterance(payload: unknown) {
  const parsed = parsePayload(payload);
  const userRequest = parsed.userRequest && typeof parsed.userRequest === 'object' ? (parsed.userRequest as Record<string, unknown>) : {};
  return typeof userRequest.utterance === 'string' ? userRequest.utterance : '';
}

function hashCode(code: string) {
  return createHash('sha256').update(code.trim()).digest('hex');
}

async function ensureColumn(tableName: string, columnName: string, definition: string) {
  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName],
  );
  if (rows.length > 0) return;
  await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

async function ensureKakaoSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const pool = getMysqlPool();
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS kakao_user_links (
          id CHAR(36) NOT NULL,
          user_id CHAR(36) NOT NULL,
          kakao_user_key VARCHAR(120) NOT NULL,
          channel_id VARCHAR(120) NULL,
          status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
          verified_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          approved_by CHAR(36) NULL,
          decided_at DATETIME(3) NULL,
          rejected_reason VARCHAR(255) NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          UNIQUE KEY uq_kakao_user_links_user_key (kakao_user_key),
          INDEX idx_kakao_user_links_user_id (user_id),
          INDEX idx_kakao_user_links_status_updated (status, updated_at),
          CONSTRAINT fk_kakao_user_links_user_id
            FOREIGN KEY (user_id) REFERENCES users (id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
      await ensureColumn('kakao_user_links', 'status', "ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED' AFTER channel_id");
      await ensureColumn('kakao_user_links', 'requested_at', 'DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER verified_at');
      await ensureColumn('kakao_user_links', 'approved_by', 'CHAR(36) NULL AFTER requested_at');
      await ensureColumn('kakao_user_links', 'decided_at', 'DATETIME(3) NULL AFTER approved_by');
      await ensureColumn('kakao_user_links', 'rejected_reason', 'VARCHAR(255) NULL AFTER decided_at');
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS kakao_message_logs (
          id CHAR(36) NOT NULL,
          kakao_user_key VARCHAR(120) NULL,
          channel_id VARCHAR(120) NULL,
          direction ENUM('INBOUND', 'OUTBOUND') NOT NULL,
          message_type VARCHAR(60) NOT NULL DEFAULT 'TEXT',
          payload JSON NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          INDEX idx_kakao_message_logs_user_created (kakao_user_key, created_at),
          CONSTRAINT chk_kakao_message_logs_payload_json CHECK (payload IS NULL OR JSON_VALID(payload))
        ) ENGINE=InnoDB
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS kakao_link_verifications (
          id CHAR(36) NOT NULL,
          kakao_user_key VARCHAR(120) NOT NULL,
          channel_id VARCHAR(120) NULL,
          user_id CHAR(36) NOT NULL,
          email VARCHAR(255) NOT NULL,
          code_hash CHAR(64) NOT NULL,
          expires_at DATETIME(3) NOT NULL,
          used_at DATETIME(3) NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          INDEX idx_kakao_link_verifications_user_code (user_id, code_hash, expires_at),
          INDEX idx_kakao_link_verifications_key_created (kakao_user_key, created_at),
          CONSTRAINT fk_kakao_link_verifications_user_id
            FOREIGN KEY (user_id) REFERENCES users (id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS kakao_link_sessions (
          id CHAR(36) NOT NULL,
          kakao_user_key VARCHAR(120) NOT NULL,
          channel_id VARCHAR(120) NULL,
          status ENUM('WAITING_EMAIL', 'COMPLETED', 'EXPIRED') NOT NULL DEFAULT 'WAITING_EMAIL',
          expires_at DATETIME(3) NOT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          UNIQUE KEY uq_kakao_link_sessions_user_key (kakao_user_key),
          INDEX idx_kakao_link_sessions_status_expires (status, expires_at)
        ) ENGINE=InnoDB
      `);
    })();
  }
  return schemaReady;
}

function allowDefaultKakaoUser() {
  return process.env.KAKAO_ALLOW_DEFAULT_USER === 'true' || process.env.NODE_ENV !== 'production';
}

export async function getUserByKakaoKey(kakaoUserKey: string | null | undefined): Promise<AuthUser | null> {
  await ensureKakaoSchema();
  if (kakaoUserKey) {
    const [rows] = await getMysqlPool().query<KakaoUserLinkRow[]>(
      `
        SELECT user_id
        FROM kakao_user_links
        WHERE kakao_user_key = ?
          AND status = 'APPROVED'
        LIMIT 1
      `,
      [kakaoUserKey],
    );
    const linkedUserId = rows[0]?.user_id;
    if (linkedUserId) {
      const linked = await getUserById(linkedUserId);
      if (linked && linked.status === 'APPROVED') return withoutPassword(linked);
    }
  }

  if (!allowDefaultKakaoUser()) return null;
  const fallbackEmail = process.env.KAKAO_DEFAULT_USER_EMAIL;
  if (!fallbackEmail) return null;
  const fallback = await getUserByEmail(fallbackEmail);
  if (!fallback || fallback.status !== 'APPROVED') return null;
  return withoutPassword(fallback);
}

export async function logKakaoMessage(input: {
  kakaoUserKey?: string | null;
  channelId?: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  messageType?: string;
  payload: unknown;
}) {
  await ensureKakaoSchema();
  await getMysqlPool().execute(
    `
      INSERT INTO kakao_message_logs (id, kakao_user_key, channel_id, direction, message_type, payload)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [randomUUID(), input.kakaoUserKey ?? null, input.channelId ?? null, input.direction, input.messageType ?? 'TEXT', JSON.stringify(input.payload ?? null)],
  );
}

function mapLink(row: KakaoLinkAdminRow) {
  return {
    id: row.id ? String(row.id) : '',
    kakaoUserKey: String(row.kakao_user_key),
    channelId: row.channel_id ? String(row.channel_id) : '',
    status: row.status ?? 'APPROVED',
    verifiedAt: toIso(row.verified_at),
    requestedAt: toIso(row.requested_at),
    approvedBy: row.approved_by ? String(row.approved_by) : '',
    approverName: row.approver_name ? String(row.approver_name) : '',
    decidedAt: toIso(row.decided_at),
    rejectedReason: row.rejected_reason ? String(row.rejected_reason) : '',
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    user: row.user_id
      ? {
          id: String(row.user_id),
          name: row.user_name ? String(row.user_name) : '-',
          email: row.user_email ? String(row.user_email) : '-',
          role: row.user_role ? String(row.user_role) : '-',
          status: row.user_status ? String(row.user_status) : '-',
        }
      : null,
  };
}

export async function listKakaoLinkAdminData(input: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: KakaoLinkStatus | 'UNLINKED' | 'ALL';
} = {}) {
  await ensureKakaoSchema();
  const pool = getMysqlPool();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, input.pageSize ?? 20));
  const status = input.status ?? 'UNLINKED';
  const search = input.search?.trim();

  const [linkRows] = await pool.query<KakaoLinkAdminRow[]>(
    `
      SELECT kul.id, kul.user_id, kul.kakao_user_key, kul.channel_id, kul.status, kul.verified_at,
        kul.requested_at, kul.approved_by, kul.decided_at, kul.rejected_reason, kul.created_at, kul.updated_at,
        u.name AS user_name, u.email AS user_email, u.role AS user_role, u.status AS user_status,
        approver.name AS approver_name
      FROM kakao_user_links kul
      LEFT JOIN users u ON u.id = kul.user_id
      LEFT JOIN users approver ON approver.id = kul.approved_by
      ORDER BY FIELD(kul.status, 'PENDING', 'APPROVED', 'REJECTED'), kul.updated_at DESC
    `,
  );

  const recentWhere: string[] = ['latest.kakao_user_key IS NOT NULL'];
  const recentParams: unknown[] = [];
  if (search) {
    recentWhere.push('(latest.kakao_user_key LIKE ? OR latest.channel_id LIKE ? OR CAST(latest.payload AS CHAR) LIKE ?)');
    recentParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status === 'UNLINKED') {
    recentWhere.push('kul.id IS NULL');
  } else if (status !== 'ALL') {
    recentWhere.push('kul.status = ?');
    recentParams.push(status);
  }

  const recentFrom = `
    FROM (
      SELECT ranked.kakao_user_key, ranked.channel_id, ranked.payload, ranked.created_at AS last_seen_at, counted.message_count
      FROM (
        SELECT kml.*,
          ROW_NUMBER() OVER (PARTITION BY kml.kakao_user_key ORDER BY kml.created_at DESC, kml.id DESC) AS row_no
        FROM kakao_message_logs kml
        WHERE kml.kakao_user_key IS NOT NULL
      ) ranked
      JOIN (
        SELECT kakao_user_key, COUNT(*) AS message_count
        FROM kakao_message_logs
        WHERE kakao_user_key IS NOT NULL
        GROUP BY kakao_user_key
      ) counted ON counted.kakao_user_key = ranked.kakao_user_key
      WHERE ranked.row_no = 1
    ) latest
    LEFT JOIN kakao_user_links kul
      ON kul.kakao_user_key = latest.kakao_user_key
    WHERE ${recentWhere.join(' AND ')}
  `;

  const [countRows] = await pool.query<CountRow[]>(`SELECT COUNT(*) AS total ${recentFrom}`, recentParams);
  const total = Number(countRows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const offset = (safePage - 1) * pageSize;
  const [recentRows] = await pool.query<KakaoRecentRow[]>(
    `
      SELECT latest.kakao_user_key, latest.channel_id, latest.payload, latest.last_seen_at, latest.message_count, kul.status AS link_status
      ${recentFrom}
      ORDER BY latest.last_seen_at DESC
      LIMIT ? OFFSET ?
    `,
    [...recentParams, pageSize, offset],
  );

  return {
    links: linkRows.map(mapLink),
    recentUsers: recentRows.map((row) => ({
      kakaoUserKey: String(row.kakao_user_key),
      channelId: row.channel_id ? String(row.channel_id) : '',
      lastSeenAt: toIso(row.last_seen_at) ?? new Date().toISOString(),
      messageCount: Number(row.message_count ?? 0),
      lastUtterance: getUtterance(row.payload),
      linkStatus: row.link_status ?? null,
    })),
    pagination: {
      page: safePage,
      pageSize,
      total,
      pageCount,
    },
  };
}

export async function upsertKakaoUserLink(input: { kakaoUserKey: string; userId: string; channelId?: string | null }) {
  await ensureKakaoSchema();
  const id = randomUUID();
  await getMysqlPool().execute(
    `
      INSERT INTO kakao_user_links (id, user_id, kakao_user_key, channel_id, status, requested_at, verified_at)
      VALUES (?, ?, ?, ?, 'APPROVED', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        channel_id = VALUES(channel_id),
        status = 'APPROVED',
        requested_at = CURRENT_TIMESTAMP(3),
        verified_at = CURRENT_TIMESTAMP(3),
        decided_at = CURRENT_TIMESTAMP(3),
        rejected_reason = NULL
    `,
    [id, input.userId, input.kakaoUserKey.trim(), input.channelId?.trim() || null],
  );
}

export async function startKakaoLinkSession(input: { kakaoUserKey: string; channelId?: string | null }) {
  await ensureKakaoSchema();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await getMysqlPool().execute(
    `
      INSERT INTO kakao_link_sessions (id, kakao_user_key, channel_id, status, expires_at)
      VALUES (?, ?, ?, 'WAITING_EMAIL', ?)
      ON DUPLICATE KEY UPDATE
        channel_id = VALUES(channel_id),
        status = 'WAITING_EMAIL',
        expires_at = VALUES(expires_at),
        updated_at = CURRENT_TIMESTAMP(3)
    `,
    [randomUUID(), input.kakaoUserKey.trim(), input.channelId?.trim() || null, expiresAt.toISOString().slice(0, 19).replace('T', ' ')],
  );
  return { expiresAt: expiresAt.toISOString() };
}

export async function getActiveKakaoLinkSession(kakaoUserKey: string | null | undefined) {
  await ensureKakaoSchema();
  if (!kakaoUserKey) return null;
  const [rows] = await getMysqlPool().query<KakaoLinkSessionRow[]>(
    `
      SELECT id, kakao_user_key, channel_id, status, expires_at
      FROM kakao_link_sessions
      WHERE kakao_user_key = ?
        AND status = 'WAITING_EMAIL'
        AND expires_at > NOW(3)
      LIMIT 1
    `,
    [kakaoUserKey.trim()],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    kakaoUserKey: String(row.kakao_user_key),
    channelId: row.channel_id ? String(row.channel_id) : '',
    status: row.status,
    expiresAt: toIso(row.expires_at),
  };
}

export async function completeKakaoLinkSession(kakaoUserKey: string) {
  await ensureKakaoSchema();
  await getMysqlPool().execute(
    `
      UPDATE kakao_link_sessions
      SET status = 'COMPLETED',
        updated_at = CURRENT_TIMESTAMP(3)
      WHERE kakao_user_key = ?
    `,
    [kakaoUserKey.trim()],
  );
}

export async function createKakaoLinkVerification(input: { kakaoUserKey: string; channelId?: string | null; email: string }) {
  await ensureKakaoSchema();
  const email = input.email.trim().toLowerCase();
  const user = await getUserByEmail(email);
  if (!user || user.status !== 'APPROVED') return { ok: false as const, message: '승인된 AICC 계정을 찾지 못했습니다.' };

  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await getMysqlPool().execute(
    `
      INSERT INTO kakao_link_verifications (id, kakao_user_key, channel_id, user_id, email, code_hash, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [randomUUID(), input.kakaoUserKey.trim(), input.channelId?.trim() || null, user.id, email, hashCode(code), expiresAt.toISOString().slice(0, 19).replace('T', ' ')],
  );
  await completeKakaoLinkSession(input.kakaoUserKey);

  return {
    ok: true as const,
    code,
    expiresAt: expiresAt.toISOString(),
    user: withoutPassword(user),
  };
}

export async function verifyKakaoLinkCode(input: { userId: string; code: string }) {
  await ensureKakaoSchema();
  const pool = getMysqlPool();
  const [rows] = await pool.query<VerificationRow[]>(
    `
      SELECT id, kakao_user_key, channel_id, user_id
      FROM kakao_link_verifications
      WHERE user_id = ?
        AND code_hash = ?
        AND used_at IS NULL
        AND expires_at > NOW(3)
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [input.userId, hashCode(input.code)],
  );
  const row = rows[0];
  if (!row) return { ok: false as const, message: '유효한 인증 코드를 찾지 못했습니다.' };

  await upsertKakaoUserLink({ kakaoUserKey: row.kakao_user_key, userId: row.user_id, channelId: row.channel_id });
  await pool.execute('UPDATE kakao_link_verifications SET used_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [row.id]);
  return { ok: true as const, kakaoUserKey: row.kakao_user_key };
}

export async function decideKakaoUserLink(input: { kakaoUserKey: string; status: Extract<KakaoLinkStatus, 'APPROVED' | 'REJECTED'>; actorId: string; rejectedReason?: string | null }) {
  await ensureKakaoSchema();
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `
      UPDATE kakao_user_links
      SET status = ?,
        approved_by = ?,
        decided_at = CURRENT_TIMESTAMP(3),
        rejected_reason = ?
      WHERE kakao_user_key = ?
    `,
    [input.status, input.actorId, input.status === 'REJECTED' ? input.rejectedReason?.trim() || null : null, input.kakaoUserKey.trim()],
  );
  return result.affectedRows > 0;
}

export async function deleteKakaoUserLink(kakaoUserKey: string) {
  await ensureKakaoSchema();
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `
      DELETE FROM kakao_user_links
      WHERE kakao_user_key = ?
    `,
    [kakaoUserKey.trim()],
  );
  return result;
}
