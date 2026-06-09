const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const { getMysqlConfig, loadLocalEnv } = require('./env.cjs');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CONTRACTS_PATH = path.join(ROOT_DIR, 'data', 'contracts.json');
const STATUSES = new Set(['LEAD', 'PROPOSAL', 'NEGOTIATION', 'CONTRACTED', 'DONE']);

function normalizeDate(value) {
  const raw = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 10);
}

function normalizeMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeDeal(raw) {
  return {
    id: String(raw.id || '').trim(),
    status: STATUSES.has(raw.status) ? raw.status : 'LEAD',
    title: String(raw.title || '').trim() || 'Untitled deal',
    customer: String(raw.customer || '').trim() || 'Unknown customer',
    owner: String(raw.owner || '').trim() || 'Unassigned',
    closeDate: normalizeDate(raw.closeDate),
    notes: raw.notes == null ? null : String(raw.notes),
    discount: normalizeMoney(raw.discount),
    commissionRate: normalizeMoney(raw.commissionRate),
    items: Array.isArray(raw.items) ? raw.items : [],
  };
}

function normalizeItem(raw, index) {
  return {
    id: String(raw.id || '').trim(),
    name: String(raw.name || '').trim() || 'Untitled item',
    qty: Math.max(1, Number.parseInt(String(raw.qty ?? 1), 10) || 1),
    unitPrice: normalizeMoney(raw.unitPrice),
    sortOrder: index,
  };
}

async function main() {
  loadLocalEnv(ROOT_DIR);

  const raw = JSON.parse(fs.readFileSync(CONTRACTS_PATH, 'utf-8'));
  const deals = Array.isArray(raw) ? raw.map(normalizeDeal).filter((deal) => deal.id) : [];
  const connection = await mysql.createConnection(getMysqlConfig());

  try {
    await connection.beginTransaction();

    for (const deal of deals) {
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
          deal.title,
          deal.customer,
          deal.owner,
          deal.closeDate,
          deal.notes,
          deal.discount,
          deal.commissionRate,
        ],
      );

      for (const [index, itemRaw] of deal.items.entries()) {
        const item = normalizeItem(itemRaw, index);
        if (!item.id) continue;

        await connection.execute(
          `
            INSERT INTO contract_line_items (
              id, deal_id, name, qty, unit_price, sort_order
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              deal_id = VALUES(deal_id),
              name = VALUES(name),
              qty = VALUES(qty),
              unit_price = VALUES(unit_price),
              sort_order = VALUES(sort_order)
          `,
          [item.id, deal.id, item.name, item.qty, item.unitPrice, item.sortOrder],
        );
      }
    }

    await connection.commit();
    console.log(`Seeded ${deals.length} contract deals.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to seed contract deals.');
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { main };
