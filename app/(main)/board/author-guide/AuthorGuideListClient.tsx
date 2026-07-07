'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, FilePlus2, X } from 'lucide-react';

import { getAuthorGuides, type AuthorGuideListResponse } from '@/app/lib/api/authorGuide';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Skeleton } from '@/app/components/ui/skeleton';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import type { AuthorGuide } from '@/app/lib/types/authorGuide';

function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3 max-w-full" />
              <Skeleton className="h-4 w-1/2 max-w-full" />
            </div>
            <Skeleton className="h-4 w-28 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PreviewPanel({ item }: { item: AuthorGuide | null }) {
  return (
    <aside className="hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:block">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <BookOpen className="h-4 w-4 text-sky-600" />
          미리보기
        </div>
        {item ? (
          <Link href={`/board/author-guide/${encodeURIComponent(item.id)}`}>
            <Button type="button" variant="outline" className="h-8 gap-1.5 border-sky-100 px-2 text-xs text-sky-700 hover:border-sky-200 hover:bg-sky-50">
              <ExternalLink className="h-3.5 w-3.5" />
              열기
            </Button>
          </Link>
        ) : null}
      </div>
      {item ? (
        <div className="mt-4 space-y-3">
          <div>
            <div className="line-clamp-2 text-sm font-semibold text-slate-950">{item.title}</div>
            <div className="mt-2">
              <Badge variant={item.status === 'PUBLISHED' ? 'published' : 'draft'}>{item.status === 'PUBLISHED' ? '공개' : '임시'}</Badge>
            </div>
          </div>
          <p className="line-clamp-8 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.content || '내용이 없습니다.'}</p>
          <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <div>생성: {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</div>
            <div>수정: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</div>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-500">목록에 마우스를 올리면 내용을 미리 확인할 수 있습니다.</div>
      )}
    </aside>
  );
}

function toPosInt(v: string | null, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

function getCompactPages(current: number, total: number): Array<number | '...'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | '...'> = [1];
  if (current > 3) out.push('...');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p += 1) out.push(p);
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
  const { canWrite } = useCurrentUser();

  const page = toPosInt(sp.get('page'), 1);
  const pageSize = toPosInt(sp.get('pageSize'), 10);
  const qParam = sp.get('q') ?? '';
  const statusParam = sp.get('status');
  const status = statusParam === 'PUBLISHED' || statusParam === 'DRAFT' ? statusParam : 'ALL';
  const [qInput, setQInput] = useState(qParam);
  const [preview, setPreview] = useState<AuthorGuide | null>(null);
  const qDebounced = useDebouncedValue(qInput, 300);
  const qText = qDebounced.trim();

  useEffect(() => setQInput(qParam), [qParam]);

  const q = useQuery<AuthorGuideListResponse>({
    queryKey: ['authorGuide', 'list', page, pageSize, qText, status],
    queryFn: () => getAuthorGuides({ page, pageSize, q: qText, status }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const data = q.data;
  const items: AuthorGuide[] = data?.items ?? [];
  const previewItem = preview ?? items[0] ?? null;
  const totalPages = data?.totalPages ?? 1;
  const pages = useMemo(() => getCompactPages(page, totalPages), [page, totalPages]);

  function pushQuery(next: { page?: number; pageSize?: number; q?: string; status?: 'ALL' | 'PUBLISHED' | 'DRAFT' }) {
    const qs = new URLSearchParams(sp.toString());
    if (next.page != null) qs.set('page', String(next.page));
    if (next.pageSize != null) qs.set('pageSize', String(next.pageSize));
    if (next.q != null) {
      const trimmed = next.q.trim();
      if (trimmed) qs.set('q', trimmed);
      else qs.delete('q');
    }
    if (next.status != null) {
      if (next.status === 'ALL') qs.delete('status');
      else qs.set('status', next.status);
    }
    router.push(`?${qs.toString()}`);
  }

  useEffect(() => {
    pushQuery({ page: 1, q: qInput });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold sm:text-2xl">
          <BookOpen className="h-5 w-5 text-sky-600" />
          저작가이드
        </h1>
        {canWrite ? (
          <Link href="/board/author-guide/new">
            <Button variant="outline" className="h-9 gap-2 border-sky-100 px-3 text-sky-700 hover:border-sky-200 hover:bg-sky-50" aria-label="새 저작가이드" title="새 저작가이드">
              <FilePlus2 className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">새 가이드</span>
            </Button>
          </Link>
        ) : (
          <Button variant="outline" className="h-9 gap-2 border-sky-100 px-3 text-sky-700" disabled aria-label="새 저작가이드" title="새 저작가이드">
            <FilePlus2 className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">새 가이드</span>
          </Button>
        )}
      </div>

      {!canWrite ? <ReadOnlyNotice /> : null}

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_36px] items-center gap-2">
        <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="제목/내용 검색" className="border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0" />
        <Button className="h-9 w-9 border-slate-200 bg-white p-0 text-slate-700 hover:bg-slate-50" variant="outline" disabled={!qInput} onClick={() => setQInput('')} aria-label="검색 초기화" title="검색 초기화">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {(['ALL', 'PUBLISHED', 'DRAFT'] as const).map((value) => (
          <Button key={value} variant={status === value ? 'ghost' : 'outline'} className="shrink-0 px-3" onClick={() => pushQuery({ page: 1, status: value })}>
            {value === 'ALL' ? '전체' : value === 'PUBLISHED' ? '공개' : '임시'}
          </Button>
        ))}
      </div>

      <div className="h-4">{q.isFetching ? <Skeleton className="h-4 w-24" /> : null}</div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {q.isPending ? (
            <ListSkeleton rows={8} />
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">저작가이드가 없습니다.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((guide) => (
                <Link key={guide.id} href={`/board/author-guide/${encodeURIComponent(guide.id)}`} onMouseEnter={() => setPreview(guide)} onFocus={() => setPreview(guide)} className="block p-3 transition-colors hover:bg-slate-50 sm:p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <div className="line-clamp-2 font-medium leading-5 text-slate-900 sm:truncate">{guide.title}</div>
                      <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-500">
                        <Badge variant={guide.status === 'PUBLISHED' ? 'published' : 'draft'}>{guide.status === 'PUBLISHED' ? '공개' : '임시'}</Badge>
                        <span className="line-clamp-1 min-w-0">{(guide.content ?? '').slice(0, 40)}{(guide.content ?? '').length > 40 ? '...' : ''}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-slate-400 sm:text-right">{guide.updatedAt ? new Date(guide.updatedAt).toLocaleString() : '-'}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <PreviewPanel item={previewItem} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-500">총 {data?.total ?? 0}개 · {data?.page ?? page}/{totalPages} 페이지</div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          {[10, 20, 30].map((n) => (
            <Button key={n} variant={n === pageSize ? 'ghost' : 'outline'} className="px-2" onClick={() => pushQuery({ page: 1, pageSize: n })}>{n}개</Button>
          ))}
        </div>
      </div>

      <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap sm:justify-center">
        <Button variant="outline" className="h-9 w-9 p-0" disabled={page <= 1} onClick={() => pushQuery({ page: page - 1 })} aria-label="이전 페이지" title="이전 페이지">
          <ArrowLeft className="h-4 w-4 shrink-0" />
        </Button>
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
          {pages.map((p, idx) => p === '...' ? <span key={`e-${idx}`} className="px-2 text-slate-400">...</span> : (
            <Button key={p} variant={p === page ? 'ghost' : 'outline'} aria-current={p === page ? 'page' : undefined} onClick={() => pushQuery({ page: p })}>{p}</Button>
          ))}
        </div>
        <Button variant="outline" className="h-9 w-9 p-0" disabled={page >= totalPages} onClick={() => pushQuery({ page: page + 1 })} aria-label="다음 페이지" title="다음 페이지">
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Button>
      </div>
    </div>
  );
}
