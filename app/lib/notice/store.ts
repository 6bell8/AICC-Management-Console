import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from '../db/mysql';
import type { Notice, NoticeAttachment, NoticeStatus } from '../types/notice';

type NoticeRow = RowDataPacket & {
  id: string;
  title: string;
  content: string;
  pinned: number | boolean;
  status: NoticeStatus;
  attachments_json: string | null;
  revision_count: number | null;
  last_editor_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

async function ensureNoticeBoardColumns() {
  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'notices'
        AND COLUMN_NAME IN ('attachments_json', 'revision_count', 'last_editor_name')
    `,
  );
  const existing = new Set(rows.map((row) => String(row.COLUMN_NAME)));
  if (!existing.has('attachments_json')) {
    await pool.execute('ALTER TABLE notices ADD COLUMN attachments_json TEXT NULL AFTER status');
  }
  if (!existing.has('revision_count')) {
    await pool.execute('ALTER TABLE notices ADD COLUMN revision_count INT NOT NULL DEFAULT 0 AFTER attachments_json');
  }
  if (!existing.has('last_editor_name')) {
    await pool.execute('ALTER TABLE notices ADD COLUMN last_editor_name VARCHAR(100) NULL AFTER revision_count');
  }
}

function parseAttachments(value: string | null): NoticeAttachment[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        name: typeof item?.name === 'string' ? item.name.trim() : '',
        url: typeof item?.url === 'string' ? item.url.trim() : '',
      }))
      .filter((item) => item.name && item.url)
      .slice(0, 5);
  } catch {
    return [];
  }
}

function normalizeAttachments(value: unknown): NoticeAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      name: typeof item?.name === 'string' ? item.name.trim() : '',
      url: typeof item?.url === 'string' ? item.url.trim() : '',
    }))
    .filter((item) => item.name && item.url)
    .slice(0, 5);
}

function mapNotice(row: NoticeRow): Notice {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    pinned: Boolean(row.pinned),
    status: row.status,
    attachments: parseAttachments(row.attachments_json),
    revisionCount: Number(row.revision_count ?? 0),
    lastEditorName: row.last_editor_name,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listNotices(params?: { q?: string; status?: NoticeStatus | 'ALL'; pinned?: boolean }) {
  await ensureNoticeBoardColumns();
  const pool = getMysqlPool();
  const filters: string[] = [];
  const values: Array<string | number | boolean> = [];
  const q = params?.q?.trim();
  if (q) {
    filters.push('(title LIKE ? OR content LIKE ?)');
    values.push(`%${q}%`, `%${q}%`);
  }
  if (params?.status === 'PUBLISHED' || params?.status === 'DRAFT') {
    filters.push('status = ?');
    values.push(params.status);
  }
  if (params?.pinned === true) {
    filters.push('pinned = 1');
  }
  const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await pool.query<NoticeRow[]>(
    `
      SELECT id, title, content, pinned, status, attachments_json, revision_count, last_editor_name, created_at, updated_at
      FROM notices
      ${whereSql}
      ORDER BY updated_at DESC
    `,
    values,
  );
  return rows.map(mapNotice);
}

export async function getNotice(id: string) {
  await ensureNoticeBoardColumns();
  const pool = getMysqlPool();
  const [rows] = await pool.query<NoticeRow[]>(
    `
      SELECT id, title, content, pinned, status, attachments_json, revision_count, last_editor_name, created_at, updated_at
      FROM notices
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );
  return rows[0] ? mapNotice(rows[0]) : null;
}

export async function createNotice(input: Pick<Notice, 'title' | 'content' | 'pinned' | 'status'> & { attachments?: NoticeAttachment[]; editorName?: string | null }) {
  await ensureNoticeBoardColumns();
  const pool = getMysqlPool();
  const id = randomUUID();
  const status: NoticeStatus = input.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
  const attachments = normalizeAttachments(input.attachments);

  await pool.execute(
    `
      INSERT INTO notices (id, title, content, pinned, status, attachments_json, revision_count, last_editor_name)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `,
    [id, input.title, input.content, input.pinned === true, status, JSON.stringify(attachments), input.editorName ?? null],
  );

  const created = await getNotice(id);
  if (!created) throw new Error('Failed to create notice');
  return created;
}

export async function patchNotice(id: string, patch: Partial<Pick<Notice, 'title' | 'content' | 'pinned' | 'status'>> & { attachments?: NoticeAttachment[]; editorName?: string | null }) {
  const current = await getNotice(id);
  if (!current) return null;

  const pool = getMysqlPool();
  const next = {
    title: typeof patch.title === 'string' ? patch.title : current.title,
    content: typeof patch.content === 'string' ? patch.content : current.content,
    pinned: typeof patch.pinned === 'boolean' ? patch.pinned : current.pinned,
    status: patch.status === 'PUBLISHED' ? 'PUBLISHED' : patch.status === 'DRAFT' ? 'DRAFT' : current.status,
    attachments: patch.attachments === undefined ? current.attachments ?? [] : normalizeAttachments(patch.attachments),
  };

  await pool.execute(
    `
      UPDATE notices
      SET title = ?, content = ?, pinned = ?, status = ?, attachments_json = ?, revision_count = revision_count + 1, last_editor_name = ?
      WHERE id = ?
    `,
    [next.title, next.content, next.pinned, next.status, JSON.stringify(next.attachments), patch.editorName ?? null, id],
  );

  return getNotice(id);
}

export async function deleteNotice(id: string) {
  const pool = getMysqlPool();
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM notices WHERE id = ?', [id]);
  return result.affectedRows;
}
