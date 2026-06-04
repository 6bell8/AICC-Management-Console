import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from '../db/mysql';
import type { Notice, NoticeStatus } from '../types/notice';

type NoticeRow = RowDataPacket & {
  id: string;
  title: string;
  content: string;
  pinned: number | boolean;
  status: NoticeStatus;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapNotice(row: NoticeRow): Notice {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    pinned: Boolean(row.pinned),
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listNotices() {
  const pool = getMysqlPool();
  const [rows] = await pool.query<NoticeRow[]>(
    `
      SELECT id, title, content, pinned, status, created_at, updated_at
      FROM notices
      ORDER BY updated_at DESC
    `,
  );
  return rows.map(mapNotice);
}

export async function getNotice(id: string) {
  const pool = getMysqlPool();
  const [rows] = await pool.query<NoticeRow[]>(
    `
      SELECT id, title, content, pinned, status, created_at, updated_at
      FROM notices
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );
  return rows[0] ? mapNotice(rows[0]) : null;
}

export async function createNotice(input: Pick<Notice, 'title' | 'content' | 'pinned' | 'status'>) {
  const pool = getMysqlPool();
  const id = randomUUID();
  const status: NoticeStatus = input.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';

  await pool.execute(
    `
      INSERT INTO notices (id, title, content, pinned, status)
      VALUES (?, ?, ?, ?, ?)
    `,
    [id, input.title, input.content, input.pinned === true, status],
  );

  const created = await getNotice(id);
  if (!created) throw new Error('Failed to create notice');
  return created;
}

export async function patchNotice(id: string, patch: Partial<Pick<Notice, 'title' | 'content' | 'pinned' | 'status'>>) {
  const current = await getNotice(id);
  if (!current) return null;

  const pool = getMysqlPool();
  const next = {
    title: typeof patch.title === 'string' ? patch.title : current.title,
    content: typeof patch.content === 'string' ? patch.content : current.content,
    pinned: typeof patch.pinned === 'boolean' ? patch.pinned : current.pinned,
    status: patch.status === 'PUBLISHED' ? 'PUBLISHED' : patch.status === 'DRAFT' ? 'DRAFT' : current.status,
  };

  await pool.execute(
    `
      UPDATE notices
      SET title = ?, content = ?, pinned = ?, status = ?
      WHERE id = ?
    `,
    [next.title, next.content, next.pinned, next.status, id],
  );

  return getNotice(id);
}

export async function deleteNotice(id: string) {
  const pool = getMysqlPool();
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM notices WHERE id = ?', [id]);
  return result.affectedRows;
}
