'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Code2, FilePlus2 } from 'lucide-react';

import { getDynNodes } from '@/app/lib/api/dynnode';
import type { DynNodePost } from '@/app/lib/types/dynnode';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';

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
  const { canWrite } = useCurrentUser();
  const [preview, setPreview] = useState<DynNodePost | null>(null);

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
  const previewItem = preview ?? items[0] ?? null;
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
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Code2 className="h-5 w-5 text-sky-600" />
          동적노드 게시판
        </h1>
        {canWrite ? (
          <Link href="/board/dynnode/new">
            <Button
              variant="outline"
              className="h-9 w-9 border-sky-100 p-0 text-sky-700 hover:border-sky-200 hover:bg-sky-50"
              aria-label="새 동적노드"
              title="새 동적노드"
            >
              <FilePlus2 className="h-4 w-4 shrink-0" />
            </Button>
          </Link>
        ) : (
          <Button variant="outline" className="h-9 w-9 border-sky-100 p-0 text-sky-700" disabled aria-label="새 동적노드" title="새 동적노드">
            <FilePlus2 className="h-4 w-4 shrink-0" />
          </Button>
        )}
      </div>

      {!canWrite ? <ReadOnlyNotice /> : null}

      <div className="h-4 text-xs text-slate-900/60">{q.isFetching ? '불러오는 중...' : ''}</div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(380px,1.15fr)]">
        <div className="overflow-hidden rounded-lg border border-slate-900/25 bg-white">
          {q.isPending ? (
            <ListSkeleton rows={8} />
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-slate-900/60">게시글이 없습니다.</div>
          ) : (
            <div className="divide-y divide-slate-900/20">
              {items.map((p) => (
                <Link
                  key={p.id}
                  href={`/board/dynnode/${encodeURIComponent(p.id)}`}
                  onMouseEnter={() => setPreview(p)}
                  onFocus={() => setPreview(p)}
                  className="block p-4 transition-colors hover:bg-slate-900/5 focus-visible:bg-slate-900/5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{p.title}</div>
                      <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-900/60">
                        <Badge variant={p.status === 'PUBLISHED' ? 'published' : 'draft'}>{p.status === 'PUBLISHED' ? '공개' : '임시'}</Badge>
                        <span className="truncate">{p.summary ?? p.id}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-slate-900/60">{p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '-'}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <PreviewPanel item={previewItem} />
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

function PreviewPanel({ item }: { item: DynNodePost | null }) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Code2 className="h-4 w-4 text-sky-600" />
        미리보기
      </div>

      {item ? (
        <div className="mt-4 space-y-3">
          <div>
            <div className="line-clamp-2 text-sm font-semibold text-slate-950">{item.title}</div>
            <div className="mt-2">
              <Badge variant={item.status === 'PUBLISHED' ? 'published' : 'draft'}>{item.status === 'PUBLISHED' ? '공개' : '임시'}</Badge>
            </div>
          </div>

          <p className="line-clamp-3 text-sm leading-6 text-slate-600">{item.summary || '요약이 없습니다.'}</p>

          <pre className="max-h-72 overflow-auto rounded-md border border-slate-100 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
            {item.code}
          </pre>

          <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <div>수정: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</div>
            <div>태그: {item.tags?.length > 0 ? item.tags.join(', ') : '-'}</div>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-500">목록에 마우스를 올리면 코드를 미리 확인할 수 있습니다.</div>
      )}
    </aside>
  );
}
