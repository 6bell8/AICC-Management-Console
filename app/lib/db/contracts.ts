import type { RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';
import type { ContractDeal, ContractLineItem, ContractStatus } from '../types/contracts';

type ContractDealRow = RowDataPacket & {
  id: string;
  status: ContractStatus;
  title: string;
  customer: string;
  owner: string;
  close_date: Date | string;
  notes: string | null;
  discount: number | string;
  commission_rate: number | string;
};

type ContractLineItemRow = RowDataPacket & {
  id: string;
  deal_id: string;
  name: string;
  qty: number;
  unit_price: number | string;
};

function toDateOnly(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapDeal(row: ContractDealRow, items: ContractLineItem[]): ContractDeal {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    customer: row.customer,
    owner: row.owner,
    closeDate: toDateOnly(row.close_date),
    notes: row.notes ?? undefined,
    discount: Number(row.discount),
    commissionRate: Number(row.commission_rate),
    items,
  };
}

function toDateOnlyInput(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return new Date().toISOString().slice(0, 10);
}

export async function listContractDeals() {
  const pool = getMysqlPool();
  const [dealRows] = await pool.query<ContractDealRow[]>(
    `
      SELECT id, status, title, customer, owner, close_date, notes, discount, commission_rate
      FROM contract_deals
      ORDER BY close_date ASC, updated_at DESC
    `,
  );

  if (dealRows.length === 0) return [];

  const [itemRows] = await pool.query<ContractLineItemRow[]>(
    `
      SELECT id, deal_id, name, qty, unit_price
      FROM contract_line_items
      ORDER BY deal_id ASC, sort_order ASC, created_at ASC
    `,
  );

  const itemsByDealId = new Map<string, ContractLineItem[]>();
  for (const item of itemRows) {
    const list = itemsByDealId.get(item.deal_id) ?? [];
    list.push({
      id: item.id,
      name: item.name,
      qty: Number(item.qty),
      unitPrice: Number(item.unit_price),
    });
    itemsByDealId.set(item.deal_id, list);
  }

  return dealRows.map((deal) => mapDeal(deal, itemsByDealId.get(deal.id) ?? []));
}

export async function upsertContractDeal(deal: ContractDeal) {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      `
        INSERT INTO contract_deals (
          id, status, title, customer, owner, close_date, notes, discount, commission_rate
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          title = VALUES(title),
          customer = VALUES(customer),
          owner = VALUES(owner),
          close_date = VALUES(close_date),
          notes = VALUES(notes),
          discount = VALUES(discount),
          commission_rate = VALUES(commission_rate)
      `,
      [
        deal.id,
        deal.status,
        deal.title.trim(),
        deal.customer.trim(),
        deal.owner.trim() || 'Unassigned',
        toDateOnlyInput(deal.closeDate),
        deal.notes?.trim() || null,
        deal.discount,
        deal.commissionRate,
      ],
    );

    await connection.execute('DELETE FROM contract_line_items WHERE deal_id = ?', [deal.id]);

    for (const [index, item] of deal.items.entries()) {
      await connection.execute(
        `
          INSERT INTO contract_line_items (id, deal_id, name, qty, unit_price, sort_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          item.id,
          deal.id,
          item.name.trim() || 'Untitled item',
          Math.max(1, Number(item.qty || 1)),
          Math.max(0, Number(item.unitPrice || 0)),
          index,
        ],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateContractDealStatus(id: string, status: ContractStatus) {
  const pool = getMysqlPool();
  const [result] = await pool.execute('UPDATE contract_deals SET status = ? WHERE id = ?', [status, id]);
  return result;
}

export async function deleteContractDeal(id: string) {
  const pool = getMysqlPool();
  const [result] = await pool.execute('DELETE FROM contract_deals WHERE id = ?', [id]);
  return result;
}
