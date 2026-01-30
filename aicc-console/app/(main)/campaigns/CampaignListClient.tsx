'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { getCampaigns } from '../../lib/api/campaigns';
import type { Campaign, CampaignStatus } from '../../lib/types/campaign';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { SimpleSelect } from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';

type StatusFilter = CampaignStatus | 'ALL';

function statusToneClass(s: CampaignStatus) {
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

function formatKST(iso: string) {
  return new Date(iso).toLocaleString();
}

function buildQueryString(params: { q: string; status: StatusFilter; page: number }) {
  const sp = new URLSearchParams();
  if (params.q.trim()) sp.set('q', params.q.trim());
  if (params.status !== 'ALL') sp.set('status', params.status);
  if (params.page > 1) sp.set('page', String(params.page));
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

function ListSkeleton() {
  return (
    <div className="p-6 space-y-4 border">
      <div className="flex flex-col md:flex-row gap-2 md:items-end">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="w-full md:w-48 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function CampaignListClient({
  initialQ,
  initialStatus,
  initialPage,
}: {
  initialQ: string;
  initialStatus: string; // page.tsx에서 문자열로 넘어옴
  initialPage: number;
}) {
  const router = useRouter();

  // ✅ URL 상태를 UI 상태로
  const [qInput, setQInput] = useState(initialQ);
  const [status, setStatus] = useState<StatusFilter>(
    (['ALL', 'DRAFT', 'RUNNING', 'PAUSED', 'ARCHIVED'] as const).includes(initialStatus as any) ? (initialStatus as StatusFilter) : 'ALL',
  );
  const [page, setPage] = useState<number>(Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 1);

  // ✅ 검색어 입력 디바운스(300ms) 후 URL 반영
  useEffect(() => {
    const t = window.setTimeout(() => {
      // 검색/필터 바뀌면 페이지는 1로 리셋
      const nextPage = 1;
      setPage(nextPage);
      router.replace(`/campaigns${buildQueryString({ q: qInput, status, page: nextPage })}`);
    }, 300);

    return () => window.clearTimeout(t);
  }, [qInput, status, router]);

  // ✅ 페이지 변경 시 URL 반영
  useEffect(() => {
    router.replace(`/campaigns${buildQueryString({ q: qInput, status, page })}`);
  }, [page, qInput, status, router]);

  // ✅ 원본 데이터 fetch (서버가 쿼리 지원 안 해도 OK)
  const query = useQuery({
    queryKey: ['campaigns'], // 서버가 필터 지원하면 ["campaigns", { q, status, page }]로 확장
    queryFn: () => getCampaigns(),
    retry: 1,
  });

  // ===== 클라이언트 필터/검색/페이지네이션 =====
  const pageSize = 10;
  const filtered = useMemo(() => {
    const list: Campaign[] = query.data?.items ?? [];
    const q = qInput.trim().toLowerCase();

    return list
      .filter((c) => (status === 'ALL' ? true : c.status === status))
      .filter((c) => {
        if (!q) return true;
        return c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q);
      })
      .sort((a: Campaign, b: Campaign) => (a.updatedAt < b.updatedAt ? 1 : -1)); // 최신 수정순
  }, [query.data, qInput, status]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  // page가 범위를 벗어나면 보정
  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage]);

  // ===== UI =====
  if (query.isLoading) return <ListSkeleton />;

  if (query.isError) {
    const msg = query.error instanceof Error ? query.error.message : 'Unknown Error';
    return (
      <div className="p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>불러오기 실패</CardTitle>
            <CardDescription className="break-words">{msg}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="outline" onClick={() => query.refetch()}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">캠페인</h1>
        <p className="text-sm text-muted-foreground">목록에서 검색/필터 후 상세로 이동할 수 있습니다.</p>
      </div>

      <Separator />

      {/* 필터 바 */}
      <div className="flex flex-col md:flex-row gap-2 md:items-end">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">검색</label>
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="이름 / ID / 설명으로 검색" />
        </div>

        <div className="w-full md:w-48 space-y-2">
          <label className="text-sm font-medium">상태</label>
          <SimpleSelect value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="ALL">전체</option>
            <option value="DRAFT">초안</option>
            <option value="RUNNING">운영중</option>
            <option value="PAUSED">일시중지</option>
            <option value="ARCHIVED">보관</option>
          </SimpleSelect>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            setQInput('');
            setStatus('ALL');
            setPage(1);
            router.replace('/campaigns');
          }}
        >
          초기화
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            목록 <Badge variant="secondary">{total}개</Badge>
          </CardTitle>
          <CardDescription>
            상태: {statusLabel(status)} · 페이지: {safePage}/{totalPages}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-2">
          {total === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">조건에 맞는 캠페인이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {paged.map((c: Campaign) => (
                <button
                  key={c.id}
                  type="button"
                  className="
        w-full text-left rounded-md border p-4
        transition-colors duration-150 ease-out
        hover:bg-muted/50
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
      "
                  onClick={() => router.push(`/campaigns/${encodeURIComponent(c.id)}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{c.name}</div>

                        <Badge
                          variant={statusBadgeVariant(c.status)}
                          className={statusToneClass(c.status)} // ✅ 상태별 은은한 텍스트 톤
                        >
                          {statusLabel(c.status)}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground font-mono">{c.id}</div>

                      {c.description ? <div className={`text-sm line-clamp-2 ${statusToneClass(c.status)}`}>{c.description}</div> : null}
                    </div>

                    <div className="text-xs text-muted-foreground whitespace-nowrap">updated: {formatKST(c.updatedAt)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          <div className="pt-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, total)} / {total}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                이전
              </Button>
              <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                다음
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
