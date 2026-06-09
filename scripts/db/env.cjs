const fs = require('fs');
const path = require('path');

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) return null;

  const key = trimmed.slice(0, eqIndex).trim();
  let value = trimmed.slice(eqIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, 'utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (process.env[parsed.key] == null) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

function loadLocalEnv(rootDir) {
  loadEnvFile(path.join(rootDir, '.env.local'));
  loadEnvFile(path.join(rootDir, '.env'));
}

function getEnv(primaryName, legacyName, railwayName) {
  return process.env[primaryName] || process.env[legacyName] || (railwayName ? process.env[railwayName] : undefined);
}

function requiredEnv(primaryName, legacyName, railwayName) {
  const value = getEnv(primaryName, legacyName, railwayName);
  if (value == null || value === '') {
    throw new Error(`${primaryName} is required for MySQL connection`);
  }
  return value;
}

function getMysqlConfig(options = {}) {
  const database = requiredEnv('DB_NAME', 'MYSQL_DATABASE', 'MYSQLDATABASE');

  return {
    host: requiredEnv('DB_HOST', 'MYSQL_HOST', 'MYSQLHOST'),
    port: Number(getEnv('DB_PORT', 'MYSQL_PORT', 'MYSQLPORT') || 3306),
    user: requiredEnv('DB_USER', 'MYSQL_USER', 'MYSQLUSER'),
    password: getEnv('DB_PASSWORD', 'MYSQL_PASSWORD', 'MYSQLPASSWORD') || '',
    database: options.includeDatabase === false ? undefined : database,
    multipleStatements: options.multipleStatements === true,
  };
}

module.exports = {
  getMysqlConfig,
  loadLocalEnv,
};
