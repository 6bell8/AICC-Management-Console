const bcrypt = require('bcryptjs');
const { getMysqlConfig, loadLocalEnv } = require('./env.cjs');
const mysql = require('mysql2/promise');
const { randomUUID } = require('node:crypto');

const ROOT_DIR = process.cwd();

async function main() {
  loadLocalEnv(ROOT_DIR);

  const email = (process.env.AUTH_HEAD_EMAIL || '').trim().toLowerCase();
  const password = process.env.AUTH_HEAD_PASSWORD || '';
  const name = (process.env.AUTH_HEAD_NAME || 'Head Admin').trim();

  if (!email || !password) {
    console.log('AUTH_HEAD_EMAIL or AUTH_HEAD_PASSWORD is not set. Skipping head admin seed.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const connection = await mysql.createConnection(getMysqlConfig());

  try {
    await connection.execute(
      `
        INSERT INTO users (id, email, password_hash, name, role, status, approved_at)
        VALUES (?, ?, ?, ?, 'HEAD', 'APPROVED', CURRENT_TIMESTAMP(3))
        ON DUPLICATE KEY UPDATE
          password_hash = VALUES(password_hash),
          name = VALUES(name),
          role = 'HEAD',
          status = 'APPROVED',
          approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP(3))
      `,
      [randomUUID(), email, passwordHash, name],
    );

    console.log('Seeded HEAD admin account.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
