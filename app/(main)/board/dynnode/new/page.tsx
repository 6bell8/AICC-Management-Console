'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ClipboardList, Code2, Upload, X } from 'lucide-react';

import DynNodeRunner from '@/app/components/dynnode/DynnodeRunner';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { useToast } from '@/app/components/ui/use-toast';
import { createDynNode, uploadDynNodeTemplate } from '@/app/lib/api/dynnode';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';

const fieldClass =
  'h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60';

export default function DynNodeNewPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { canWrite } = useCurrentUser();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [code, setCode] = useState("// 'api:API01'은 default response 응답값입니다.\nvar res = JSON.parse(userMap.get('api:API01'))\nvar data = res.body;\n\nconsole.log(data);\n");
  const [sampleCtx, setSampleCtx] = useState('{\n  "name": "봉춘"\n}\n');
  const [ctxKey, setCtxKey] = useState('api:API01');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateInputKey, setTemplateInputKey] = useState(0);

  const m = useMutation({
    mutationFn: async () => {
      const data = await createDynNode({ title: title.trim() || '제목 없음', summary: summary.trim() || null, code, sampleCtx, ctxKey: ctxKey.trim() || 'api:API01', tags: [], status: 'DRAFT' });
      if (templateFile) await uploadDynNodeTemplate(data.post.id, templateFile);
      return data;
    },
    onSuccess: async (data) => {
      qc.invalidateQueries({ queryKey: ['dynnode', 'list'] });
      await qc.invalidateQueries({ queryKey: ['dynnode', data.post.id] });
      toast({ title: '저장 완료', description: templateFile ? '동적노드와 소스 파일 ZIP이 등록되었습니다.' : '동적노드가 등록되었습니다.' });
      router.push(`/board/dynnode/${encodeURIComponent(data.post.id)}`);
    },
    onError: (error: Error) => toast({ title: '저장 실패', description: error.message || '동적노드 등록 중 오류가 발생했습니다.', variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold sm:text-2xl">
          <Code2 className="h-5 w-5 text-sky-600" />
          새 동적노드
        </h1>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
          {templateFile ? <span className="max-w-44 truncate text-xs text-slate-500">{templateFile.name} · {formatBytes(templateFile.size)}</span> : null}
          <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-sky-700 aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={!canWrite || m.isPending} title={templateFile ? '소스/예시 파일 교체' : '소스/예시 파일 선택'}>
            <input
              key={templateInputKey}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="sr-only"
              disabled={!canWrite || m.isPending}
              onChange={(event) => {
                setTemplateFile(event.target.files?.[0] ?? null);
              }}
            />
            <Upload className="h-4 w-4" />
          </label>
          {templateFile ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 w-9 p-0"
              disabled={!canWrite || m.isPending}
              onClick={() => {
                setTemplateFile(null);
                setTemplateInputKey((value) => value + 1);
              }}
              aria-label="선택한 소스 파일 제거"
              title="선택한 소스 파일 제거"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
          <Button variant="outline" className="h-9 w-9 p-0" onClick={() => router.push('/board/dynnode')} disabled={m.isPending} aria-label="동적노드 목록" title="동적노드 목록"><ClipboardList className="h-4 w-4 shrink-0" /></Button>
          <Button variant="outline" onClick={() => m.mutate()} disabled={!canWrite || m.isPending}>{m.isPending ? '저장 중...' : '저장'}</Button>
        </div>
      </div>

      {!canWrite ? <ReadOnlyNotice /> : null}

      <div className="relative">
        {m.isPending ? (
          <div className="absolute inset-0 z-10 rounded-lg border border-slate-200 bg-white/70 p-4 backdrop-blur-[1px]">
            <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-6 w-52" /><Skeleton className="h-[220px] w-full" /><Skeleton className="h-6 w-44" /><Skeleton className="h-[220px] w-full" /></div>
          </div>
        ) : null}

        <div className={`grid gap-3 ${m.isPending ? 'pointer-events-none opacity-60' : ''}`}>
          <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" disabled={!canWrite || m.isPending} />
          <input className={fieldClass} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="요약(선택)" disabled={!canWrite || m.isPending} />
          <DynNodeRunner code={code} onChangeCode={setCode} ctxKey={ctxKey} onChangeCtxKey={setCtxKey} ctxText={sampleCtx} onChangeCtxText={setSampleCtx} disabled={!canWrite || m.isPending} />
        </div>
      </div>
    </div>
  );
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let next = value;
  let unitIndex = 0;
  while (next >= 1024 && unitIndex < units.length - 1) {
    next /= 1024;
    unitIndex += 1;
  }
  return `${next >= 10 || unitIndex === 0 ? Math.round(next) : next.toFixed(1)}${units[unitIndex]}`;
}
