'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, FilePlus2, PanelRightClose, PanelRightOpen, Search } from 'lucide-react';

import { boardToolbarActionsClass, boardToolbarClass, boardToolbarIconButtonClass, boardToolbarSearchClass } from '@/app/components/ui/board-toolbar';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { LastEditorBadge } from '@/app/components/ui/last-editor-badge';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import { Skeleton } from '@/app/components/ui/skeleton';
import { getAuthorGuides, type AuthorGuideListResponse } from '@/app/lib/api/authorGuide';
import { formatKstDate, formatKstDateTime } from '@/app/lib/format/kst';
import type { AuthorGuide } from '@/app/lib/types/authorGuide';

function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="p-4">
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

export default function AuthorGuideListClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { canWrite } = useCurrentUser();

  const page = toPosInt(searchParams.get('page'), 1);
  const pageSize = toPosInt(searchParams.get('pageSize'), 10);
  const queryParam = searchParams.get('q') ?? '';
  const [queryInput, setQueryInput] = useState(queryParam);
  const [preview, setPreview] = useState<AuthorGuide | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);

  useEffect(() => {
    setQueryInput(queryParam);
  }, [queryParam]);

  const query = useQuery<AuthorGuideListResponse>({
    queryKey: ['authorGuide', 'list', page, pageSize, queryParam],
    queryFn: () => getAuthorGuides({ page, pageSize, q: queryParam }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const data = query.data;
  const items = data?.items ?? [];
  const previewItem = preview ?? items[0] ?? null;
  const totalPages = data?.totalPages ?? 1;
  const pages = useMemo(() => getCompactPages(page, totalPages), [page, totalPages]);

  function pushQuery(next: { page?: number; pageSize?: number; q?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.page != null) params.set('page', String(next.page));
    if (next.pageSize != null) params.set('pageSize', String(next.pageSize));
    if (next.q != null) {
      const trimmed = next.q.trim();
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
    }
    params.delete('status');
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="board-list-page">
      <div className="my-4 flex items-center gap-3">
        <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold sm:text-2xl">
          <BookOpen className="h-5 w-5 text-sky-600" />
          저작 가이드
        </h1>
      </div>

      {!canWrite ? <ReadOnlyNotice /> : null}

      <div className={boardToolbarClass}>
        <div className={boardToolbarSearchClass}>
          <Input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') pushQuery({ page: 1, q: queryInput });
            }}
            placeholder="제목/내용 검색"
            className="h-10 border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0"
          />
          <Button variant="outline" className={boardToolbarIconButtonClass} onClick={() => pushQuery({ page: 1, q: queryInput })} aria-label="검색" title="검색">
            <Search className="h-4 w-4 shrink-0" />
          </Button>
        </div>

        <div className={boardToolbarActionsClass}>
          {canWrite ? (
            <Link
              href="/board/author-guide/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-sky-100 bg-white px-3 text-sm font-medium text-sky-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50"
              aria-label="새 저작 가이드"
              title="새 저작 가이드"
            >
              <FilePlus2 className="h-4 w-4 shrink-0" />
              <span>새 글</span>
            </Link>
          ) : (
            <Button variant="outline" className="h-10 gap-2 border-sky-100 px-3 text-sky-700" disabled aria-label="새 저작 가이드" title="새 저작 가이드">
              <FilePlus2 className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">새 글</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className={boardToolbarIconButtonClass}
            onClick={() => setPreviewOpen((value) => !value)}
            aria-label={previewOpen ? '미리보기 닫기' : '미리보기 열기'}
            title={previewOpen ? '미리보기 닫기' : '미리보기 열기'}
          >
            {previewOpen ? <PanelRightClose className="h-4 w-4 shrink-0" /> : <PanelRightOpen className="h-4 w-4 shrink-0" />}
          </Button>
        </div>
      </div>

      <div
        className={[
          'grid min-w-0',
          previewOpen ? 'gap-4' : 'gap-0',
          previewOpen ? 'lg:grid-cols-[minmax(360px,0.75fr)_minmax(0,1.25fr)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0fr)]',
        ].join(' ')}
      >
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {query.isPending ? (
            <ListSkeleton rows={8} />
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">저작 가이드가 없습니다.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((guide) => (
                <Link
                  key={guide.id}
                  href={`/board/author-guide/${encodeURIComponent(guide.id)}`}
                  onMouseEnter={() => setPreview(guide)}
                  onFocus={() => setPreview(guide)}
                  className="block p-3 transition-colors hover:bg-slate-50 sm:p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 min-w-0 font-medium leading-5 text-slate-900 sm:truncate">{guide.title}</div>
                      <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-500">
                        <span className="line-clamp-1 min-w-0 flex-1">
                          {guide.content?.slice(0, 40) || ''}
                          {guide.content && guide.content.length > 40 ? '...' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                      <LastEditorBadge name={guide.lastEditorName} />
                      <time dateTime={guide.updatedAt ?? undefined} className="whitespace-nowrap text-xs text-slate-400">
                        {formatKstDate(guide.updatedAt)}
                      </time>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <PreviewPanel item={previewItem} open={previewOpen} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-500">
          총 {data?.total ?? 0}건 · {data?.page ?? page}/{totalPages} 페이지
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

function PreviewPanel({ item, open }: { item: AuthorGuide | null; open: boolean }) {
  return (
    <aside
      className={[
        'hidden min-w-0 overflow-hidden rounded-lg border bg-white lg:flex lg:flex-col',
        open ? 'pointer-events-auto min-h-[680px] border-slate-200 p-4 shadow-sm' : 'pointer-events-none min-h-0 border-transparent p-0 shadow-none',
      ].join(' ')}
      aria-hidden={!open}
    >
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
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <span className="line-clamp-2 min-w-0 text-sm font-semibold text-slate-950">{item.title}</span>
            <LastEditorBadge name={item.lastEditorName} />
          </div>
          <div className="min-h-0 flex-1 rounded-md border border-slate-100 bg-white px-3 py-3">
          <p className="line-clamp-[26] whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {item.content || '내용이 없습니다.'}
          </p>
          </div>
          <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <div>최근 반영일: {formatKstDateTime(item.updatedAt)}</div>
            <div>작성자: {item.lastEditorName || '-'}</div>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-500">목록에서 항목을 선택하면 내용을 미리 확인할 수 있습니다.</div>
      )}
    </aside>
  );
}
