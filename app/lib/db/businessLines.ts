import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';
import type { BusinessLine, BusinessLineServiceType, BusinessLineStatus } from '../types/businessLine';

type BusinessLineRow = RowDataPacket & {
  id: string;
  jira_key: string | null;
  line_number: string;
  service_type: BusinessLineServiceType;
  bot_name: string;
  bot_code: string;
  requester: string;
  requested_at: Date | string;
  ended_at: Date | string | null;
  regi_status: BusinessLineStatus;
  memo: string | null;
};

export type BusinessLineListParams = {
  q?: string;
  status?: BusinessLineStatus | 'ALL';
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

function toDateOnly(value: Date | string | null) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapLine(row: BusinessLineRow): BusinessLine {
  return {
    id: row.id,
    jiraKey: row.jira_key,
    lineNumber: row.line_number,
    serviceType: row.service_type,
    botName: row.bot_name,
    botCode: row.bot_code,
    requester: row.requester,
    requestedAt: toDateOnly(row.requested_at) ?? '',
    endedAt: toDateOnly(row.ended_at),
    regiStatus: row.regi_status,
    memo: row.memo,
  };
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function buildWhere(params: BusinessLineListParams) {
  const where: string[] = [];
  const values: unknown[] = [];

  const q = params.q?.trim();
  if (q) {
    where.push(
      `(jira_key LIKE ? OR line_number LIKE ? OR bot_name LIKE ? OR bot_code LIKE ? OR requester LIKE ? OR memo LIKE ?)`,
    );
    const like = `%${q}%`;
    values.push(like, like, like, like, like, like);
  }

  if (params.status && params.status !== 'ALL') {
    where.push('regi_status = ?');
    values.push(params.status);
  }

  const from = normalizeDate(params.from);
  if (from) {
    where.push('requested_at >= ?');
    values.push(from);
  }

  const to = normalizeDate(params.to);
  if (to) {
    where.push('requested_at <= ?');
    values.push(to);
  }

  return {
    sql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    values,
  };
}

export async function listBusinessLines(params: BusinessLineListParams = {}) {
  const pool = getMysqlPool();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 10));
  const offset = (page - 1) * pageSize;
  const where = buildWhere(params);

  const [countRows] = await pool.query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM business_lines ${where.sql}`,
    where.values,
  );
  const total = Number(countRows[0]?.total ?? 0);

  const [rows] = await pool.query<BusinessLineRow[]>(
    `
      SELECT id, jira_key, line_number, service_type, bot_name, bot_code,
             requester, requested_at, ended_at, regi_status, memo
      FROM business_lines
      ${where.sql}
      ORDER BY requested_at DESC, created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...where.values, pageSize, offset],
  );

  return {
    items: rows.map(mapLine),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function upsertBusinessLine(input: BusinessLine) {
  const pool = getMysqlPool();
  const id = input.id || randomUUID();
  await pool.execute(
    `
      INSERT INTO business_lines (
        id, jira_key, line_number, service_type, bot_name, bot_code,
        requester, requested_at, ended_at, regi_status, memo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        jira_key = VALUES(jira_key),
        service_type = VALUES(service_type),
        bot_name = VALUES(bot_name),
        bot_code = VALUES(bot_code),
        requester = VALUES(requester),
        requested_at = VALUES(requested_at),
        ended_at = VALUES(ended_at),
        regi_status = VALUES(regi_status),
        memo = VALUES(memo)
    `,
    [
      id,
      input.jiraKey || null,
      input.lineNumber,
      input.serviceType,
      input.botName,
      input.botCode,
      input.requester,
      normalizeDate(input.requestedAt) ?? new Date().toISOString().slice(0, 10),
      normalizeDate(input.endedAt),
      input.regiStatus,
      input.memo || null,
    ],
  );
  return id;
}

export async function deleteBusinessLine(id: string) {
  const pool = getMysqlPool();
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM business_lines WHERE id = ?', [id]);
  return result.affectedRows > 0;
}
