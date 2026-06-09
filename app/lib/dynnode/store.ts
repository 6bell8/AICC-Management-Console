import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from '../db/mysql';
import type { DynNodePost, DynNodeStatus } from '../types/dynnode';

type DynNodeRow = RowDataPacket & {
  id: string;
  title: string;
  summary: string | null;
  code: string;
  sample_ctx: string | null;
  tags: string | string[];
  status: DynNodeStatus;
  created_at: Date | string;
  updated_at: Date | string;
};

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return `dn_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function toIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function parseTags(value: string | string[]) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string');
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function mapPost(row: DynNodeRow): DynNodePost {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    code: row.code,
    sampleCtx: row.sample_ctx ?? '{\n  \n}\n',
    tags: parseTags(row.tags),
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listPosts() {
  const pool = getMysqlPool();
  const [rows] = await pool.query<DynNodeRow[]>(
    `
      SELECT id, title, summary, code, sample_ctx, tags, status, created_at, updated_at
      FROM dynnode_posts
      ORDER BY updated_at DESC
    `,
  );
  return rows.map(mapPost);
}

export async function getPost(id: string) {
  const pool = getMysqlPool();
  const [rows] = await pool.query<DynNodeRow[]>(
    `
      SELECT id, title, summary, code, sample_ctx, tags, status, created_at, updated_at
      FROM dynnode_posts
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );
  return rows[0] ? mapPost(rows[0]) : null;
}

export async function createPost(input: {
  title: string;
  summary?: string | null;
  code: string;
  sampleCtx?: string;
  tags?: string[];
  status?: DynNodeStatus;
}) {
  const pool = getMysqlPool();
  const id = makeId();
  const now = nowIso();

  await pool.execute(
    `
      INSERT INTO dynnode_posts (id, title, summary, code, sample_ctx, tags, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.title,
      input.summary ?? null,
      input.code,
      input.sampleCtx ?? '{\n  \n}\n',
      JSON.stringify(input.tags ?? []),
      input.status ?? 'DRAFT',
      now.slice(0, 23).replace('T', ' '),
      now.slice(0, 23).replace('T', ' '),
    ],
  );

  const created = await getPost(id);
  if (!created) throw new Error('Failed to create dynnode post');
  return created;
}

export async function patchPost(id: string, patch: Partial<Pick<DynNodePost, 'title' | 'summary' | 'code' | 'sampleCtx' | 'tags' | 'status'>>) {
  const current = await getPost(id);
  if (!current) return null;

  const pool = getMysqlPool();
  const next = {
    title: patch.title ?? current.title,
    summary: patch.summary === undefined ? current.summary : patch.summary,
    code: patch.code ?? current.code,
    sampleCtx: patch.sampleCtx ?? current.sampleCtx,
    tags: patch.tags ?? current.tags,
    status: patch.status ?? current.status,
  };

  await pool.execute(
    `
      UPDATE dynnode_posts
      SET title = ?, summary = ?, code = ?, sample_ctx = ?, tags = ?, status = ?
      WHERE id = ?
    `,
    [next.title, next.summary, next.code, next.sampleCtx, JSON.stringify(next.tags), next.status, id],
  );

  return getPost(id);
}

export async function deletePost(id: string) {
  const pool = getMysqlPool();
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM dynnode_posts WHERE id = ?', [id]);
  return result.affectedRows;
}
