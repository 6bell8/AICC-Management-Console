'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ExternalLink, FilePlus2, Megaphone, Pin, Search, X } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { LastEditorBadge } from '@/app/components/ui/last-editor-badge';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import { Skeleton } from '@/app/components/ui/skeleton';
import { getNotices } from '@/app/lib/api/notice';
import type { Notice } from '@/app/lib/types/notice';

type NoticeStatusFilter = 'ALL' | 'PUBLISHED' | 'DRAFT';

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

function getStatusLabel(status?: string | null) {
  return status === 'PUBLISHED' ? '공개' : '임시';
}

export default function NoticeListClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { canWrite } = useCurrentUser();

  const page = toPosInt(searchParams.get('page'), 1);
  const pageSize = toPosInt(searchParams.get('pageSize'), 10);
  const queryParam = searchParams.get('q') ?? '';
  const statusParam = searchParams.get('status');
  const status: NoticeStatusFilter = statusParam === 'PUBLISHED' || statusParam === 'DRAFT' ? statusParam : 'ALL';
  const pinned = searchParams.get('pinned') === 'true';
  const [queryInput, setQueryInput] = useState(queryParam);
  const [preview, setPreview] = useState<Notice | null>(null);

  useEffect(() => {
    setQueryInput(queryParam);
  }, [queryParam]);

  const query = useQuery({
    queryKey: ['notice', 'list', page, pageSize, queryParam, status, pinned],
    queryFn: () => getNotices({ page, pageSize, q: queryParam, status, pinned }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const data = query.data;
  const items = data?.items ?? [];
  const previewItem = preview ?? items[0] ?? null;
  const totalPages = data?.totalPages ?? 1;
  const pages = useMemo(() => getCompactPages(page, totalPages), [page, totalPages]);

  function pushQuery(next: { page?: number; pageSize?: number; q?: string; status?: NoticeStatusFilter; pinned?: boolean }) {
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
    if (next.pinned != null) {
      if (next.pinned) params.set('pinned', 'true');
      else params.delete('pinned');
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold sm:text-2xl">
          <Megaphone className="h-5 w-5 text-sky-600" />
          공지사항
        </h1>
        {canWrite ? (
          <Link href="/board/notice/new">
            <Button variant="outline" className="h-9 gap-2 border-sky-100 px-3 text-sky-700 hover:border-sky-200 hover:bg-sky-50" aria-label="새 공지사항" title="새 공지사항">
              <FilePlus2 className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">새 공지</span>
            </Button>
          </Link>
        ) : (
          <Button variant="outline" className="h-9 gap-2 border-sky-100 px-3 text-sky-700" disabled aria-label="새 공지사항" title="새 공지사항">
            <FilePlus2 className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">새 공지</span>
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
            placeholder="제목/내용 검색"
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
          <Button variant={pinned ? 'ghost' : 'outline'} className="shrink-0 px-3" onClick={() => pushQuery({ page: 1, pinned: !pinned })}>
            고정
          </Button>
        </div>
      </div>

      <div className="h-4">{query.isFetching ? <Skeleton className="h-4 w-24" /> : null}</div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {query.isPending ? (
            <ListSkeleton rows={8} />
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">공지사항이 없습니다.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((notice) => (
                <Link key={notice.id} href={`/board/notice/${encodeURIComponent(notice.id)}`} onMouseEnter={() => setPreview(notice)} onFocus={() => setPreview(notice)} className="block p-3 transition-colors hover:bg-slate-50 sm:p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <div className="line-clamp-2 min-w-0 font-medium leading-5 text-slate-900 sm:truncate">
                        {notice.pinned ? <Pin className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-rose-500" aria-label="고정 공지" /> : null}
                        {notice.title}
                      </div>
                      <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-500">
                        <Badge variant={notice.status === 'PUBLISHED' ? 'published' : 'draft'}>{getStatusLabel(notice.status)}</Badge>
                        <span className="line-clamp-1 min-w-0 flex-1">
                          {notice.content?.slice(0, 40) || ''}
                          {notice.content && notice.content.length > 40 ? '...' : ''}
                        </span>
                        <LastEditorBadge name={notice.lastEditorName} />
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-slate-400 sm:text-right">{notice.updatedAt ? new Date(notice.updatedAt).toLocaleString() : '-'}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <PreviewPanel item={previewItem} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-500">
          총 {data?.total ?? 0}건 · {data?.page ?? page}/{totalPages} 페이지
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          {[10, 20, 30].map((size) => (
            <Button key={size} variant={size === pageSize ? 'ghost' : 'outline'} className="px-2" onClick={() => pushQuery({ page: 1, pageSize: size })}>
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

function PreviewPanel({ item }: { item: Notice | null }) {
  return (
    <aside className="hidden min-h-[680px] rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex lg:flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Megaphone className="h-4 w-4 text-sky-600" />
          미리보기
        </div>
        {item ? (
          <Link href={`/board/notice/${encodeURIComponent(item.id)}`}>
            <Button type="button" variant="outline" className="h-8 gap-1.5 border-sky-100 px-2 text-xs text-sky-700 hover:border-sky-200 hover:bg-sky-50">
              <ExternalLink className="h-3.5 w-3.5" />
              열기
            </Button>
          </Link>
        ) : null}
      </div>

      {item ? (
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
          <div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <span className="line-clamp-2 min-w-0 text-sm font-semibold text-slate-950">{item.title}</span>
              <LastEditorBadge name={item.lastEditorName} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={item.status === 'PUBLISHED' ? 'published' : 'draft'}>{getStatusLabel(item.status)}</Badge>
              {item.pinned ? <Pin className="h-3.5 w-3.5 text-rose-500" aria-label="고정 공지" /> : null}
            </div>
          </div>
          <div className="min-h-0 flex-1 rounded-md border border-slate-100 bg-white px-3 py-3">
            <p className="line-clamp-[26] whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.content || '내용이 없습니다.'}</p>
          </div>
          {item.attachments && item.attachments.length > 0 ? (
            <div className="space-y-1 rounded-md border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-500">첨부 링크</div>
              {item.attachments.map((attachment) => (
                <a key={`${attachment.name}-${attachment.url}`} href={attachment.url} target="_blank" rel="noreferrer" className="block truncate text-xs font-medium text-sky-700 hover:underline">
                  {attachment.name}
                </a>
              ))}
            </div>
          ) : null}
          <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <div>수정: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</div>
            <div>작성자: {item.lastEditorName ?? '-'}</div>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-500">목록에 마우스를 올리면 내용을 미리 확인할 수 있습니다.</div>
      )}
    </aside>
  );
}
