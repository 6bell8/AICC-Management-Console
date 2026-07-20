'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import {
  Braces,
  ClipboardCopy,
  FileCode2,
  FileJson2,
  KeyRound,
  ListChecks,
  Play,
  RotateCcw,
  Square,
  Terminal,
  Timer,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { useToast } from '@/app/components/ui/use-toast';

type RunnerLog = { ts: string; level: 'log' | 'info' | 'warn' | 'error'; text: string };

type WorkerOut =
  | { type: 'LOG'; level: RunnerLog['level']; text: string; ts: string }
  | { type: 'RESULT'; value: unknown; ts: string }
  | { type: 'ERROR'; message: string; stack?: string; ts: string }
  | { type: 'DONE'; ts: string };

type Props = {
  code: string;
  onChangeCode: (v: string) => void;
  ctxText: string;
  onChangeCtxText: (v: string) => void;
  ctxKey: string;
  onChangeCtxKey: (v: string) => void;
  disabled?: boolean;
};

const fieldClass =
  'h-10 min-w-0 rounded-md border border-transparent bg-slate-50 px-3 text-sm leading-none text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60';
const textareaClass =
  'min-h-[420px] w-full resize-y rounded-md border border-slate-700 bg-slate-950 py-3 pl-14 pr-3 font-mono text-[13px] leading-6 text-slate-100 shadow-inner outline-none transition caret-sky-300 placeholder:text-slate-500 selection:bg-sky-500/30 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60';
const sampleCode = `// 'api:API01'은 default response 응답값입니다.
var res = JSON.parse(userMap.get('api:API01'));
var body = res.body || {};

var summary = body.summary == null ? '(없음)' : body.summary;

userMap.put('summary', summary);
console.log(userMap.get('summary'));`;
const sampleJson = `{
  "body": {
    "summary": "샘플 응답입니다.",
    "status": "READY"
  }
}`;
const ctxKeyOptions = ['api:API01', 'summary', 'body', 'result'];

function safeStringify(value: unknown) {
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(
      value,
      (_key, item) => {
        if (typeof item === 'object' && item !== null) {
          if (seen.has(item)) return '[Circular]';
          seen.add(item);
        }
        if (typeof item === 'function') return `[Function ${item.name || 'anonymous'}]`;
        if (typeof item === 'bigint') return `${item.toString()}n`;
        return item;
      },
      2,
    );
  } catch {
    return String(value);
  }
}

export default function DynNodeRunner({ code, ctxKey, ctxText, disabled = false, onChangeCode, onChangeCtxKey, onChangeCtxText }: Props) {
  const workerRef = useRef<Worker | null>(null);
  const { toast } = useToast();

  const [timeoutMs, setTimeoutMs] = useState(2000);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<RunnerLog[]>([]);
  const [resultText, setResultText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [splitPercent, setSplitPercent] = useState(58);
  const [resizing, setResizing] = useState(false);
  const editorSplitRef = useRef<HTMLDivElement | null>(null);

  const logText = useMemo(() => logs.map((log) => `${log.ts.slice(11, 19)} [${log.level}] ${log.text}`).join('\n'), [logs]);
  const outputText = useMemo(() => {
    if (errorText) return `[ERROR]\n${errorText}`;
    if (resultText) return `[RESULT]\n${resultText}`;
    return '';
  }, [errorText, resultText]);
  const inputDisabled = disabled || running;
  const editorSplitStyle = { '--code-pane': `${splitPercent}fr`, '--json-pane': `${100 - splitPercent}fr` } as CSSProperties;

  const updateSplitFromClientX = useCallback((clientX: number) => {
    const rect = editorSplitRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setSplitPercent(Math.min(74, Math.max(36, next)));
  }, []);

  useEffect(() => {
    if (!resizing) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    const onPointerMove = (event: globalThis.PointerEvent) => updateSplitFromClientX(event.clientX);
    const onPointerUp = () => setResizing(false);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [resizing, updateSplitFromClientX]);

  const onSplitterPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      updateSplitFromClientX(event.clientX);
      setResizing(true);
    },
    [updateSplitFromClientX],
  );

  const copyText = useCallback(
    async (label: string, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        toast({ title: '복사 완료', description: `${label} 내용을 복사했습니다.` });
      } catch {
        toast({ title: '복사 실패', description: '브라우저에서 클립보드 접근을 허용하지 않았습니다.', variant: 'destructive' });
      }
    },
    [toast],
  );

  const formatJson = useCallback(() => {
    try {
      const parsed = JSON.parse(ctxText);
      onChangeCtxText(JSON.stringify(parsed, null, 2));
      toast({ title: 'JSON 정리 완료', description: 'JSON DATA를 보기 좋게 정렬했습니다.' });
    } catch {
      toast({ title: 'JSON 형식 오류', description: 'JSON DATA를 먼저 올바른 JSON 형식으로 맞춰주세요.', variant: 'destructive' });
    }
  }, [ctxText, onChangeCtxText, toast]);

  const terminateWorker = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.terminate();
    workerRef.current = null;
  }, []);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;

    const worker = new Worker(new URL('./runner.worker.ts', import.meta.url));
    worker.onmessage = (event: MessageEvent<WorkerOut>) => {
      const message = event.data;

      if (message.type === 'LOG') {
        setLogs((prev) => [...prev, { ts: message.ts, level: message.level, text: message.text }].slice(-500));
        return;
      }

      if (message.type === 'RESULT') {
        setResultText(safeStringify(message.value));
        return;
      }

      if (message.type === 'ERROR') {
        const stack = message.stack ? `\n\n${message.stack}` : '';
        setErrorText(`${message.message}${stack}`);
        setRunning(false);
        toast({ title: '실행 실패', description: message.message || '동적노드 실행 중 오류가 발생했습니다.', variant: 'destructive' });
        return;
      }

      if (message.type === 'DONE') {
        setRunning(false);
        toast({ title: '실행 완료', description: '동적노드 테스트 실행이 완료되었습니다.' });
      }
    };

    workerRef.current = worker;
    return worker;
  }, [toast]);

  const resetOutputs = useCallback(() => {
    setLogs([]);
    setResultText('');
    setErrorText('');
  }, []);

  const onRun = useCallback(() => {
    if (running) return;

    try {
      new Function('userMap', code);
    } catch (error) {
      toast({ title: '코드 문법 오류', description: error instanceof Error ? error.message : '실행 코드를 확인해 주세요.', variant: 'destructive' });
      return;
    }

    try {
      JSON.parse(ctxText);
    } catch (error) {
      toast({ title: 'JSON 형식 오류', description: error instanceof Error ? error.message : 'JSON DATA를 확인해 주세요.', variant: 'destructive' });
      return;
    }

    resetOutputs();
    setRunning(true);

    const worker = ensureWorker();
    worker.postMessage({ type: 'RUN', code, ctxKey, ctxText, timeoutMs });
  }, [code, ctxKey, ctxText, ensureWorker, resetOutputs, running, timeoutMs, toast]);

  const onStop = useCallback(() => {
    const worker = workerRef.current;
    if (worker) worker.postMessage({ type: 'STOP' });

    terminateWorker();
    setRunning(false);
    setLogs((prev) => [...prev, { ts: new Date().toISOString(), level: 'warn', text: 'stopped (terminate worker)' }]);
  }, [terminateWorker]);

  useEffect(() => {
    return () => terminateWorker();
  }, [terminateWorker]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      const tag = element?.tagName?.toLowerCase();
      const isTyping = tag === 'textarea' || tag === 'input' || tag === 'select' || element?.getAttribute?.('contenteditable') === 'true';

      if (event.ctrlKey && event.key === 'F10') {
        event.preventDefault();
        event.stopPropagation();
        if (!isTyping) onRun();
        return;
      }

      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        if (!isTyping) onRun();
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onRun]);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 xl:border-transparent xl:bg-transparent xl:px-0 xl:py-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-sky-100 bg-sky-50 text-sky-700">
            <Terminal className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-tight text-slate-950">코드 실행기</div>
            <div className="text-xs text-slate-500">Web Worker 기반 테스트 실행 환경</div>
          </div>
        </div>

        <div className="grid gap-2 p-2 sm:ml-auto sm:grid-cols-[235px_172px_auto_auto] sm:items-center sm:gap-x-4 xl:w-auto">
          <label className="grid min-w-0 grid-cols-[86px_minmax(0,1fr)] items-center gap-2 sm:relative sm:block">
            <span className="flex items-center justify-end gap-1.5 text-right text-[11px] font-medium text-slate-500 sm:absolute sm:-top-5 sm:right-0 sm:justify-end">
              <KeyRound className="h-3.5 w-3.5 text-sky-600" />
              userMap key
            </span>
            <input
              className={`${fieldClass} w-full text-right font-mono`}
              value={ctxKey}
              onChange={(event) => onChangeCtxKey(event.target.value)}
              placeholder="api:API01"
              list="dynnode-ctx-key-options"
              disabled={inputDisabled}
            />
            <datalist id="dynnode-ctx-key-options">
              {ctxKeyOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
          <label className="grid min-w-0 grid-cols-[86px_minmax(0,1fr)] items-center gap-2 sm:relative sm:block">
            <span className="flex items-center justify-end gap-1.5 text-right text-[11px] font-medium text-slate-500 sm:absolute sm:-top-5 sm:right-0 sm:justify-end">
              <Timer className="h-3.5 w-3.5 text-sky-600" />
              timeout
            </span>
            <div className="relative">
              <input
                className={`${fieldClass} w-full pr-9 text-right`}
                type="number"
                value={timeoutMs}
                min={300}
                max={10000}
                onChange={(event) => setTimeoutMs(Math.min(Math.max(Number(event.target.value || 0), 300), 10000))}
                disabled={running}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">ms</span>
            </div>
          </label>

          <Button variant="outline" onClick={resetOutputs} disabled={running} className="h-10 gap-2 border-transparent bg-slate-50 text-slate-700 shadow-none hover:border-transparent hover:bg-slate-100 sm:mb-0">
            <RotateCcw className="h-4 w-4 shrink-0" />
            초기화
          </Button>

          {running ? (
            <Button variant="destructive" onClick={onStop} className="h-10 gap-2">
              <Square className="h-4 w-4 shrink-0" />
              중지
            </Button>
          ) : (
            <Button variant="outline" onClick={onRun} className="h-10 gap-2 border-transparent bg-slate-50 text-sky-700 shadow-none hover:border-transparent hover:bg-sky-50">
              <Play className="h-4 w-4 shrink-0" />
              실행
            </Button>
          )}
        </div>
      </div>

      <div
        ref={editorSplitRef}
        className="grid gap-3 xl:grid-cols-[minmax(360px,var(--code-pane))_10px_minmax(320px,var(--json-pane))] xl:gap-0"
        style={editorSplitStyle}
      >
        <section className="space-y-2">
          <PanelHeader
            icon={<Terminal className="h-4 w-4" />}
            title="실행 코드"
            badge="JavaScript"
            align="split"
            actions={
              <>
                <IconAction label="복사" onClick={() => copyText('실행 코드', code)} icon={ClipboardCopy} />
                <IconAction label="샘플" onClick={() => onChangeCode(sampleCode)} icon={FileCode2} disabled={inputDisabled} />
                <IconAction label="초기화" onClick={() => onChangeCode('')} icon={RotateCcw} disabled={inputDisabled} />
              </>
            }
          />
          <CodeTextarea value={code} onChange={onChangeCode} ariaLabel="실행 코드" disabled={inputDisabled} />
        </section>

        <button
          type="button"
          className={[
            'group relative z-20 hidden cursor-col-resize items-stretch justify-center px-0 outline-none xl:flex',
            resizing ? 'text-sky-500' : 'text-slate-300 hover:text-sky-500 focus-visible:text-sky-600',
          ].join(' ')}
          onPointerDown={onSplitterPointerDown}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              setSplitPercent((current) => Math.max(36, current - 3));
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              setSplitPercent((current) => Math.min(74, current + 3));
            }
          }}
          role="separator"
          aria-orientation="vertical"
          aria-valuemin={36}
          aria-valuemax={74}
          aria-valuenow={Math.round(splitPercent)}
          aria-label="에디터 너비 조절"
          title="드래그해서 에디터 너비 조절"
        >
          <span className="relative mt-[52px] flex min-h-[420px] w-2 items-center justify-center">
            <span
              aria-hidden="true"
              className={[
                'absolute inset-y-1 left-1/2 w-px -translate-x-1/2 rounded-full transition-all duration-200',
                resizing ? 'bg-sky-300 shadow-[0_0_0_1px_rgba(186,230,253,0.75)]' : 'bg-slate-200 group-hover:bg-sky-200 group-focus-visible:bg-sky-300',
              ].join(' ')}
            />
            <span
              aria-hidden="true"
              className={[
                'absolute left-1/2 top-1/2 grid h-8 w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 opacity-0 shadow-sm ring-1 ring-slate-200/80 backdrop-blur transition',
                'group-hover:opacity-100 group-focus-visible:opacity-100',
                resizing ? 'opacity-100 ring-sky-200' : '',
              ].join(' ')}
            >
              <span className="flex flex-col gap-0.5">
                <span className="h-0.5 w-0.5 rounded-full bg-current" />
                <span className="h-0.5 w-0.5 rounded-full bg-current" />
                <span className="h-0.5 w-0.5 rounded-full bg-current" />
              </span>
            </span>
          </span>
        </button>

        <section className="space-y-2">
          <PanelHeader
            icon={<Braces className="h-4 w-4" />}
            title="JSON DATA"
            badge={ctxKey.trim() || 'api:API01'}
            align="between"
            actions={
              <>
                <IconAction label="복사" onClick={() => copyText('JSON DATA', ctxText)} icon={ClipboardCopy} />
                <IconAction label="정리" onClick={formatJson} icon={ListChecks} disabled={inputDisabled} />
                <IconAction label="샘플" onClick={() => onChangeCtxText(sampleJson)} icon={FileJson2} disabled={inputDisabled} />
              </>
            }
          />
          <CodeTextarea value={ctxText} onChange={onChangeCtxText} ariaLabel="JSON DATA" disabled={inputDisabled} />
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="space-y-2">
          <PanelHeader title="logs" badge="console" />
          <textarea
            className="min-h-[220px] w-full resize-y rounded-md border border-emerald-200 bg-emerald-50/40 p-3 font-mono text-[13px] leading-6 text-emerald-900 shadow-inner outline-none focus:ring-2 focus:ring-emerald-100"
            value={logText}
            readOnly
          />
        </section>

        <section className="space-y-2">
          <PanelHeader title="result / error" badge={errorText ? 'error' : 'result'} />
          <pre
            className={`min-h-[220px] max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border p-3 font-mono text-[13px] leading-6 shadow-inner ${
              errorText ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50/80 text-slate-900'
            }`}
          >
            {outputText}
          </pre>
        </section>
      </div>

      <div className="hidden rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500 sm:block">
        코드 안에서 <span className="font-mono text-slate-700">console.log()</span>를 사용하면 logs에 출력됩니다. 입력 중이 아닐 때{' '}
        <span className="font-mono text-slate-700">Ctrl + F10</span> 또는 <span className="font-mono text-slate-700">Ctrl + Enter</span>로 실행할 수
        있습니다.
      </div>
    </div>
  );
}

function CodeTextarea({
  ariaLabel,
  disabled,
  onChange,
  value,
}: {
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const lines = useMemo(() => Array.from({ length: Math.max(value.split('\n').length, 1) }, (_, index) => index + 1), [value]);

  return (
    <div className="relative overflow-hidden rounded-md bg-slate-950">
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-11 overflow-hidden border-r border-slate-800 bg-slate-900/90 py-3 text-right font-mono text-[13px] leading-6 text-slate-500">
        <div style={{ transform: `translateY(-${scrollTop}px)` }}>
          {lines.map((line) => (
            <div key={line} className="pr-2">
              {line}
            </div>
          ))}
        </div>
      </div>
      <textarea
        aria-label={ariaLabel}
        className={textareaClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        spellCheck={false}
        disabled={disabled}
      />
    </div>
  );
}

function IconAction({ disabled, icon: Icon, label, onClick }: { disabled?: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-8 w-8 shrink-0 border-slate-200 p-0 text-sky-700 hover:border-sky-100 hover:bg-sky-50 hover:text-sky-800"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4 shrink-0" style={{ width: 16, height: 16, minWidth: 16 }} strokeWidth={2.2} aria-hidden="true" />
    </Button>
  );
}

function PanelHeader({
  actions,
  align = 'split',
  badge,
  icon,
  title,
}: {
  actions?: ReactNode;
  align?: 'split' | 'between';
  badge?: string;
  icon?: ReactNode;
  title: string;
}) {
  const betweenAligned = align === 'between';

  return (
    <div
      className={[
        'grid min-h-[74px] gap-2 sm:min-h-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center',
        betweenAligned ? 'sm:grid-cols-[minmax(0,1fr)_auto]' : '',
      ].join(' ')}
    >
      <div className={['flex min-w-0 items-center justify-between gap-2', betweenAligned ? 'sm:justify-start' : 'sm:justify-start'].join(' ')}>
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900">
          {icon ? <span className="text-sky-600">{icon}</span> : null}
          <span className="truncate">{title}</span>
        </div>
        {badge ? (
          <span className="max-w-[180px] shrink-0 truncate rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-medium text-slate-600">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
    </div>
  );
}
