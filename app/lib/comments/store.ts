import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import type { AuthUser } from '../db/users';
import { getMysqlPool } from '../db/mysql';
import type { CommentTargetType, PostComment } from '../types/comments';

type CommentRow = RowDataPacket & {
  id: string;
  target_type: CommentTargetType;
  target_id: string;
  parent_id: string | null;
  content: string;
  author_id: string | null;
  author_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

async function ensureCommentsTable() {
  await getMysqlPool().execute(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id CHAR(36) NOT NULL,
      target_type ENUM('NOTICE', 'FAMILY_EVENT', 'AUTHOR_GUIDE') NOT NULL,
      target_id VARCHAR(80) NOT NULL,
      parent_id CHAR(36) NULL,
      author_id CHAR(36) NULL,
      author_name VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX idx_post_comments_target_created (target_type, target_id, created_at),
      INDEX idx_post_comments_parent_created (parent_id, created_at),
      INDEX idx_post_comments_author_created (author_id, created_at),
      CONSTRAINT fk_post_comments_parent
        FOREIGN KEY (parent_id) REFERENCES post_comments (id)
        ON DELETE CASCADE,
      CONSTRAINT fk_post_comments_author
        FOREIGN KEY (author_id) REFERENCES users (id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);

  const [columns] = await getMysqlPool().query<RowDataPacket[]>('SHOW COLUMNS FROM post_comments LIKE ?', ['target_type']);
  const currentType = String(columns[0]?.Type ?? '');
  if (!currentType.includes('AUTHOR_GUIDE')) {
    await getMysqlPool().execute(`
      ALTER TABLE post_comments
      MODIFY target_type ENUM('NOTICE', 'FAMILY_EVENT', 'AUTHOR_GUIDE') NOT NULL
    `);
  }
}

function toIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function canDeleteComment(row: CommentRow, user: AuthUser | null) {
  if (!user) return false;
  return row.author_id === user.id || user.role === 'HEAD' || user.role === 'ADMIN';
}

function mapComment(row: CommentRow, user: AuthUser | null): PostComment {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    parentId: row.parent_id,
    content: row.content,
    authorId: row.author_id,
    authorName: row.author_name || '알 수 없음',
    canDelete: canDeleteComment(row, user),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listComments(input: { targetType: CommentTargetType; targetId: string; user: AuthUser | null }) {
  await ensureCommentsTable();
  const [rows] = await getMysqlPool().query<CommentRow[]>(
    `
      SELECT id, target_type, target_id, parent_id, content, author_id, author_name, created_at, updated_at
      FROM post_comments
      WHERE target_type = ? AND target_id = ?
      ORDER BY created_at ASC, id ASC
    `,
    [input.targetType, input.targetId],
  );

  return rows.map((row) => mapComment(row, input.user));
}

export async function createComment(input: {
  targetType: CommentTargetType;
  targetId: string;
  content: string;
  parentId?: string | null;
  user: AuthUser;
}) {
  await ensureCommentsTable();
  const id = randomUUID();
  const content = input.content.trim();

  await getMysqlPool().execute(
    `
      INSERT INTO post_comments (id, target_type, target_id, parent_id, author_id, author_name, content)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [id, input.targetType, input.targetId, input.parentId ?? null, input.user.id, input.user.name, content],
  );

  const [rows] = await getMysqlPool().query<CommentRow[]>(
    `
      SELECT id, target_type, target_id, parent_id, content, author_id, author_name, created_at, updated_at
      FROM post_comments
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  if (!rows[0]) throw new Error('댓글을 저장하지 못했습니다.');
  return mapComment(rows[0], input.user);
}

export async function deleteComment(input: { id: string; user: AuthUser }) {
  await ensureCommentsTable();
  const [rows] = await getMysqlPool().query<CommentRow[]>(
    `
      SELECT id, target_type, target_id, parent_id, content, author_id, author_name, created_at, updated_at
      FROM post_comments
      WHERE id = ?
      LIMIT 1
    `,
    [input.id],
  );
  const current = rows[0];
  if (!current) return { deleted: false, forbidden: false };
  if (!canDeleteComment(current, input.user)) return { deleted: false, forbidden: true };

  const [result] = await getMysqlPool().execute<ResultSetHeader>('DELETE FROM post_comments WHERE id = ?', [input.id]);
  return { deleted: result.affectedRows > 0, forbidden: false };
}
