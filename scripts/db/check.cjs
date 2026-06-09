const mysql = require('mysql2/promise');

const { getMysqlConfig, loadLocalEnv } = require('./env.cjs');

const ROOT_DIR = require('path').resolve(__dirname, '..', '..');

async function main() {
  loadLocalEnv(ROOT_DIR);

  const connection = await mysql.createConnection(getMysqlConfig());

  try {
    const [pingRows] = await connection.query('SELECT 1 AS ok');
    const [campaignRows] = await connection.query('SELECT COUNT(*) AS total FROM campaigns');

    console.log('MySQL connection ok.');
    console.log(`Ping: ${pingRows[0].ok}`);
    console.log(`Campaigns: ${campaignRows[0].total}`);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('MySQL connection check failed.');
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { main };
