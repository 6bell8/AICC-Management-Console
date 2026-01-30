'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton'; // ✅ 추가
import { createDynNode } from '@/app/lib/api/dynnode';

export default function DynNodeNewPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [code, setCode] = useState(
    "// 'api:API01'는 default response 응답값입니다. \nvar res = JSON.parse(userMap.get('api:API01'))\n" +
      'var data = res.body;\n' +
      '\n' +
      'console.log(data);\n',
  );
  const [sampleCtx, setSampleCtx] = useState('{\n  "name": "봉춘"\n}\n');

  const m = useMutation({
    mutationFn: () =>
      createDynNode({
        title: title.trim() || '제목 없음',
        summary: summary.trim() || null,
        code,
        sampleCtx,
        tags: [],
        status: 'DRAFT',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dynnode', 'list'] });
      router.push(`/board/dynnode`);
    },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">새 글</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/board/dynnode')} disabled={m.isPending}>
            취소
          </Button>
          <Button variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>

      {/* ✅ 폼 영역: pending일 때 오버레이 스켈레톤 */}
      <div className="relative">
        {m.isPending && (
          <div className="absolute inset-0 z-10 rounded-lg border bg-white/70 backdrop-blur-[1px] p-4">
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-6 w-52" />
              <Skeleton className="h-[220px] w-full" />
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-[220px] w-full" />
            </div>
          </div>
        )}

        <div className={`grid gap-3 ${m.isPending ? 'pointer-events-none opacity-60' : ''}`}>
          <input className="h-10 rounded-md border px-3" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" />
          <input className="h-10 rounded-md border px-3" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="요약(선택)" />

          <div className="grid gap-2">
            <div className="text-sm font-semibold">
              실행 코드 &nbsp; <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">JavaScript Runner</span>
            </div>
            <textarea
              className="min-h-[220px] w-full rounded-md border bg-slate-50 p-3 font-mono text-sm
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-semibold">
              JSON DATA &nbsp;
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"> 'api:API01'</span>
            </div>
            <textarea
              className="min-h-[220px] w-full rounded-md border bg-slate-50 p-3 font-mono text-sm
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={sampleCtx}
              onChange={(e) => setSampleCtx(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
