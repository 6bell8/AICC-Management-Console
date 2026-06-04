import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';
import type { AuthorGuide } from '../types/authorGuide';

type AuthorGuideStatus = 'PUBLISHED' | 'DRAFT';

type AuthorGuideRow = RowDataPacket & {
  id: string;
  title: string;
  content: string;
  status: AuthorGuideStatus;
  created_at: Date | string;
  updated_at: Date | string;
};

export type AuthorGuideListParams = {
  q?: string;
  page?: number;
  pageSize?: number;
};

function toIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapAuthorGuide(row: AuthorGuideRow): AuthorGuide {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function clampPage(value: number | undefined) {
  return Number.isInteger(value) && value! > 0 ? value! : 1;
}

function clampPageSize(value: number | undefined) {
  if (!Number.isInteger(value) || value! <= 0) return 10;
  return Math.min(value!, 100);
}

export async function listAuthorGuides(params: AuthorGuideListParams) {
  const pool = getMysqlPool();
  const q = (params.q ?? '').trim();
  const page = clampPage(params.page);
  const pageSize = clampPageSize(params.pageSize);
  const whereSql = q ? 'WHERE title LIKE ? OR content LIKE ?' : '';
  const values = q ? [`%${q}%`, `%${q}%`] : [];

  const [countRows] = await pool.query<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(*) AS total FROM author_guides ${whereSql}`,
    values,
  );
  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const [rows] = await pool.query<AuthorGuideRow[]>(
    `
      SELECT id, title, content, status, created_at, updated_at
      FROM author_guides
      ${whereSql}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `,
    [...values, pageSize, (safePage - 1) * pageSize],
  );

  return { items: rows.map(mapAuthorGuide), total, page: safePage, pageSize, totalPages };
}

export async function getAuthorGuide(id: string) {
  const pool = getMysqlPool();
  const [rows] = await pool.query<AuthorGuideRow[]>(
    `
      SELECT id, title, content, status, created_at, updated_at
      FROM author_guides
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );
  return rows[0] ? mapAuthorGuide(rows[0]) : null;
}

export async function createAuthorGuide(input: Pick<AuthorGuide, 'title' | 'content' | 'status'>) {
  const pool = getMysqlPool();
  const id = randomUUID();
  const status = input.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED';

  await pool.execute(
    `
      INSERT INTO author_guides (id, title, content, status)
      VALUES (?, ?, ?, ?)
    `,
    [id, input.title, input.content ?? '', status],
  );

  const created = await getAuthorGuide(id);
  if (!created) throw new Error('Failed to create author guide');
  return created;
}

export async function updateAuthorGuide(id: string, input: Partial<Pick<AuthorGuide, 'title' | 'content' | 'status'>>) {
  const current = await getAuthorGuide(id);
  if (!current) return null;

  const pool = getMysqlPool();
  const nextTitle: string = input.title ?? current.title;
  const nextContent: string = input.content ?? current.content ?? '';
  const nextStatus: AuthorGuideStatus =
    input.status === 'DRAFT' ? 'DRAFT' : input.status === 'PUBLISHED' ? 'PUBLISHED' : current.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED';

  await pool.execute(
    `
      UPDATE author_guides
      SET title = ?, content = ?, status = ?
      WHERE id = ?
    `,
    [nextTitle, nextContent, nextStatus, id],
  );

  return getAuthorGuide(id);
}

export async function deleteAuthorGuide(id: string) {
  const pool = getMysqlPool();
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM author_guides WHERE id = ?', [id]);
  return result.affectedRows;
}
