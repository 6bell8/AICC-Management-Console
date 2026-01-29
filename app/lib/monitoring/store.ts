// app/lib/monitoring/store.ts
import { z } from 'zod';

export const runStateSchema = z.enum(['RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED']);
export type RunState = z.infer<typeof runStateSchema>;

export const runEventSchema = z.object({
  ts: z.string(), // ISO
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

const DATA_PATH = process.cwd() + '/data/monitoring.json';

function nowIso() {
  return new Date().toISOString();
}

async function readStore(): Promise<MonitoringStore> {
  const fs = await import('fs/promises');
  const raw = await fs.readFile(DATA_PATH, 'utf-8').catch(() => '');
  const text = (raw ?? '').trim();
  if (!text) return { runs: [] };

  try {
    const json = JSON.parse(text);
    const parsed = storeSchema.safeParse(json);
    return parsed.success ? parsed.data : { runs: [] };
  } catch {
    return { runs: [] };
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

  // (선택) 이벤트가 너무 커지지 않게 제한
  const MAX_EVENTS = 200;
  if (run.events.length > MAX_EVENTS) {
    run.events.splice(0, run.events.length - MAX_EVENTS);
  }
}

function tickRuns(runs: CampaignRun[]) {
  const now = Date.now();

  for (const r of runs) {
    if (r.state !== 'RUNNING') continue;

    // 진행 증가(더미)
    const inc = randInt(5, 25);
    const failInc = Math.random() < 0.08 ? randInt(0, 3) : 0;
    const successInc = Math.max(0, inc - failInc);

    r.processed += inc;
    r.success += successInc;
    r.failed += failInc;

    // 지연시간 약간 출렁
    r.latencyAvgMs = Math.max(120, r.latencyAvgMs + randInt(-30, 30));
    r.latencyP95Ms = Math.max(r.latencyAvgMs + 80, r.latencyP95Ms + randInt(-60, 60));

    if (failInc > 0) {
      r.errorCount += failInc;
      r.errorCode = r.errorCode ?? (Math.random() < 0.5 ? '429' : '500');
      pushEvent(r, { level: 'WARN', type: 'ERROR', message: `오류 발생(${r.errorCode})`, meta: { add: failInc } });
    } else {
      pushEvent(r, { level: 'INFO', type: 'PROGRESS', message: `진행중… (+${inc})` });
    }

    // 종료 확률(충분히 진행되면 확률 상승)
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

/**
 * ✅ 새로운 RUN 생성 (캠페인 RUNNING일 때만 생성하는 식으로 확장 가능)
 */
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

// store.ts 상단/중간 아무데나(함수 선언부)에 추가
async function writeStore(store: MonitoringStore) {
  const fs = await import('fs/promises');
  const path = await import('path');

  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });

  const body = JSON.stringify(store, null, 2);
  const tmpPath = `${DATA_PATH}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;

  await fs.writeFile(tmpPath, body, 'utf-8');

  try {
    await fs.rename(tmpPath, DATA_PATH);
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;

    // Windows에서 rename이 간헐적으로 EPERM/EACCES 나는 케이스 폴백
    if (err?.code === 'EPERM' || err?.code === 'EACCES') {
      await fs.copyFile(tmpPath, DATA_PATH);
      await fs.rm(tmpPath, { force: true }).catch(() => {});
      return;
    }

    await fs.rm(tmpPath, { force: true }).catch(() => {});
    throw e;
  }
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * ✅ store를 읽고 tick 적용 후 저장까지 한 번에
 */
export async function loadAndTickStore() {
  const store = await readStore();
  tickRuns(store.runs);
  return store; // ✅ writeStore 호출 제거
}

export async function loadStore() {
  return readStore();
}

export async function saveStore(store: MonitoringStore) {
  await writeStore(store);
}
