'use client';

import * as React from 'react';
import { Button } from '@/app/components/ui/button';

type RunnerLog = { ts: string; level: 'log' | 'info' | 'warn' | 'error'; text: string };

type WorkerOut =
  | { type: 'LOG'; level: RunnerLog['level']; text: string; ts: string }
  | { type: 'RESULT'; value: any; ts: string }
  | { type: 'ERROR'; message: string; stack?: string; ts: string }
  | { type: 'DONE'; ts: string };

type Props = {
  code: string;
  onChangeCode: (v: string) => void;
  ctxText: string;
  onChangeCtxText: (v: string) => void;
};

function safeStringify(value: any) {
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(
      value,
      (_k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        if (typeof v === 'function') return `[Function ${v.name || 'anonymous'}]`;
        if (typeof v === 'bigint') return `${v.toString()}n`;
        return v;
      },
      2,
    );
  } catch {
    return String(value);
  }
}

export default function DynNodeRunner({ code, onChangeCode, ctxText, onChangeCtxText }: Props) {
  const workerRef = React.useRef<Worker | null>(null);

  const [timeoutMs, setTimeoutMs] = React.useState(2000);
  const [running, setRunning] = React.useState(false);

  const [logs, setLogs] = React.useState<RunnerLog[]>([]);
  const [resultText, setResultText] = React.useState<string>('');
  const [errorText, setErrorText] = React.useState<string>('');

  const logText = React.useMemo(() => {
    return logs.map((l) => `${l.ts.slice(11, 19)} [${l.level}] ${l.text}`).join('\n');
  }, [logs]);

  const ensureWorker = React.useCallback(() => {
    if (workerRef.current) return workerRef.current;

    const w = new Worker(new URL('./runner.worker.ts', import.meta.url));
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      const msg = e.data;

      if (msg.type === 'LOG') {
        setLogs((prev) => [...prev, { ts: msg.ts, level: msg.level, text: msg.text }].slice(-500));
        return;
      }

      if (msg.type === 'RESULT') {
        setResultText(safeStringify(msg.value));
        return;
      }

      if (msg.type === 'ERROR') {
        const stack = msg.stack ? `\n\n${msg.stack}` : '';
        setErrorText(`${msg.message}${stack}`);
        return;
      }

      if (msg.type === 'DONE') {
        setRunning(false);
        return;
      }
    };

    workerRef.current = w;
    return w;
  }, []);

  const resetOutputs = () => {
    setLogs([]);
    setResultText('');
    setErrorText('');
  };

  const terminateWorker = React.useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.terminate();
    workerRef.current = null;
  }, []);

  const onRun = () => {
    resetOutputs();
    setRunning(true);

    const w = ensureWorker();
    w.postMessage({ type: 'RUN', code, ctxText, timeoutMs });
  };

  const onStop = () => {
    // stopFlag만 세우고, 무한루프 같은 건 실제로 못 멈출 수 있으니 terminate+재생성
    const w = workerRef.current;
    if (w) w.postMessage({ type: 'STOP' });

    terminateWorker();
    setRunning(false);
    setLogs((prev) => [...prev, { ts: new Date().toISOString(), level: 'warn', text: 'stopped (terminate worker)' }]);
  };

  React.useEffect(() => {
    return () => terminateWorker();
  }, [terminateWorker]);

  return (
    <div className="rounded-lg border bg-white p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-base font-semibold tracking-tight">코드 실행기</div>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Web Worker</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600">timeout(ms)</label>
          <input
            className="h-9 w-28 rounded-md border px-2 text-sm"
            type="number"
            value={timeoutMs}
            min={300}
            max={10000}
            onChange={(e) => setTimeoutMs(Math.min(Math.max(Number(e.target.value || 0), 300), 10000))}
            disabled={running}
          />

          <Button variant="outline" onClick={resetOutputs} disabled={running}>
            초기화
          </Button>

          {running ? (
            <Button variant="destructive" onClick={onStop}>
              중지
            </Button>
          ) : (
            <Button variant={'outline'} onClick={onRun}>
              실행
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">실행 코드</div>
          </div>
          <textarea
            className="min-h-[260px] w-full rounded-md border bg-slate-50 p-3 font-mono text-[13px] leading-6
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={code}
            onChange={(e) => onChangeCode(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">JSON DATA</div>
            <div className="text-[11px] text-slate-500 font-mono">default: api:API01 </div>
          </div>
          <textarea
            className="min-h-[260px] w-full rounded-md border bg-slate-50 p-3 font-mono text-[13px] leading-6
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={ctxText}
            onChange={(e) => onChangeCtxText(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm font-semibold">logs</div>
          <textarea
            className={`min-h-[260px] w-full rounded-md border p-3 font-mono text-[13px] leading-6
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
    bg-emerald-50/40 text-emerald-900 border-emerald-200`}
            value={logText}
            readOnly
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">result / error</div>
          <textarea
            className={`min-h-[260px] w-full rounded-md border p-3 font-mono text-[13px] leading-6
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
    ${errorText ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-900 border-slate-200'}`}
            value={errorText ? `[ERROR]\n${errorText}` : resultText ? `[RESULT]\n${resultText}` : ''}
            readOnly
          />
        </div>
      </div>

      <div className="text-xs text-slate-500">
        코드 안에서 <span className="font-mono">console.log()</span> 하면 logs로 들어옵니다. (Worker에서 console을 가로챕니다)
      </div>
    </div>
  );
}
