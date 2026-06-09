// runner.worker.ts
export {};

type RunMsg = { type: 'RUN'; code: string; ctxText: string; timeoutMs: number };
type StopMsg = { type: 'STOP' };
type InMsg = RunMsg | StopMsg;
type LogLevel = 'log' | 'info' | 'warn' | 'error';

type OutMsg =
  | { type: 'LOG'; level: 'log' | 'info' | 'warn' | 'error'; text: string; ts: string }
  | { type: 'ERROR'; message: string; stack?: string; ts: string }
  | { type: 'DONE'; ts: string };

const nowIso = () => new Date().toISOString();

function postLog(level: LogLevel, ...args: any[]) {
  const text = args
    .map((a) => {
      try {
        return typeof a === 'string' ? a : JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
  (self as any).postMessage({ type: 'LOG', level, text, ts: nowIso() } satisfies OutMsg);
}

function createUserMap() {
  const m = new Map<string, any>();
  return {
    put(key: string, value: any) {
      m.set(key, value);
      return value;
    },
    get(key: string) {
      return m.get(key);
    },
    has(key: string) {
      return m.has(key);
    },
    delete(key: string) {
      return m.delete(key);
    },
    keys() {
      return Array.from(m.keys());
    },
    toJSON() {
      return Object.fromEntries(m.entries());
    },
  };
}

function installGlobals(ctx: any) {
  const um = createUserMap();
  (globalThis as any).userMap = um;

  // ✅ 자동 주입: 실무 패턴 지원 (JSON 문자열로 저장)
  // userMap.get('api:API01') -> '{"body": {...}}'
  um.put('api:API01', JSON.stringify({ body: ctx }));

  // (선택) response.body 스타일도 병행 제공하고 싶으면
  // (globalThis as any).response = { body: ctx };

  // ✅ console 가로채기
  (globalThis as any).console = {
    log: (...args: any[]) => postLog('log', ...args),
    info: (...args: any[]) => postLog('info', ...args),
    warn: (...args: any[]) => postLog('warn', ...args),
    error: (...args: any[]) => postLog('error', ...args),
  };
}

let stopRequested = false;

self.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;

  if (msg.type === 'STOP') {
    stopRequested = true;
    postLog('warn', '[STOP] requested');
    return;
  }

  if (msg.type === 'RUN') {
    stopRequested = false;

    let ctx: any = {};
    try {
      ctx = msg.ctxText ? JSON.parse(msg.ctxText) : {};
    } catch (e: any) {
      (self as any).postMessage({ type: 'ERROR', message: 'ctx JSON 파싱 실패', stack: String(e), ts: nowIso() } satisfies OutMsg);
      return;
    }

    installGlobals(ctx);

    try {
      // 사용자 코드 실행
      // - return 강제 안함
      // - stopRequested를 사용자 코드에서 확인하게 하고 싶으면 전역으로 노출해도 됨
      const fn = new Function('STOP', msg.code);
      fn(() => stopRequested);

      (self as any).postMessage({ type: 'DONE', ts: nowIso() } satisfies OutMsg);
    } catch (e: any) {
      (self as any).postMessage({ type: 'ERROR', message: e?.message ?? String(e), stack: e?.stack, ts: nowIso() } satisfies OutMsg);
    }
  }
};
