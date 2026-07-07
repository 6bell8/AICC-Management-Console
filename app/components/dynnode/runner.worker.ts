export {};

type RunMsg = { type: 'RUN'; code: string; ctxKey: string; ctxText: string; timeoutMs: number };
type StopMsg = { type: 'STOP' };
type InMsg = RunMsg | StopMsg;
type LogLevel = 'log' | 'info' | 'warn' | 'error';

type OutMsg =
  | { type: 'LOG'; level: LogLevel; text: string; ts: string }
  | { type: 'RESULT'; value: unknown; ts: string }
  | { type: 'ERROR'; message: string; stack?: string; ts: string }
  | { type: 'DONE'; ts: string };

const nowIso = () => new Date().toISOString();

function postMessageToClient(message: OutMsg) {
  (self as { postMessage: (value: OutMsg) => void }).postMessage(message);
}

function postLog(level: LogLevel, ...args: unknown[]) {
  const text = args
    .map((value) => {
      try {
        return typeof value === 'string' ? value : JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join(' ');

  postMessageToClient({ type: 'LOG', level, text, ts: nowIso() });
}

function createUserMap() {
  const map = new Map<string, unknown>();
  return {
    put(key: string, value: unknown) {
      map.set(key, value);
      return value;
    },
    get(key: string) {
      return map.get(key);
    },
    has(key: string) {
      return map.has(key);
    },
    delete(key: string) {
      return map.delete(key);
    },
    keys() {
      return Array.from(map.keys());
    },
    toJSON() {
      return Object.fromEntries(map.entries());
    },
  };
}

function installGlobals(ctx: unknown, ctxKey: string) {
  const userMap = createUserMap();
  (globalThis as { userMap?: ReturnType<typeof createUserMap> }).userMap = userMap;

  userMap.put(ctxKey.trim() || 'api:API01', JSON.stringify({ body: ctx }));

  (globalThis as { console?: Pick<Console, 'log' | 'info' | 'warn' | 'error'> }).console = {
    log: (...args: unknown[]) => postLog('log', ...args),
    info: (...args: unknown[]) => postLog('info', ...args),
    warn: (...args: unknown[]) => postLog('warn', ...args),
    error: (...args: unknown[]) => postLog('error', ...args),
  };
}

let stopRequested = false;

self.onmessage = (event: MessageEvent<InMsg>) => {
  const message = event.data;

  if (message.type === 'STOP') {
    stopRequested = true;
    postLog('warn', '[STOP] requested');
    return;
  }

  stopRequested = false;

  let ctx: unknown = {};
  try {
    ctx = message.ctxText ? JSON.parse(message.ctxText) : {};
  } catch (error) {
    postMessageToClient({ type: 'ERROR', message: 'ctx JSON 파싱 실패', stack: String(error), ts: nowIso() });
    postMessageToClient({ type: 'DONE', ts: nowIso() });
    return;
  }

  installGlobals(ctx, message.ctxKey);

  try {
    const startedAt = performance.now();
    const run = new Function('STOP', message.code);
    const value = run(() => stopRequested);
    const elapsed = Math.round(performance.now() - startedAt);

    if (elapsed > message.timeoutMs) {
      postLog('warn', `timeout 기준(${message.timeoutMs}ms)을 초과했습니다. 실제 실행 시간: ${elapsed}ms`);
    }

    if (value !== undefined) {
      postMessageToClient({ type: 'RESULT', value, ts: nowIso() });
    }
    postMessageToClient({ type: 'DONE', ts: nowIso() });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    postMessageToClient({ type: 'ERROR', message: err.message, stack: err.stack, ts: nowIso() });
    postMessageToClient({ type: 'DONE', ts: nowIso() });
  }
};
