'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { DEFAULT_DYNNODE_SAMPLE_CTX } from '@/app/lib/dynnode/defaults';

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

const DEFAULT_CONTEXT_KEY = 'api:API01';

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
  const workerRef = useRef<Worker | null>(null);

  const [timeoutMs, setTimeoutMs] = useState(2000);
  const [contextKey, setContextKey] = useState(DEFAULT_CONTEXT_KEY);
  const [running, setRunning] = useState(false);

  const [logs, setLogs] = useState<RunnerLog[]>([]);
  const [resultText, setResultText] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');

  const logText = useMemo(() => {
    return logs.map((l) => `${l.ts.slice(11, 19)} [${l.level}] ${l.text}`).join('\n');
  }, [logs]);

  const ensureWorker = useCallback(() => {
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

  const resetOutputs = useCallback(() => {
    setLogs([]);
    setResultText('');
    setErrorText('');
  }, []);

  const terminateWorker = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.terminate();
    workerRef.current = null;
  }, []);

  const onRun = useCallback(() => {
    if (running) return; // 실행 중이면 무시
    resetOutputs();

    const normalizedContextKey = contextKey.trim();
    if (!normalizedContextKey) {
      setErrorText('JSON DATA의 userMap 키를 입력해 주세요.');
      return;
    }

    setRunning(true);

    const w = ensureWorker();
    w.postMessage({ type: 'RUN', code, ctxText, contextKey: normalizedContextKey, timeoutMs });
  }, [running, resetOutputs, ensureWorker, code, ctxText, contextKey, timeoutMs]);

  const onStop = useCallback(() => {
    // stopFlag만 세우고, 무한루프 같은 건 실제로 못 멈출 수 있으니 terminate+재생성
    const w = workerRef.current;
    if (w) w.postMessage({ type: 'STOP' });

    terminateWorker();
    setRunning(false);
    setLogs((prev) => [...prev, { ts: new Date().toISOString(), level: 'warn', text: 'stopped (terminate worker)' }]);
  }, [terminateWorker]);

  useEffect(() => {
    return () => terminateWorker();
  }, [terminateWorker]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F5의 브라우저 새로고침 동작을 막고 실행기로 전달합니다.
      if (e.ctrlKey && e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        onRun();
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
  }, [onRun]);

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
            <Button variant="outline" onClick={onRun} className="gap-2">
              실행
              <span className="text-[11px] font-medium text-slate-400 font-mono">Ctrl + F5</span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex h-8 items-center justify-between">
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
          <div className="flex h-8 items-center justify-between gap-2">
            <div className="text-sm font-semibold">JSON DATA</div>
            <button
              type="button"
              className="ml-auto shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => onChangeCtxText(DEFAULT_DYNNODE_SAMPLE_CTX)}
              disabled={running}
            >
              기본 예시
            </button>
            <label htmlFor="dynnode-context-key" className="ml-auto shrink-0 text-[11px] font-medium text-slate-500">
              userMap 키
            </label>
            <input
              id="dynnode-context-key"
              className="h-7 w-36 rounded-md border bg-white px-2 font-mono text-xs sm:w-44"
              value={contextKey}
              onChange={(e) => setContextKey(e.target.value)}
              placeholder={DEFAULT_CONTEXT_KEY}
              disabled={running}
              spellCheck={false}
            />
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
            className="min-h-[260px] w-full rounded-md border p-3 font-mono text-[13px] leading-6
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              bg-emerald-50/40 text-emerald-900 border-emerald-200"
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
        JSON DATA는 지정한 키에 응답 객체 문자열로 저장됩니다. 코드에서{' '}
        <span className="font-mono">JSON.parse(userMap.get(&apos;{contextKey.trim() || DEFAULT_CONTEXT_KEY}&apos;))</span>로
        읽을 수 있으며, <span className="font-mono">console.log()</span> 출력은 logs로 들어옵니다.
      </div>

    </div>
  );
}
