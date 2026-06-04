import { randomInt } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';
import type { Campaign, CampaignStatus, CampaignUpdateFormValues } from '../types/campaign';

type CampaignRow = RowDataPacket & {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  start_at: Date | string | null;
  end_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type CampaignStatusFilter = CampaignStatus | 'ALL';

export type CampaignListParams = {
  q?: string;
  status?: CampaignStatusFilter;
  page?: number;
  pageSize?: number;
};

export type CampaignListResult = {
  items: Campaign[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function toIso(value: Date | string | null) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toMysqlDateTime(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 23).replace('T', ' ');
}

function mapCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    startAt: toIso(row.start_at),
    endAt: toIso(row.end_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function clampPage(value: number | undefined) {
  return Number.isInteger(value) && value! > 0 ? value! : 1;
}

function clampPageSize(value: number | undefined) {
  if (!Number.isInteger(value) || value! <= 0) return 10;
  return Math.min(value!, 100);
}

export async function listCampaigns(params: CampaignListParams): Promise<CampaignListResult> {
  const pool = getMysqlPool();
  const q = (params.q ?? '').trim();
  const status = params.status ?? 'ALL';
  const page = clampPage(params.page);
  const pageSize = clampPageSize(params.pageSize);

  const where: string[] = [];
  const values: unknown[] = [];

  if (status !== 'ALL') {
    where.push('status = ?');
    values.push(status);
  }

  if (q) {
    where.push('(name LIKE ? OR id LIKE ? OR description LIKE ?)');
    const keyword = `%${q}%`;
    values.push(keyword, keyword, keyword);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await pool.query<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(*) AS total FROM campaigns ${whereSql}`,
    values,
  );

  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const [rows] = await pool.query<CampaignRow[]>(
    `
      SELECT id, name, description, status, start_at, end_at, created_at, updated_at
      FROM campaigns
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...values, pageSize, offset],
  );

  return {
    items: rows.map(mapCampaign),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export async function getCampaignById(id: string) {
  const pool = getMysqlPool();
  const [rows] = await pool.query<CampaignRow[]>(
    `
      SELECT id, name, description, status, start_at, end_at, created_at, updated_at
      FROM campaigns
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ? mapCampaign(rows[0]) : null;
}

export async function createCampaign() {
  const pool = getMysqlPool();
  const id = `camp_${Date.now()}_${randomInt(100000, 999999)}`;
  const name = `New Campaign (${id})`;

  await pool.execute(
    `
      INSERT INTO campaigns (id, name, description, status)
      VALUES (?, ?, ?, ?)
    `,
    [id, name, null, 'DRAFT'],
  );

  const created = await getCampaignById(id);
  if (!created) throw new Error('Failed to create campaign');
  return created;
}

export async function updateCampaign(id: string, input: CampaignUpdateFormValues) {
  const pool = getMysqlPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `
      UPDATE campaigns
      SET
        name = ?,
        description = ?,
        status = ?,
        start_at = ?,
        end_at = ?
      WHERE id = ?
    `,
    [
      input.name,
      input.description ?? null,
      input.status,
      toMysqlDateTime(input.startAt),
      toMysqlDateTime(input.endAt),
      id,
    ],
  );

  if (result.affectedRows === 0) return null;
  return getCampaignById(id);
}

export async function deleteCampaign(id: string) {
  const pool = getMysqlPool();
  const target = await getCampaignById(id);
  if (!target) return { deleted: false, blocked: false };
  if (target.status === 'RUNNING') return { deleted: false, blocked: true };

  await pool.execute('DELETE FROM campaigns WHERE id = ?', [id]);
  return { deleted: true, blocked: false };
}
