const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const { getMysqlConfig, loadLocalEnv } = require('./env.cjs');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SCHEMA_PATH = path.join(ROOT_DIR, 'docs', 'db', 'mysql-schema.sql');

function quoteIdentifier(value) {
  if (!/^[A-Za-z0-9_$]+$/.test(value)) {
    throw new Error('DB_NAME contains unsupported characters');
  }
  return `\`${value}\``;
}

async function main() {
  loadLocalEnv(ROOT_DIR);

  const sql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const dbConfig = getMysqlConfig();
  const connection = await mysql.createConnection(
    getMysqlConfig({ includeDatabase: false, multipleStatements: true }),
  );

  try {
    const databaseName = quoteIdentifier(dbConfig.database);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${databaseName} DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_0900_ai_ci`,
    );
    await connection.query(`USE ${databaseName}`);
    await connection.query(sql);
    console.log('MySQL schema applied.');
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to apply MySQL schema.');
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { main };
