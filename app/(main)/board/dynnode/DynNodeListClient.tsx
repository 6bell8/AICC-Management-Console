'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Code2, ExternalLink, FilePlus2, PanelRightClose, PanelRightOpen, Search, X } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { LastEditorBadge } from '@/app/components/ui/last-editor-badge';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import { Skeleton } from '@/app/components/ui/skeleton';
import { getDynNodes } from '@/app/lib/api/dynnode';
import type { DynNodePost } from '@/app/lib/types/dynnode';

type StatusFilter = 'ALL' | 'PUBLISHED' | 'DRAFT';

function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="p-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-2/3 max-w-full" />
            <Skeleton className="h-4 w-1/2 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function toPosInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function getCompactPages(current: number, total: number): Array<number | '...'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages: Array<number | '...'> = [1];
  if (current > 3) pages.push('...');
  for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) pages.push(page);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function statusLabel(status: DynNodePost['status']) {
  return status === 'PUBLISHED' ? '공개' : '임시';
}

export default function DynNodeListClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { canWrite } = useCurrentUser();

  const page = toPosInt(searchParams.get('page'), 1);
  const pageSize = toPosInt(searchParams.get('pageSize'), 10);
  const queryParam = searchParams.get('q') ?? '';
  const rawStatus = searchParams.get('status');
  const status: StatusFilter = rawStatus === 'PUBLISHED' || rawStatus === 'DRAFT' ? rawStatus : 'ALL';
  const [queryInput, setQueryInput] = useState(queryParam);
  const [preview, setPreview] = useState<DynNodePost | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);

  const query = useQuery({
    queryKey: ['dynnode', 'list', page, pageSize, queryParam, status],
    queryFn: () => getDynNodes({ page, pageSize, q: queryParam, status }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const data = query.data;
  const items = data?.items ?? [];
  const previewItem = preview ?? items[0] ?? null;
  const totalPages = data?.totalPages ?? 1;
  const pages = useMemo(() => getCompactPages(page, totalPages), [page, totalPages]);

  function pushQuery(next: { page?: number; pageSize?: number; q?: string; status?: StatusFilter }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.page != null) params.set('page', String(next.page));
    if (next.pageSize != null) params.set('pageSize', String(next.pageSize));
    if (next.q != null) {
      const trimmed = next.q.trim();
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
    }
    if (next.status != null) {
      if (next.status === 'ALL') params.delete('status');
      else params.set('status', next.status);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold sm:text-2xl">
          <Code2 className="h-5 w-5 text-sky-600" />
          동적노드 게시판
        </h1>
        {canWrite ? (
          <Link href="/board/dynnode/new">
            <Button variant="outline" className="h-9 gap-2 border-sky-100 px-3 text-sky-700 hover:border-sky-200 hover:bg-sky-50" aria-label="새 동적노드" title="새 동적노드">
              <FilePlus2 className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">새 글</span>
            </Button>
          </Link>
        ) : (
          <Button variant="outline" className="h-9 gap-2 border-sky-100 px-3 text-sky-700" disabled aria-label="새 동적노드" title="새 동적노드">
            <FilePlus2 className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">새 글</span>
          </Button>
        )}
      </div>

      {!canWrite ? <ReadOnlyNotice /> : null}

      <div className="space-y-2 lg:flex lg:items-center lg:justify-between lg:gap-3 lg:space-y-0">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_36px_36px] items-center gap-2 lg:flex lg:flex-1">
          <Input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') pushQuery({ page: 1, q: queryInput });
            }}
            placeholder="제목/요약/코드 검색"
            className="border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0"
          />
          <Button variant="outline" className="h-9 w-9 p-0" onClick={() => pushQuery({ page: 1, q: queryInput })} aria-label="검색" title="검색">
            <Search className="h-4 w-4 shrink-0" />
          </Button>
          <Button
            variant="outline"
            className="h-9 w-9 p-0"
            disabled={!queryInput && !queryParam}
            onClick={() => {
              setQueryInput('');
              pushQuery({ page: 1, q: '' });
            }}
            aria-label="검색 초기화"
            title="검색 초기화"
          >
            <X className="h-4 w-4 shrink-0" />
          </Button>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {(['ALL', 'PUBLISHED', 'DRAFT'] as const).map((value) => (
            <Button key={value} variant={status === value ? 'ghost' : 'outline'} className="shrink-0 px-3" onClick={() => pushQuery({ page: 1, status: value })}>
              {value === 'ALL' ? '전체' : value === 'PUBLISHED' ? '공개' : '임시'}
            </Button>
          ))}
          <Button type="button" variant="outline" className="h-9 w-9 shrink-0 p-0 transition-colors hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700" onClick={() => setPreviewOpen((value) => !value)} aria-label={previewOpen ? '미리보기 닫기' : '미리보기 열기'} title={previewOpen ? '미리보기 닫기' : '미리보기 열기'}>
            {previewOpen ? <PanelRightClose className="h-4 w-4 shrink-0" /> : <PanelRightOpen className="h-4 w-4 shrink-0" />}
          </Button>
        </div>
      </div>

      <div
        className={[
          'grid min-w-0 gap-4',
          previewOpen ? 'lg:grid-cols-[minmax(280px,0.55fr)_minmax(0,1.45fr)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0fr)]',
        ].join(' ')}
      >
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {query.isPending ? (
            <ListSkeleton rows={8} />
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">게시글이 없습니다.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((post) => (
                <Link key={post.id} href={`/board/dynnode/${encodeURIComponent(post.id)}`} onMouseEnter={() => setPreview(post)} onFocus={() => setPreview(post)} className="block p-3 transition-colors hover:bg-slate-50 sm:p-4">
                  <div className="min-w-0">
                    <div className="line-clamp-2 min-w-0 font-medium leading-5 text-slate-900 sm:truncate">{post.title}</div>
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-500">
                      <Badge variant={post.status === 'PUBLISHED' ? 'published' : 'draft'}>{statusLabel(post.status)}</Badge>
                      <span className="line-clamp-1 min-w-0 flex-1">{post.summary ?? post.id}</span>
                      <LastEditorBadge name={post.lastEditorName} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <PreviewPanel item={previewItem} loading={query.isPending} open={previewOpen} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-500">
          {data?.total != null ? `총 ${data.total}건 · ` : ''}
          {data?.page ?? page}/{totalPages} 페이지
        </div>
        <div className="flex justify-end gap-2">
          {[10, 20, 30].map((size) => (
            <Button key={size} variant={size === pageSize ? 'ghost' : 'outline'} className="h-9 min-w-14 px-3" onClick={() => pushQuery({ page: 1, pageSize: size })}>
              {size}개
            </Button>
          ))}
        </div>
      </div>

      <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap sm:justify-center">
        <Button variant="outline" className="h-9 w-9 p-0" disabled={page <= 1} onClick={() => pushQuery({ page: page - 1 })} aria-label="이전 페이지" title="이전 페이지">
          <ArrowLeft className="h-4 w-4 shrink-0" />
        </Button>
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
          {pages.map((item, index) =>
            item === '...' ? (
              <span key={`ellipsis-${index}`} className="px-2 text-slate-400">
                ...
              </span>
            ) : (
              <Button key={item} variant={item === page ? 'ghost' : 'outline'} aria-current={item === page ? 'page' : undefined} onClick={() => pushQuery({ page: item })}>
                {item}
              </Button>
            ),
          )}
        </div>
        <Button variant="outline" className="h-9 w-9 p-0" disabled={page >= totalPages} onClick={() => pushQuery({ page: page + 1 })} aria-label="다음 페이지" title="다음 페이지">
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Button>
      </div>
    </div>
  );
}

function PreviewPanel({ item, loading, open }: { item: DynNodePost | null; loading: boolean; open: boolean }) {
  return (
    <aside
      className={[
        'hidden min-w-0 overflow-hidden rounded-lg border bg-white lg:flex lg:flex-col',
        open
          ? 'pointer-events-auto min-h-[720px] border-slate-200 p-4 shadow-sm'
          : 'pointer-events-none min-h-0 border-transparent p-0 shadow-none',
      ].join(' ')}
      aria-hidden={!open}
    >
      {open ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-950">
              <Code2 className="h-4 w-4 shrink-0 text-sky-600" />
              <span className="truncate">미리보기</span>
            </div>
            {item ? (
              <Link href={`/board/dynnode/${encodeURIComponent(item.id)}`}>
                <Button type="button" variant="outline" className="h-8 gap-1.5 border-sky-100 px-2 text-xs text-sky-700 hover:border-sky-200 hover:bg-sky-50">
                  <ExternalLink className="h-3.5 w-3.5" />
                  열기
                </Button>
              </Link>
            ) : null}
          </div>

          {loading ? (
            <PreviewSkeleton />
          ) : item ? (
            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
              <div>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <span className="line-clamp-2 min-w-0 text-sm font-semibold text-slate-950">{item.title}</span>
                  <LastEditorBadge name={item.lastEditorName} />
                </div>
                <div className="mt-2">
                  <Badge variant={item.status === 'PUBLISHED' ? 'published' : 'draft'}>{statusLabel(item.status)}</Badge>
                </div>
              </div>
              <p className="line-clamp-4 text-sm leading-6 text-slate-600">{item.summary || '요약이 없습니다.'}</p>
              <pre className="min-h-0 max-w-full flex-1 overflow-auto rounded-md border border-slate-100 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                {item.code}
              </pre>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                <div>수정: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-500">목록에 마우스를 올리면 코드를 미리 확인할 수 있습니다.</div>
          )}
        </>
      ) : null}
    </aside>
  );
}

function PreviewSkeleton() {
  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
      <div className="space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="min-h-0 flex-1 rounded-md bg-slate-900/10" />
      <Skeleton className="h-16 w-full rounded-md" />
    </div>
  );
}
