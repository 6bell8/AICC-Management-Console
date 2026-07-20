import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from '../db/mysql';
import type { DynNodePost, DynNodeStatus, DynNodeTemplateFile } from '../types/dynnode';

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

type DynNodeTemplateRow = RowDataPacket & {
  id: string;
  post_id: string;
  original_name: string;
  storage_key: string;
  file_size: string | number;
  mime_type: string;
  file_count: string | number;
  manifest_json: string | null;
  created_at: Date | string;
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
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS dynnode_template_files (
          id CHAR(36) NOT NULL PRIMARY KEY,
          post_id VARCHAR(80) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          storage_key VARCHAR(500) NOT NULL,
          file_size BIGINT NOT NULL DEFAULT 0,
          mime_type VARCHAR(120) NOT NULL DEFAULT 'application/zip',
          file_count INT NOT NULL DEFAULT 0,
          manifest_json LONGTEXT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          UNIQUE KEY uq_dynnode_template_post (post_id),
          INDEX idx_dynnode_template_post_created (post_id, created_at),
          CONSTRAINT fk_dynnode_template_post
            FOREIGN KEY (post_id) REFERENCES dynnode_posts (id)
            ON DELETE CASCADE
        )
      `);
    })().catch((error) => {
      ensureDynnodeColumnsPromise = null;
      throw error;
    });
  }
  return ensureDynnodeColumnsPromise;
}

function parseManifest(value: string | null): DynNodeTemplateFile['manifest'] {
  if (!value) return { files: [], entryCandidates: [] };
  try {
    const parsed = JSON.parse(value) as Partial<DynNodeTemplateFile['manifest']>;
    return {
      files: Array.isArray(parsed.files)
        ? parsed.files
            .filter((item): item is { path: string; size: number } => typeof item?.path === 'string' && typeof item?.size === 'number')
            .map((item) => ({ path: item.path, size: item.size }))
        : [],
      entryCandidates: Array.isArray(parsed.entryCandidates) ? parsed.entryCandidates.filter((item): item is string => typeof item === 'string') : [],
      rejectedFiles: Array.isArray(parsed.rejectedFiles) ? parsed.rejectedFiles.filter((item): item is string => typeof item === 'string') : undefined,
    };
  } catch {
    return { files: [], entryCandidates: [] };
  }
}

function mapTemplate(row: DynNodeTemplateRow): DynNodeTemplateFile {
  return {
    id: row.id,
    postId: row.post_id,
    originalName: row.original_name,
    storageKey: row.storage_key,
    fileSize: Number(row.file_size ?? 0),
    mimeType: row.mime_type,
    fileCount: Number(row.file_count ?? 0),
    manifest: parseManifest(row.manifest_json),
    createdAt: toIso(row.created_at),
  };
}

function mapPost(row: DynNodeRow, templateFile?: DynNodeTemplateFile | null): DynNodePost {
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
    templateFile: templateFile ?? null,
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
      ORDER BY created_at DESC, id DESC
    `,
    values,
  );
  const postIds = rows.map((row) => row.id);
  const templatesByPostId = await getTemplatesByPostIds(postIds);
  return rows.map((row) => mapPost(row, templatesByPostId.get(row.id) ?? null));
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
  if (!rows[0]) return null;
  const template = await getTemplateByPostId(id);
  return mapPost(rows[0], template);
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

async function getTemplatesByPostIds(postIds: string[]) {
  const result = new Map<string, DynNodeTemplateFile>();
  if (postIds.length === 0) return result;
  await ensureDynnodeColumns();
  const pool = getMysqlPool();
  const placeholders = postIds.map(() => '?').join(', ');
  const [rows] = await pool.query<DynNodeTemplateRow[]>(
    `
      SELECT id, post_id, original_name, storage_key, file_size, mime_type, file_count, manifest_json, created_at
      FROM dynnode_template_files
      WHERE post_id IN (${placeholders})
    `,
    postIds,
  );
  for (const row of rows) result.set(row.post_id, mapTemplate(row));
  return result;
}

export async function getTemplateByPostId(postId: string) {
  await ensureDynnodeColumns();
  const pool = getMysqlPool();
  const [rows] = await pool.query<DynNodeTemplateRow[]>(
    `
      SELECT id, post_id, original_name, storage_key, file_size, mime_type, file_count, manifest_json, created_at
      FROM dynnode_template_files
      WHERE post_id = ?
      LIMIT 1
    `,
    [postId],
  );
  return rows[0] ? mapTemplate(rows[0]) : null;
}

export async function saveTemplateFile(input: {
  postId: string;
  originalName: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  manifest: DynNodeTemplateFile['manifest'];
}) {
  await ensureDynnodeColumns();
  const pool = getMysqlPool();
  const id = crypto.randomUUID();
  await pool.execute(
    `
      INSERT INTO dynnode_template_files (id, post_id, original_name, storage_key, file_size, mime_type, file_count, manifest_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        id = VALUES(id),
        original_name = VALUES(original_name),
        storage_key = VALUES(storage_key),
        file_size = VALUES(file_size),
        mime_type = VALUES(mime_type),
        file_count = VALUES(file_count),
        manifest_json = VALUES(manifest_json),
        created_at = CURRENT_TIMESTAMP(3)
    `,
    [
      id,
      input.postId,
      input.originalName,
      input.storageKey,
      input.fileSize,
      input.mimeType,
      input.manifest.files.length,
      JSON.stringify(input.manifest),
    ],
  );
  return getTemplateByPostId(input.postId);
}

export async function deleteTemplateFile(postId: string) {
  const current = await getTemplateByPostId(postId);
  if (!current) return null;
  const pool = getMysqlPool();
  await pool.execute('DELETE FROM dynnode_template_files WHERE post_id = ?', [postId]);
  return current;
}
