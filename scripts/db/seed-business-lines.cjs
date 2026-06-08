const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const { getMysqlConfig, loadLocalEnv } = require('./env.cjs');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATA_PATH = path.join(ROOT_DIR, 'data', 'business-lines.json');

async function main() {
  loadLocalEnv(ROOT_DIR);

  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const lines = Array.isArray(raw) ? raw : [];
  const connection = await mysql.createConnection(getMysqlConfig());

  try {
    for (const line of lines) {
      await connection.execute(
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
          line.id,
          line.jiraKey ?? null,
          line.lineNumber,
          line.serviceType,
          line.botName,
          line.botCode,
          line.requester,
          line.requestedAt,
          line.endedAt ?? null,
          line.regiStatus,
          line.memo ?? null,
        ],
      );
    }

    console.log(`Seeded ${lines.length} business lines.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
