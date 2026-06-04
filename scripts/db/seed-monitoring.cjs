const fs = require('node:fs');
const path = require('node:path');
const { getMysqlConfig, loadLocalEnv } = require('./env.cjs');
const mysql = require('mysql2/promise');

const root = process.cwd();
const file = path.join(root, 'data', 'monitoring.json');

function toMysqlDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 23).replace('T', ' ');
}

async function main() {
  loadLocalEnv(root);

  if (!fs.existsSync(file)) {
    console.log('No monitoring data file found. Skipping.');
    return;
  }

  const source = JSON.parse(fs.readFileSync(file, 'utf8'));
  const runs = Array.isArray(source.runs) ? source.runs : [];
  const config = getMysqlConfig();
  const connection = await mysql.createConnection(config);

  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM monitoring_run_events');
    await connection.execute('DELETE FROM monitoring_runs');

    for (const run of runs) {
      await connection.execute(
        `
          INSERT INTO monitoring_runs (
            run_id, campaign_id, campaign_name, state, started_at, ended_at, duration_ms,
            processed, success, failed, error_code, error_count, latency_avg_ms, latency_p95_ms
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          run.runId,
          run.campaignId,
          run.campaignName,
          run.state,
          toMysqlDateTime(run.startedAt),
          toMysqlDateTime(run.endedAt),
          run.durationMs ?? null,
          Number(run.processed ?? 0),
          Number(run.success ?? 0),
          Number(run.failed ?? 0),
          run.errorCode ?? null,
          Number(run.errorCount ?? 0),
          Number(run.latencyAvgMs ?? 0),
          Number(run.latencyP95Ms ?? 0),
        ],
      );

      const events = Array.isArray(run.events) ? run.events : [];
      for (const event of events) {
        await connection.execute(
          `
            INSERT INTO monitoring_run_events (run_id, event_at, level, type, message, meta)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            run.runId,
            toMysqlDateTime(event.ts),
            event.level,
            event.type,
            event.message,
            event.meta ? JSON.stringify(event.meta) : null,
          ],
        );
      }
    }

    await connection.commit();
    console.log(`Seeded ${runs.length} monitoring runs.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
