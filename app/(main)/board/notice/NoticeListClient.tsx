'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, FilePlus2, Megaphone, X } from 'lucide-react';

import { getNotices } from '@/app/lib/api/notice';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Skeleton } from '@/app/components/ui/skeleton';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import type { Notice } from '@/app/lib/types/notice';

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

function getStatusLabel(status?: string | null) {
  return status === 'PUBLISHED' ? '공개' : '임시';
}

export default function NoticeListClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const { canWrite } = useCurrentUser();

  const page = toPosInt(sp.get('page'), 1);
  const pageSize = toPosInt(sp.get('pageSize'), 10);
  const qParam = sp.get('q') ?? '';
  const statusParam = sp.get('status');
  const status = statusParam === 'PUBLISHED' || statusParam === 'DRAFT' ? statusParam : 'ALL';
  const pinned = sp.get('pinned') === 'true';
  const [qInput, setQInput] = useState(qParam);
  const [preview, setPreview] = useState<Notice | null>(null);

  useEffect(() => setQInput(qParam), [qParam]);

  const q = useQuery({
    queryKey: ['notice', 'list', page, pageSize, qParam, status, pinned],
    queryFn: () => getNotices({ page, pageSize, q: qParam, status, pinned }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const data = q.data;
  const items = data?.items ?? [];
  const previewItem = preview ?? items[0] ?? null;
  const totalPages = data?.totalPages ?? 1;
  const pages = useMemo(() => getCompactPages(page, totalPages), [page, totalPages]);

  function pushQuery(next: { page?: number; pageSize?: number; q?: string; status?: 'ALL' | 'PUBLISHED' | 'DRAFT'; pinned?: boolean }) {
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
    if (next.pinned != null) {
      if (next.pinned) qs.set('pinned', 'true');
      else qs.delete('pinned');
    }
    router.push(`?${qs.toString()}`);
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex min-w-0 items-center gap-2 text-2xl font-semibold">
          <Megaphone className="h-5 w-5 text-sky-600" />
          공지사항
        </h1>
        {canWrite ? (
          <Link href="/board/notice/new">
            <Button variant="outline" className="h-9 w-9 p-0 border-sky-100 text-sky-700 hover:border-sky-200 hover:bg-sky-50" aria-label="새 공지사항" title="새 공지사항">
              <FilePlus2 className="h-4 w-4 shrink-0" />
            </Button>
          </Link>
        ) : (
          <Button variant="outline" className="h-9 w-9 p-0 border-sky-100 text-sky-700" disabled aria-label="새 공지사항" title="새 공지사항">
            <FilePlus2 className="h-4 w-4 shrink-0" />
          </Button>
        )}
      </div>

      {!canWrite ? <ReadOnlyNotice /> : null}

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input value={qInput} onChange={(event) => setQInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') pushQuery({ page: 1, q: qInput }); }} placeholder="제목/내용 검색" className="border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0" />
          <Button variant="outline" className="h-9 w-9 p-0" onClick={() => pushQuery({ page: 1, q: qInput })} aria-label="검색" title="검색">
            <Megaphone className="h-4 w-4 shrink-0" />
          </Button>
          <Button variant="outline" className="h-9 w-9 p-0" disabled={!qInput && !qParam} onClick={() => { setQInput(''); pushQuery({ page: 1, q: '' }); }} aria-label="검색 초기화" title="검색 초기화">
            <X className="h-4 w-4 shrink-0" />
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
          {(['ALL', 'PUBLISHED', 'DRAFT'] as const).map((value) => (
            <Button key={value} variant={status === value ? 'ghost' : 'outline'} onClick={() => pushQuery({ page: 1, status: value })}>
              {value === 'ALL' ? '전체' : value === 'PUBLISHED' ? '공개' : '임시'}
            </Button>
          ))}
          <Button variant={pinned ? 'ghost' : 'outline'} onClick={() => pushQuery({ page: 1, pinned: !pinned })}>고정</Button>
        </div>
      </div>

      <div className="h-4">{q.isFetching ? <Skeleton className="h-4 w-24" /> : null}</div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {q.isPending ? (
            <ListSkeleton rows={8} />
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">공지사항이 없습니다.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((notice) => (
                <Link key={notice.id} href={`/board/notice/${encodeURIComponent(notice.id)}`} onMouseEnter={() => setPreview(notice)} onFocus={() => setPreview(notice)} className="block p-4 transition-colors hover:bg-slate-50">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{notice.pinned ? '[고정] ' : ''}{notice.title}</div>
                      <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
                        <Badge variant={notice.status === 'PUBLISHED' ? 'published' : 'draft'}>{getStatusLabel(notice.status)}</Badge>
                        <span className="truncate">{notice.content?.slice(0, 40) || ''}{notice.content && notice.content.length > 40 ? '...' : ''}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-slate-500 sm:text-right">{notice.updatedAt ? new Date(notice.updatedAt).toLocaleString() : '-'}</div>
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
            <Button key={n} variant={n === pageSize ? 'ghost' : 'outline'} onClick={() => pushQuery({ page: 1, pageSize: n })}>{n}개</Button>
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

function PreviewPanel({ item }: { item: Notice | null }) {
  return (
    <aside className="hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:block">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Megaphone className="h-4 w-4 text-sky-600" />
        미리보기
      </div>
      {item ? (
        <div className="mt-4 space-y-3">
          <div>
            <div className="line-clamp-2 text-sm font-semibold text-slate-950">{item.title}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={item.status === 'PUBLISHED' ? 'published' : 'draft'}>{getStatusLabel(item.status)}</Badge>
              {item.pinned ? <Badge variant="outline">고정</Badge> : null}
            </div>
          </div>
          <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.content || '내용이 없습니다.'}</p>
          {item.attachments && item.attachments.length > 0 ? (
            <div className="space-y-1 rounded-md border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-500">첨부파일</div>
              {item.attachments.map((attachment) => (
                <a key={`${attachment.name}-${attachment.url}`} href={attachment.url} target="_blank" rel="noreferrer" className="block truncate text-xs font-medium text-sky-700 hover:underline">
                  {attachment.name}
                </a>
              ))}
            </div>
          ) : null}
          <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <div>수정: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</div>
            <div>수정 횟수: {item.revisionCount ?? 0}회</div>
            <div>최근 수정자: {item.lastEditorName ?? '-'}</div>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-500">목록에 마우스를 올리면 내용을 미리 확인할 수 있습니다.</div>
      )}
    </aside>
  );
}
