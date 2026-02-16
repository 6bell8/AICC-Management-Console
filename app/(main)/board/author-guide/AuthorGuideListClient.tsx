'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getAuthorGuides } from '@/app/lib/api/authorGuide';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';

import type { AuthorGuide } from '@/app/lib/types/authorGuide';
import type { AuthorGuideListResponse } from '@/app/lib/api/authorGuide';

function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y">
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

function useDebouncedValue<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function AuthorGuideListClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const page = toPosInt(sp.get('page'), 1);
  const pageSize = toPosInt(sp.get('pageSize'), 10);

  // ✅ 검색어(q)
  const qParam = sp.get('q') ?? '';
  const [qInput, setQInput] = useState(qParam);
  useEffect(() => setQInput(qParam), [qParam]); // 뒤로가기/새로고침 동기화
  const qDebounced = useDebouncedValue(qInput, 300);
  const qText = qDebounced.trim();

  const q = useQuery<AuthorGuideListResponse>({
    queryKey: ['authorGuide', 'list', page, pageSize, qText],
    queryFn: () => getAuthorGuides({ page, pageSize, q: qText }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const data = q.data;
  const items: AuthorGuide[] = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const pages = useMemo(() => getCompactPages(page, totalPages), [page, totalPages]);

  function pushQuery(next: { page?: number; pageSize?: number; q?: string }) {
    const qs = new URLSearchParams(sp.toString());

    if (next.page != null) qs.set('page', String(next.page));
    if (next.pageSize != null) qs.set('pageSize', String(next.pageSize));

    // ✅ q set/delete
    if (next.q != null) {
      const trimmed = next.q.trim();
      if (trimmed) qs.set('q', trimmed);
      else qs.delete('q');
    }

    router.push(`?${qs.toString()}`);
  }

  // ✅ 입력이 바뀌면 URL에 반영(페이지는 1로 리셋)
  useEffect(() => {
    pushQuery({ page: 1, q: qInput });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">저작가이드</h1>
        <Link href="/board/author-guide/new">
          <Button variant="outline">새 가이드</Button>
        </Link>
      </div>

      {/* ✅ 검색 UI */}
      <div className="flex items-center gap-2">
        <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="제목/내용 검색" />
        <Button variant="secondary" disabled={!qInput} onClick={() => setQInput('')}>
          초기화
        </Button>
      </div>

      <div className="h-4 text-xs text-slate-500">{q.isFetching ? '불러오는 중...' : ''}</div>

      <div className="rounded-lg border bg-white">
        {q.isPending ? (
          <ListSkeleton rows={8} />
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">저작가이드가 없습니다.</div>
        ) : (
          <div className="divide-y">
            {items.map((n) => {
              const statusLabel = n.status === 'PUBLISHED' ? '공개' : '임시';
              const statusClass =
                n.status === 'PUBLISHED'
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';

              return (
                <Link key={n.id} href={`/board/author-guide/${encodeURIComponent(n.id)}`} className="block p-4 hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{n.title}</div>

                      <div className="text-xs text-slate-500 flex items-center gap-2 min-w-0">
                        <Badge variant={n.status === 'PUBLISHED' ? 'published' : 'draft'}>{n.status === 'PUBLISHED' ? '공개' : '임시'}</Badge>

                        <span className="truncate">
                          {(n.content ?? '').slice(0, 40)}
                          {(n.content ?? '').length > 40 ? '…' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 shrink-0">{n.updatedAt ? new Date(n.updatedAt).toLocaleString() : '-'}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          총 {data?.total ?? 0}개 · {data?.page ?? page}/{totalPages} 페이지
        </div>

        <div className="flex gap-2">
          {[10, 20, 30].map((n) => (
            <Button key={n} variant={n === pageSize ? 'secondary' : 'outline'} onClick={() => pushQuery({ page: 1, pageSize: n })}>
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
              <span key={`e-${idx}`} className="px-2 text-slate-500">
                …
              </span>
            );
          const isActive = p === page;
          return (
            <Button
              key={p}
              variant={isActive ? 'secondary' : 'outline'}
              aria-current={isActive ? 'page' : undefined}
              disabled={isActive}
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
