import { randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';
import { getUserByEmail, getUserById, withoutPassword, type AuthUser } from './users';

type KakaoUserLinkRow = RowDataPacket & {
  user_id: string;
};

let schemaReady: Promise<void> | null = null;

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
          verified_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          UNIQUE KEY uq_kakao_user_links_user_key (kakao_user_key),
          INDEX idx_kakao_user_links_user_id (user_id),
          CONSTRAINT fk_kakao_user_links_user_id
            FOREIGN KEY (user_id) REFERENCES users (id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
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
    })();
  }
  return schemaReady;
}

export async function getUserByKakaoKey(kakaoUserKey: string | null | undefined): Promise<AuthUser | null> {
  await ensureKakaoSchema();
  if (kakaoUserKey) {
    const [rows] = await getMysqlPool().query<KakaoUserLinkRow[]>(
      `
        SELECT user_id
        FROM kakao_user_links
        WHERE kakao_user_key = ?
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
    [
      randomUUID(),
      input.kakaoUserKey ?? null,
      input.channelId ?? null,
      input.direction,
      input.messageType ?? 'TEXT',
      JSON.stringify(input.payload ?? null),
    ],
  );
}
