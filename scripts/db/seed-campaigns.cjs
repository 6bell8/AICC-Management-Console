const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const { getMysqlConfig, loadLocalEnv } = require('./env.cjs');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CAMPAIGNS_PATH = path.join(ROOT_DIR, 'data', 'campaigns.json');
const STATUSES = new Set(['DRAFT', 'RUNNING', 'PAUSED', 'ARCHIVED']);

function toMysqlDateTime(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 23).replace('T', ' ');
}

function normalizeCampaign(raw) {
  const now = new Date().toISOString();
  const status = STATUSES.has(raw.status) ? raw.status : 'DRAFT';

  return {
    id: String(raw.id || '').trim(),
    name: String(raw.name || '').trim() || 'Untitled campaign',
    description: raw.description == null ? null : String(raw.description),
    status,
    startAt: toMysqlDateTime(raw.startAt),
    endAt: toMysqlDateTime(raw.endAt),
    createdAt: toMysqlDateTime(raw.createdAt || now),
    updatedAt: toMysqlDateTime(raw.updatedAt || now),
  };
}

async function main() {
  loadLocalEnv(ROOT_DIR);

  const raw = JSON.parse(fs.readFileSync(CAMPAIGNS_PATH, 'utf-8'));
  const campaigns = Array.isArray(raw) ? raw.map(normalizeCampaign).filter((item) => item.id) : [];

  const connection = await mysql.createConnection(getMysqlConfig());

  try {
    for (const campaign of campaigns) {
      await connection.execute(
        `
          INSERT INTO campaigns (
            id, name, description, status, start_at, end_at, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            description = VALUES(description),
            status = VALUES(status),
            start_at = VALUES(start_at),
            end_at = VALUES(end_at),
            created_at = VALUES(created_at),
            updated_at = VALUES(updated_at)
        `,
        [
          campaign.id,
          campaign.name,
          campaign.description,
          campaign.status,
          campaign.startAt,
          campaign.endAt,
          campaign.createdAt,
          campaign.updatedAt,
        ],
      );
    }

    console.log(`Seeded ${campaigns.length} campaigns.`);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to seed campaigns.');
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { main };
