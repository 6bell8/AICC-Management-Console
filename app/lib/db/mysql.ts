import fs from 'fs';
import path from 'path';
import mysql, { type Pool } from 'mysql2/promise';

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, 'utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

declare global {
  var __AICC_MYSQL_POOL__: Pool | undefined;
}

function getPort() {
  const raw = getEnv('DB_PORT', 'MYSQL_PORT', 'MYSQLPORT') ?? '3306';
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('DB_PORT must be a positive integer');
  }
  return port;
}

function getEnv(primaryName: string, legacyName: string, railwayName?: string) {
  return process.env[primaryName] ?? process.env[legacyName] ?? (railwayName ? process.env[railwayName] : undefined);
}

function requiredDbEnv(primaryName: string, legacyName: string, railwayName?: string) {
  const value = getEnv(primaryName, legacyName, railwayName);
  if (value == null || value === '') {
    throw new Error(`${primaryName} is required for MySQL connection`);
  }
  return value;
}

export function getMysqlPool() {
  if (!globalThis.__AICC_MYSQL_POOL__) {
    globalThis.__AICC_MYSQL_POOL__ = mysql.createPool({
      host: requiredDbEnv('DB_HOST', 'MYSQL_HOST', 'MYSQLHOST'),
      port: getPort(),
      user: requiredDbEnv('DB_USER', 'MYSQL_USER', 'MYSQLUSER'),
      password: getEnv('DB_PASSWORD', 'MYSQL_PASSWORD', 'MYSQLPASSWORD') ?? '',
      database: requiredDbEnv('DB_NAME', 'MYSQL_DATABASE', 'MYSQLDATABASE'),
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? process.env.MYSQL_CONNECTION_LIMIT ?? 5),
      decimalNumbers: true,
      timezone: 'Z',
    });
  }

  return globalThis.__AICC_MYSQL_POOL__;
}
