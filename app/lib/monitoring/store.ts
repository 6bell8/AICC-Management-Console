// app/lib/monitoring/store.ts
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from '../db/mysql';

export const runStateSchema = z.enum(['RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED']);
export type RunState = z.infer<typeof runStateSchema>;

export const runEventSchema = z.object({
  ts: z.string(),
  level: z.enum(['INFO', 'WARN', 'ERROR']),
  type: z.enum(['START', 'PROGRESS', 'ERROR', 'RETRY', 'STOP', 'END']),
  message: z.string(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type RunEvent = z.infer<typeof runEventSchema>;

export const runSchema = z.object({
  runId: z.string(),
  campaignId: z.string(),
  campaignName: z.string(),
  state: runStateSchema,
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  processed: z.number().int(),
  success: z.number().int(),
  failed: z.number().int(),
  errorCode: z.string().nullable(),
  errorCount: z.number().int(),
  latencyAvgMs: z.number().int(),
  latencyP95Ms: z.number().int(),
  events: z.array(runEventSchema),
});

export type CampaignRun = z.infer<typeof runSchema>;

const storeSchema = z.object({
  runs: z.array(runSchema),
});

export type MonitoringStore = z.infer<typeof storeSchema>;

type RunRow = RowDataPacket & {
  run_id: string;
  campaign_id: string;
  campaign_name: string;
  state: RunState;
  started_at: Date | string;
  ended_at: Date | string | null;
  duration_ms: number | null;
  processed: number;
  success: number;
  failed: number;
  error_code: string | null;
  error_count: number;
  latency_avg_ms: number;
  latency_p95_ms: number;
};

type EventRow = RowDataPacket & {
  run_id: string;
  event_at: Date | string;
  level: RunEvent['level'];
  type: RunEvent['type'];
  message: string;
  meta: string | Record<string, unknown> | null;
};

function nowIso() {
  return new Date().toISOString();
}

function toIso(value: Date | string | null) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toMysqlDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 23).replace('T', ' ');
}

function parseMeta(value: EventRow['meta']) {
  if (value == null) return undefined;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function pushEvent(run: CampaignRun, e: Omit<RunEvent, 'ts'> & { ts?: string }) {
  const event: RunEvent = {
    ts: e.ts ?? nowIso(),
    level: e.level,
    type: e.type,
    message: e.message,
    meta: e.meta,
  };

  run.events.push(event);

  const MAX_EVENTS = 200;
  if (run.events.length > MAX_EVENTS) {
    run.events.splice(0, run.events.length - MAX_EVENTS);
  }
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function tickRuns(runs: CampaignRun[]) {
  const now = Date.now();

  for (const r of runs) {
    if (r.state !== 'RUNNING') continue;

    const inc = randInt(5, 25);
    const failInc = Math.random() < 0.08 ? randInt(0, 3) : 0;
    const successInc = Math.max(0, inc - failInc);

    r.processed += inc;
    r.success += successInc;
    r.failed += failInc;
    r.latencyAvgMs = Math.max(120, r.latencyAvgMs + randInt(-30, 30));
    r.latencyP95Ms = Math.max(r.latencyAvgMs + 80, r.latencyP95Ms + randInt(-60, 60));

    if (failInc > 0) {
      r.errorCount += failInc;
      r.errorCode = r.errorCode ?? (Math.random() < 0.5 ? '429' : '500');
      pushEvent(r, { level: 'WARN', type: 'ERROR', message: `오류 발생(${r.errorCode})`, meta: { add: failInc } });
    } else {
      pushEvent(r, { level: 'INFO', type: 'PROGRESS', message: `진행중...(+${inc})` });
    }

    const doneProb = r.processed > 120 ? 0.18 : 0.08;
    if (Math.random() < doneProb) {
      const isFail = r.errorCount >= 8 || Math.random() < 0.12;
      r.state = isFail ? 'FAILED' : 'SUCCESS';
      r.endedAt = nowIso();
      r.durationMs = now - new Date(r.startedAt).getTime();
      pushEvent(r, {
        level: isFail ? 'ERROR' : 'INFO',
        type: 'END',
        message: isFail ? '실행 실패로 종료' : '정상 종료',
      });
      if (!isFail) r.errorCode = null;
    }
  }
}

export function makeRun(campaignId: string, campaignName: string): CampaignRun {
  const startedAt = nowIso();
  const runId = `run_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

  const run: CampaignRun = {
    runId,
    campaignId,
    campaignName,
    state: 'RUNNING',
    startedAt,
    endedAt: null,
    durationMs: null,
    processed: 0,
    success: 0,
    failed: 0,
    errorCode: null,
    errorCount: 0,
    latencyAvgMs: randInt(180, 420),
    latencyP95Ms: randInt(420, 900),
    events: [],
  };

  pushEvent(run, { level: 'INFO', type: 'START', message: '실행 시작' });
  return run;
}

function mapRun(row: RunRow, events: RunEvent[]): CampaignRun {
  return {
    runId: row.run_id,
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    state: row.state,
    startedAt: toIso(row.started_at) ?? nowIso(),
    endedAt: toIso(row.ended_at),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    processed: Number(row.processed),
    success: Number(row.success),
    failed: Number(row.failed),
    errorCode: row.error_code,
    errorCount: Number(row.error_count),
    latencyAvgMs: Number(row.latency_avg_ms),
    latencyP95Ms: Number(row.latency_p95_ms),
    events,
  };
}

export async function loadStore() {
  const pool = getMysqlPool();
  const [runRows] = await pool.query<RunRow[]>(
    `
      SELECT run_id, campaign_id, campaign_name, state, started_at, ended_at, duration_ms,
             processed, success, failed, error_code, error_count, latency_avg_ms, latency_p95_ms
      FROM monitoring_runs
      ORDER BY started_at DESC
    `,
  );

  if (runRows.length === 0) return { runs: [] };

  const [eventRows] = await pool.query<EventRow[]>(
    `
      SELECT run_id, event_at, level, type, message, meta
      FROM monitoring_run_events
      ORDER BY run_id ASC, event_at ASC, id ASC
    `,
  );

  const eventsByRunId = new Map<string, RunEvent[]>();
  for (const event of eventRows) {
    const list = eventsByRunId.get(event.run_id) ?? [];
    const meta = parseMeta(event.meta);
    list.push({
      ts: toIso(event.event_at) ?? nowIso(),
      level: event.level,
      type: event.type,
      message: event.message,
      ...(meta ? { meta } : {}),
    });
    eventsByRunId.set(event.run_id, list);
  }

  return { runs: runRows.map((run) => mapRun(run, eventsByRunId.get(run.run_id) ?? [])) };
}

export async function saveStore(store: MonitoringStore) {
  const parsed = storeSchema.parse(store);
  const pool = getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM monitoring_run_events');
    await connection.execute('DELETE FROM monitoring_runs');

    for (const run of parsed.runs) {
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
          run.durationMs,
          run.processed,
          run.success,
          run.failed,
          run.errorCode,
          run.errorCount,
          run.latencyAvgMs,
          run.latencyP95Ms,
        ],
      );

      for (const event of run.events) {
        await connection.execute(
          `
            INSERT INTO monitoring_run_events (run_id, event_at, level, type, message, meta)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [run.runId, toMysqlDateTime(event.ts), event.level, event.type, event.message, event.meta ? JSON.stringify(event.meta) : null],
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function loadAndTickStore() {
  const store = await loadStore();
  tickRuns(store.runs);
  await saveStore(store);
  return store;
}
