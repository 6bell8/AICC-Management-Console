'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createCampaign, getCampaigns, patchCampaign } from '../../lib/api/campaigns';
import type { Campaign, CampaignStatus, CampaignUpdateFormValues } from '../../lib/types/campaign';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { SimpleSelect } from '../../components/ui/select';
import { useToast } from '../../components/ui/use-toast';

type StatusFilter = CampaignStatus | 'ALL';
type PageItem = number | '…';

type CampaignsListResponse = {
  items: Campaign[];
  total: number;
  totalPages: number;
  page: number;
};

function statusLabel(s: StatusFilter) {
  switch (s) {
    case 'ALL':
      return '전체';
    case 'DRAFT':
      return '초안';
    case 'RUNNING':
      return '운영중';
    case 'PAUSED':
      return '일시중지';
    case 'ARCHIVED':
      return '보관';
  }
}

function statusBadgeVariant(s: CampaignStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (s) {
    case 'RUNNING':
      return 'default';
    case 'PAUSED':
      return 'secondary';
    case 'ARCHIVED':
      return 'outline';
    case 'DRAFT':
      return 'secondary';
  }
}

function statusBadgeTextClass(s: CampaignStatus) {
  switch (s) {
    case 'RUNNING':
      return 'text-emerald-700/80';
    case 'PAUSED':
      return 'text-amber-700/80';
    case 'DRAFT':
      return 'text-slate-700/80';
    case 'ARCHIVED':
      return 'text-zinc-700/80';
    default:
      return '';
  }
}

function buildQueryString(params: { q: string; status: StatusFilter; page: number }) {
  const sp = new URLSearchParams();
  if (params.q.trim()) sp.set('q', params.q.trim());
  if (params.status !== 'ALL') sp.set('status', params.status);
  if (params.page > 1) sp.set('page', String(params.page));
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

function getNextStatus(current: CampaignStatus): CampaignStatus | null {
  switch (current) {
    case 'RUNNING':
      return 'PAUSED';
    case 'PAUSED':
      return 'RUNNING';
    case 'DRAFT':
      return 'RUNNING';
    case 'ARCHIVED':
      return null;
  }
}

function actionLabel(current: CampaignStatus) {
  switch (current) {
    case 'RUNNING':
      return '일시중지';
    case 'PAUSED':
      return '재개';
    case 'DRAFT':
      return '운영 시작';
    case 'ARCHIVED':
      return '—';
  }
}

function CampaignListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y rounded-md border border-gray-200">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 p-3 border-gray-200">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function getCompactPages(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);

  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }

  pages.add(2);
  pages.add(total - 1);

  const sorted = Array.from(pages).sort((a, b) => a - b);

  const result: PageItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const prev = sorted[i - 1];
    if (i > 0 && p - prev > 1) result.push('…');
    result.push(p);
  }
  return result;
}

export default function CampaignsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { toast } = useToast();

  // URL -> 초기 state
  const initialQ = searchParams.get('q') ?? '';
  const initialStatus = (searchParams.get('status') ?? 'ALL') as StatusFilter;
  const initialPageRaw = Number(searchParams.get('page') ?? '1');
  const initialPage = Number.isFinite(initialPageRaw) && initialPageRaw > 0 ? initialPageRaw : 1;

  const [qInput, setQInput] = useState(initialQ);
  const [status, setStatus] = useState<StatusFilter>(
    (['ALL', 'DRAFT', 'RUNNING', 'PAUSED', 'ARCHIVED'] as const).includes(initialStatus as any) ? initialStatus : 'ALL',
  );
  const [page, setPage] = useState(initialPage);

  const pageSize = 10;

  // 검색/상태 변경: 디바운스 → page=1 + URL 반영
  useEffect(() => {
    const t = window.setTimeout(() => {
      const nextPage = 1;
      setPage(nextPage);
      router.replace(`${pathname}${buildQueryString({ q: qInput, status, page: nextPage })}`);
    }, 300);

    return () => window.clearTimeout(t);
  }, [qInput, status, router, pathname]);

  // 페이지 변경: URL 반영
  useEffect(() => {
    router.replace(`${pathname}${buildQueryString({ q: qInput, status, page })}`);
  }, [page, qInput, status, router, pathname]);

  const campaignsKey = ['campaigns', { q: qInput.trim(), status, page, pageSize }] as const;

  const query = useQuery<CampaignsListResponse>({
    queryKey: campaignsKey,
    queryFn: () => getCampaigns({ q: qInput, status, page, pageSize }),
    retry: 1,
  });

  const list = query.data;
  const items: Campaign[] = list?.items ?? [];
  const total = list?.total ?? 0;
  const totalPages = Math.max(1, list?.totalPages ?? 1);
  const safePage = Math.min(Math.max(1, list?.page ?? page), totalPages);

  // 서버가 page를 보정해서 내려주면 클라 state도 동기화
  useEffect(() => {
    if (list?.page && list.page !== page) setPage(list.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list?.page]);

  const rangeText = useMemo(() => {
    if (total === 0) return '0/0';
    const start = (safePage - 1) * pageSize + 1;
    const end = Math.min(safePage * pageSize, total);
    return `${start}–${end} / ${total}`;
  }, [total, safePage]);

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; payload: CampaignUpdateFormValues }) => patchCampaign(vars.id, vars.payload),

    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: campaignsKey });

      const prev = qc.getQueryData<CampaignsListResponse>(campaignsKey);

      qc.setQueryData<CampaignsListResponse>(campaignsKey, (old) => {
        if (!old) return old;

        return {
          ...old,
          items: old.items.map((c) =>
            c.id === vars.id
              ? {
                  ...c,
                  name: vars.payload.name,
                  description: vars.payload.description,
                  status: vars.payload.status,
                  startAt: vars.payload.startAt,
                  endAt: vars.payload.endAt,
                }
              : c,
          ),
        };
      });

      return { prev };
    },

    onSuccess: async (_updated, vars) => {
      toast({ title: '상태 변경 완료' });

      qc.invalidateQueries({ queryKey: ['campaign', vars.id] });
      await qc.refetchQueries({ queryKey: campaignsKey, type: 'active' });
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData<CampaignsListResponse>(campaignsKey, ctx.prev);

      toast({
        title: '상태 변경 실패',
        description: err instanceof Error ? err.message : '알 수 없는 오류',
        variant: 'destructive',
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: () => createCampaign(),
    onSuccess: (created) => {
      toast({ title: '캠페인 생성 완료' });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      router.push(`/campaigns/${encodeURIComponent(created.id)}`);
    },
    onError: (err) => {
      toast({
        title: '캠페인 생성 실패',
        description: err instanceof Error ? err.message : '알 수 없는 오류',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="p-6 space-y-4 mx-8">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">캠페인</h1>
          <p className="text-sm text-muted-foreground">캠페인 목록을 확인하고 상세로 이동합니다.</p>
        </div>

        <Button variant="outline" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          {createMutation.isPending ? '생성 중…' : '+ 새 캠페인'}
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            목록 <Badge variant="secondary">{total}개</Badge>
          </CardTitle>

          <CardDescription>
            상태: {statusLabel(status)} · 페이지: {safePage}/{totalPages} · {rangeText}
          </CardDescription>

          <div className="flex flex-col md:flex-row gap-2">
            <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="캠페인명 또는 ID 검색" />

            <SimpleSelect value={status} tone={status} onChange={(e) => setStatus(e.target.value as any)} className="md:w-48">
              <option value="ALL">전체</option>
              <option value="DRAFT">초안</option>
              <option value="RUNNING">운영중</option>
              <option value="PAUSED">일시중지</option>
              <option value="ARCHIVED">보관</option>
            </SimpleSelect>

            <Button
              className="w-16"
              variant="outline"
              size="icon"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              aria-label="새로고침"
              title="새로고침"
            >
              {query.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-blue-600/80" />}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setQInput('');
                setStatus('ALL');
                setPage(1);
                router.replace(pathname);
              }}
            >
              초기화
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {query.isLoading ? (
            <CampaignListSkeleton rows={10} />
          ) : query.isError ? (
            <div className="space-y-2">
              <div className="text-sm text-red-500">{query.error instanceof Error ? query.error.message : '목록 로딩 실패'}</div>
              <Button variant="outline" onClick={() => query.refetch()}>
                다시 시도
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">표시할 캠페인이 없습니다.</div>
          ) : (
            <>
              <div className="divide-y rounded-md border">
                {items.map((c) => {
                  const nextStatus = getNextStatus(c.status);
                  const rowPending = statusMutation.isPending && statusMutation.variables?.id === c.id;

                  return (
                    <div key={c.id} className="group flex items-center justify-between gap-3 rounded-md p-3 row-hover-gray">
                      <Link
                        href={`/campaigns/${encodeURIComponent(c.id)}`}
                        className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground truncate">ID: {c.id}</div>
                      </Link>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusBadgeVariant(c.status)} className={statusBadgeTextClass(c.status)}>
                          {statusLabel(c.status)}
                        </Badge>

                        <span className="text-xs text-muted-foreground">{new Date(c.updatedAt).toLocaleDateString()}</span>

                        <Button
                          type="button"
                          variant="outline"
                          className="border border-gray-400 hover:border-gray-900 transition-colors duration-300 ease-in-out"
                          disabled={!nextStatus || rowPending}
                          onClick={() => {
                            if (!nextStatus) return;

                            const payload: CampaignUpdateFormValues = {
                              name: c.name,
                              description: c.description ?? '',
                              status: nextStatus,
                              startAt: c.startAt ?? null,
                              endAt: c.endAt ?? null,
                            };

                            statusMutation.mutate({ id: c.id, payload });
                          }}
                        >
                          {rowPending ? '변경중…' : actionLabel(c.status)}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{rangeText}</div>

                <div className="flex items-center gap-1">
                  <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                    이전
                  </Button>

                  {getCompactPages(safePage, totalPages).map((it, idx) => {
                    if (it === '…') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground">
                          …
                        </span>
                      );
                    }

                    const p = it;
                    const isActive = p === safePage;

                    return (
                      <Button
                        key={p}
                        variant={isActive ? 'ghost' : 'hoverGhost'}
                        className="h-9 w-9 px-0"
                        onClick={() => setPage(p)}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {p}
                      </Button>
                    );
                  })}

                  <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                    다음
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
