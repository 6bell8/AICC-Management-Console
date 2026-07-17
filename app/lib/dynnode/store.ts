import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from '../db/mysql';
import type { DynNodePost, DynNodeStatus } from '../types/dynnode';

type DynNodeRow = RowDataPacket & {
  id: string;
  title: string;
  summary: string | null;
  code: string;
  sample_ctx: unknown;
  ctx_key: string | null;
  tags: string | string[];
  status: DynNodeStatus;
  last_editor_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

let ensureDynnodeColumnsPromise: Promise<void> | null = null;

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

function stringifySampleCtx(value: unknown) {
  if (typeof value === 'string') return value;
  if (value == null) return '{\n  \n}\n';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function ensureDynnodeColumns() {
  if (!ensureDynnodeColumnsPromise) {
    ensureDynnodeColumnsPromise = (async () => {
      const pool = getMysqlPool();
      const [columns] = await pool.query<RowDataPacket[]>(
        `
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'dynnode_posts'
            AND COLUMN_NAME IN ('ctx_key', 'last_editor_name')
        `,
      );
      const existing = new Set(columns.map((row) => String(row.COLUMN_NAME)));
      if (!existing.has('ctx_key')) {
        await pool.query("ALTER TABLE dynnode_posts ADD COLUMN ctx_key VARCHAR(120) NOT NULL DEFAULT 'api:API01' AFTER sample_ctx");
      }
      if (!existing.has('last_editor_name')) {
        await pool.query('ALTER TABLE dynnode_posts ADD COLUMN last_editor_name VARCHAR(100) NULL AFTER status');
      }
    })().catch((error) => {
      ensureDynnodeColumnsPromise = null;
      throw error;
    });
  }
  return ensureDynnodeColumnsPromise;
}

function mapPost(row: DynNodeRow): DynNodePost {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    code: row.code,
    sampleCtx: stringifySampleCtx(row.sample_ctx),
    ctxKey: row.ctx_key?.trim() || 'api:API01',
    tags: parseTags(row.tags),
    status: row.status,
    lastEditorName: row.last_editor_name,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listPosts(params?: { q?: string; status?: DynNodeStatus | 'ALL' }) {
  await ensureDynnodeColumns();
  const pool = getMysqlPool();
  const filters: string[] = [];
  const values: string[] = [];
  const q = params?.q?.trim();
  if (q) {
    filters.push('(title LIKE ? OR summary LIKE ? OR code LIKE ?)');
    values.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (params?.status === 'PUBLISHED' || params?.status === 'DRAFT') {
    filters.push('status = ?');
    values.push(params.status);
  }
  const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await pool.query<DynNodeRow[]>(
    `
      SELECT id, title, summary, code, sample_ctx, ctx_key, tags, status, last_editor_name, created_at, updated_at
      FROM dynnode_posts
      ${whereSql}
      ORDER BY updated_at DESC
    `,
    values,
  );
  return rows.map(mapPost);
}

export async function getPost(id: string) {
  await ensureDynnodeColumns();
  const pool = getMysqlPool();
  const [rows] = await pool.query<DynNodeRow[]>(
    `
      SELECT id, title, summary, code, sample_ctx, ctx_key, tags, status, last_editor_name, created_at, updated_at
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
  ctxKey?: string;
  tags?: string[];
  status?: DynNodeStatus;
  editorName?: string | null;
}) {
  const pool = getMysqlPool();
  await ensureDynnodeColumns();
  const id = makeId();
  const now = nowIso();

  await pool.execute(
    `
      INSERT INTO dynnode_posts (id, title, summary, code, sample_ctx, ctx_key, tags, status, last_editor_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.title,
      input.summary ?? null,
      input.code,
      input.sampleCtx ?? '{\n  \n}\n',
      input.ctxKey?.trim() || 'api:API01',
      JSON.stringify(input.tags ?? []),
      input.status ?? 'DRAFT',
      input.editorName ?? null,
      now.slice(0, 23).replace('T', ' '),
      now.slice(0, 23).replace('T', ' '),
    ],
  );

  const created = await getPost(id);
  if (!created) throw new Error('Failed to create dynnode post');
  return created;
}

export async function patchPost(id: string, patch: Partial<Pick<DynNodePost, 'title' | 'summary' | 'code' | 'sampleCtx' | 'ctxKey' | 'tags' | 'status'>> & { editorName?: string | null }) {
  const current = await getPost(id);
  if (!current) return null;

  const pool = getMysqlPool();
  const next = {
    title: patch.title ?? current.title,
    summary: patch.summary === undefined ? current.summary : patch.summary,
    code: patch.code ?? current.code,
    sampleCtx: patch.sampleCtx ?? current.sampleCtx,
    ctxKey: patch.ctxKey ?? current.ctxKey,
    tags: patch.tags ?? current.tags,
    status: patch.status ?? current.status,
  };

  await pool.execute(
    `
      UPDATE dynnode_posts
      SET title = ?, summary = ?, code = ?, sample_ctx = ?, ctx_key = ?, tags = ?, status = ?, last_editor_name = ?
      WHERE id = ?
    `,
    [next.title, next.summary, next.code, next.sampleCtx, next.ctxKey.trim() || 'api:API01', JSON.stringify(next.tags), next.status, patch.editorName ?? null, id],
  );

  return getPost(id);
}

export async function deletePost(id: string) {
  const pool = getMysqlPool();
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM dynnode_posts WHERE id = ?', [id]);
  return result.affectedRows;
}
