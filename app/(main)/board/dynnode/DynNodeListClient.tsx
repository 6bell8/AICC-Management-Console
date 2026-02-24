'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getDynNodes } from '@/app/lib/api/dynnode';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';

function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-900/20">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-4 w-28 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

function toPosInt(v: string | null, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

function getCompactPages(current: number, total: number): Array<number | '...'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const out: Array<number | '...'> = [];
  out.push(1);
  if (current > 3) out.push('...');

  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) out.push(p);

  if (current < total - 2) out.push('...');
  out.push(total);
  return out;
}

export default function DynNodeListClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const page = toPosInt(sp.get('page'), 1);
  const pageSize = toPosInt(sp.get('pageSize'), 10);

  const q = useQuery({
    queryKey: ['dynnode', 'list', page, pageSize],
    queryFn: () => getDynNodes({ page, pageSize }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const data = q.data;
  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  const pages = useMemo(() => getCompactPages(page, totalPages), [page, totalPages]);

  function pushQuery(next: { page?: number; pageSize?: number }) {
    const qs = new URLSearchParams(sp.toString());
    if (next.page != null) qs.set('page', String(next.page));
    if (next.pageSize != null) qs.set('pageSize', String(next.pageSize));
    router.push(`?${qs.toString()}`);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">동적노드 게시판</h1>
        <Link href="/board/dynnode/new">
          <Button variant="outline">새 글</Button>
        </Link>
      </div>

      <div className="h-4 text-xs text-slate-900/60">{q.isFetching ? '불러오는 중...' : ''}</div>

      {/* ✅ 카드 테두리/구분선: 검정 톤 */}
      <div className="overflow-hidden rounded-lg border border-slate-900/25 bg-white">
        {q.isPending ? (
          <ListSkeleton rows={8} />
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-slate-900/60">게시글이 없습니다.</div>
        ) : (
          <div className="divide-y divide-slate-900/20">
            {items.map((p) => (
              <Link key={p.id} href={`/board/dynnode/${encodeURIComponent(p.id)}`} className="block p-4 transition-colors hover:bg-slate-900/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate text-slate-900">{p.title}</div>
                    <div className="text-xs text-slate-900/60 truncate">{p.summary ?? p.id}</div>
                  </div>
                  <div className="text-xs text-slate-900/60 shrink-0">{p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '-'}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-900/60">
          {data?.total != null ? `총 ${data.total}개 · ` : ''}
          {data?.page ?? page}/{totalPages} 페이지
        </div>

        <div className="flex gap-2">
          {[10, 20, 30].map((n) => (
            <Button key={n} variant={n === pageSize ? 'ghost' : 'outline'} onClick={() => pushQuery({ page: 1, pageSize: n })}>
              {n}개
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => pushQuery({ page: page - 1 })}>
          이전
        </Button>

        {pages.map((p, idx) => {
          if (p === '...')
            return (
              <span key={`e-${idx}`} className="px-2 text-slate-900/50">
                …
              </span>
            );

          const isActive = p === page;
          return (
            <Button
              key={p}
              variant={isActive ? 'ghost' : 'outline'}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => pushQuery({ page: p })}
            >
              {p}
            </Button>
          );
        })}

        <Button variant="outline" disabled={page >= totalPages} onClick={() => pushQuery({ page: page + 1 })}>
          다음
        </Button>
      </div>
    </div>
  );
}
