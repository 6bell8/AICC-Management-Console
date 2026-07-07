'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Code2, ExternalLink, FilePlus2, PanelRightClose, PanelRightOpen, Search, X } from 'lucide-react';

import { getDynNodes } from '@/app/lib/api/dynnode';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Skeleton } from '@/app/components/ui/skeleton';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import type { DynNodePost } from '@/app/lib/types/dynnode';

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

export default function DynNodeListClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const { canWrite } = useCurrentUser();

  const page = toPosInt(sp.get('page'), 1);
  const pageSize = toPosInt(sp.get('pageSize'), 10);
  const qParam = sp.get('q') ?? '';
  const statusParam = sp.get('status');
  const status = statusParam === 'PUBLISHED' || statusParam === 'DRAFT' ? statusParam : 'ALL';
  const [qInput, setQInput] = useState(qParam);
  const [preview, setPreview] = useState<DynNodePost | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);

  const q = useQuery({
    queryKey: ['dynnode', 'list', page, pageSize, qParam, status],
    queryFn: () => getDynNodes({ page, pageSize, q: qParam, status }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const data = q.data;
  const items = data?.items ?? [];
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold sm:text-2xl">
          <Code2 className="h-5 w-5 text-sky-600" />
          동적노드 게시판
        </h1>
        <div className="flex items-center gap-2 sm:justify-end">
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
      </div>

      {!canWrite ? <ReadOnlyNotice /> : null}
      <div className="space-y-2 lg:flex lg:items-center lg:justify-between lg:gap-3 lg:space-y-0">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_36px_36px] items-center gap-2 lg:flex lg:flex-1">
          <Input value={qInput} onChange={(event) => setQInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') pushQuery({ page: 1, q: qInput }); }} placeholder="제목/요약/코드 검색" className="border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0" />
          <Button variant="outline" className="h-9 w-9 p-0" onClick={() => pushQuery({ page: 1, q: qInput })} aria-label="검색" title="검색"><Search className="h-4 w-4 shrink-0" /></Button>
          <Button variant="outline" className="h-9 w-9 p-0" disabled={!qInput && !qParam} onClick={() => { setQInput(''); pushQuery({ page: 1, q: '' }); }} aria-label="검색 초기화" title="검색 초기화"><X className="h-4 w-4 shrink-0" /></Button>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {(['ALL', 'PUBLISHED', 'DRAFT'] as const).map((value) => (
            <Button key={value} variant={status === value ? 'ghost' : 'outline'} className="shrink-0 px-3" onClick={() => pushQuery({ page: 1, status: value })}>
              {value === 'ALL' ? '전체' : value === 'PUBLISHED' ? '공개' : '임시'}
            </Button>
          ))}
        </div>
      </div>
      <div
        className={[
          'grid min-w-0 gap-4 transition-[grid-template-columns] duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
          previewOpen ? 'lg:grid-cols-[minmax(280px,0.62fr)_minmax(0,1.38fr)]' : 'lg:grid-cols-[minmax(0,1fr)_44px]',
        ].join(' ')}
      >
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {q.isPending ? (
            <ListSkeleton rows={8} />
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">게시글이 없습니다.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((post) => (
                <Link key={post.id} href={`/board/dynnode/${encodeURIComponent(post.id)}`} onMouseEnter={() => setPreview(post)} onFocus={() => setPreview(post)} className="block p-3 transition-colors hover:bg-slate-50 sm:p-4">
                  <div className="min-w-0">
                    <div className="line-clamp-2 font-medium leading-5 text-slate-900 sm:truncate">{post.title}</div>
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-500">
                      <Badge variant={post.status === 'PUBLISHED' ? 'published' : 'draft'}>{post.status === 'PUBLISHED' ? '공개' : '임시'}</Badge>
                      <span className="line-clamp-1 min-w-0">{post.summary ?? post.id}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <PreviewPanel item={previewItem} loading={q.isPending} open={previewOpen} onToggle={() => setPreviewOpen((value) => !value)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-500">{data?.total != null ? `총 ${data.total}개 · ` : ''}{data?.page ?? page}/{totalPages} 페이지</div>
        <div className="flex justify-end gap-2">
          {[10, 20, 30].map((n) => (
            <Button key={n} variant={n === pageSize ? 'ghost' : 'outline'} className="h-9 min-w-14 px-3" onClick={() => pushQuery({ page: 1, pageSize: n })}>{n}개</Button>
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

function PreviewPanel({ item, loading, onToggle, open }: { item: DynNodePost | null; loading: boolean; onToggle: () => void; open: boolean }) {
  return (
    <aside
      className={[
        'hidden min-w-0 overflow-hidden rounded-lg border transition-[padding,border-color,box-shadow,min-height,background-color,width,height] duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)] lg:block',
        open ? 'min-h-full border-slate-200 bg-white p-4 shadow-sm' : 'h-28 min-h-0 w-9 self-start justify-self-center overflow-visible border-transparent bg-transparent p-0 shadow-none',
      ].join(' ')}
    >
      <div className={['flex items-center gap-2', open ? 'justify-between' : 'justify-center'].join(' ')}>
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-950">
          {open ? (
            <>
              <Code2 className="h-4 w-4 shrink-0 text-sky-600" />
              <span className="truncate">미리보기</span>
            </>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {open && item ? (
            <Link href={`/board/dynnode/${encodeURIComponent(item.id)}`}>
              <Button type="button" variant="outline" className="h-8 gap-1.5 border-sky-100 px-2 text-xs text-sky-700 hover:border-sky-200 hover:bg-sky-50">
                <ExternalLink className="h-3.5 w-3.5" />
                열기
              </Button>
            </Link>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className={[
              'shrink-0 p-0 transition-[width,height,border-color,background-color,box-shadow] duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
              open
                ? 'h-8 w-8'
                : 'h-28 w-9 rounded-lg border-slate-200 bg-white text-slate-500 shadow-sm hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700',
            ].join(' ')}
            onClick={onToggle}
            aria-label={open ? '미리보기 닫기' : '미리보기 열기'}
            title={open ? '미리보기 닫기' : '미리보기 열기'}
          >
            {open ? <PanelRightClose className="h-4 w-4 shrink-0" /> : <PanelRightOpen className="h-4 w-4 shrink-0" />}
          </Button>
        </div>
      </div>
      {loading ? (
        <PreviewSkeleton open={open} />
      ) : item ? (
        <div className={['mt-4 space-y-3 transition-all duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)]', open ? 'max-h-[720px] translate-x-0 opacity-100' : 'pointer-events-none max-h-0 translate-x-3 opacity-0'].join(' ')}>
          <div>
            <div className="line-clamp-2 text-sm font-semibold text-slate-950">{item.title}</div>
            <div className="mt-2">
              <Badge variant={item.status === 'PUBLISHED' ? 'published' : 'draft'}>{item.status === 'PUBLISHED' ? '공개' : '임시'}</Badge>
            </div>
          </div>
          <p className="line-clamp-3 text-sm leading-6 text-slate-600">{item.summary || '요약이 없습니다.'}</p>
          <pre className="max-h-72 max-w-full overflow-auto rounded-md border border-slate-100 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
            {item.code}
          </pre>
          <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <div>수정: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</div>
            <div>태그: {item.tags.length > 0 ? item.tags.join(', ') : '-'}</div>
          </div>
        </div>
      ) : (
        <div className={['mt-4 text-sm text-slate-500 transition-all duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)]', open ? 'max-h-20 translate-x-0 opacity-100' : 'pointer-events-none max-h-0 translate-x-3 opacity-0'].join(' ')}>목록에 마우스를 올리면 코드를 미리 확인할 수 있습니다.</div>
      )}
    </aside>
  );
}

function PreviewSkeleton({ open }: { open: boolean }) {
  return (
    <div className={['mt-4 space-y-3 transition-all duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)]', open ? 'max-h-[720px] translate-x-0 opacity-100' : 'pointer-events-none max-h-0 translate-x-3 opacity-0'].join(' ')}>
      <div className="space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-44 w-full rounded-md bg-slate-900/10" />
      <Skeleton className="h-16 w-full rounded-md" />
    </div>
  );
}
