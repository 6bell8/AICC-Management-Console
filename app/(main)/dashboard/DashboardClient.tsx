'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import DashboardCharts from './DashboardCharts';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { getCampaigns } from '../../lib/api/campaigns';

import { getStatusPalette, normalizeStatusKey } from '../../components/ui/status-palette';

type Campaign = {
  id: string;
  name: string;
  status: string; // ✅ 실제 응답이 섞여도 palette에서 normalize 처리
  updatedAt: string; // ISO 예상
};

type ErpSummary = {
  pendingApprovals: number;
  unreadNotifications: number;
  pendingSettlements: number;
  pendingSettlementAmount: number;
  yearlyLeaveRequests: number;
  recentAuditLogs: number;
};

// ✅ Dashboard/캠페인 공통: StatusKey -> Badge variant
function statusKeyToBadgeVariant(key: ReturnType<typeof normalizeStatusKey>): 'running' | 'paused' | 'draft' | 'archived' | 'info' {
  switch (key) {
    case 'RUNNING':
      return 'running';
    case 'PAUSED':
      return 'paused';
    case 'DRAFT':
      return 'draft';
    case 'ARCHIVED':
      return 'archived';
    default:
      return 'info'; // 모르는 상태면 info(중립)로
  }
}

// ✅ null/undefined 뿐 아니라 ""(빈 문자열)도 fallback 처리
function safeLabel(x: unknown, fallback: string) {
  const s = typeof x === 'string' ? x.trim() : '';
  return s ? s : fallback;
}

function RecentTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index} className="border-b border-slate-100 last:border-b-0">
          <td className="py-2 pr-3"><Skeleton className="h-4 w-40" /></td>
          <td className="py-2 pr-3"><Skeleton className="h-6 w-16 rounded-full" /></td>
          <td className="py-2 pr-3"><Skeleton className="h-4 w-28" /></td>
          <td className="py-2 pr-3"><Skeleton className="h-4 w-32" /></td>
        </tr>
      ))}
    </>
  );
}

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysDiff(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function getErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return '대시보드 데이터를 불러오지 못했습니다.';
}

export default function DashboardClient() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Campaign[]>([]);
  const [erpSummary, setErpSummary] = useState<ErpSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [res, erpRes] = await Promise.all([
          getCampaigns(),
          fetch('/api/dashboard/erp-summary', { cache: 'no-store' }).then((response) => (response.ok ? response.json() : null)),
        ]);
        const list = ((res as any)?.items ?? res ?? []) as Campaign[];

        if (mounted) {
          setItems(list);
          setErpSummary(erpRes);
        }
      } catch (e: unknown) {
        if (mounted) setError(getErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const kpi = useMemo(() => {
    const total = items.length;

    // ✅ 상태 normalize로 안전하게 카운트
    const draft = items.filter((c) => normalizeStatusKey(c.status) === 'DRAFT').length;
    const running = items.filter((c) => normalizeStatusKey(c.status) === 'RUNNING').length;
    const paused = items.filter((c) => normalizeStatusKey(c.status) === 'PAUSED').length;
    const archived = items.filter((c) => normalizeStatusKey(c.status) === 'ARCHIVED').length;

    const now = new Date();
    const updated7d = items.filter((c) => daysDiff(new Date(c.updatedAt), now) <= 7).length;

    return { total, draft, running, paused, archived, updated7d };
  }, [items]);

  const trend7d = useMemo(() => {
    const now = new Date();
    const keys = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      return toDateKey(d);
    });

    const bucket: Record<string, number> = {};
    keys.forEach((k) => (bucket[k] = 0));

    items.forEach((c) => {
      const key = toDateKey(new Date(c.updatedAt));
      if (key in bucket) bucket[key] += 1;
    });

    return keys.map((k) => ({ label: k.slice(5), value: bucket[k] }));
  }, [items]);

  const statusDist = useMemo(() => {
    // ✅ label이 ""로 들어오는 케이스까지 방어
    return [
      { label: safeLabel(getStatusPalette('DRAFT').label, '초안'), value: kpi.draft },
      { label: safeLabel(getStatusPalette('RUNNING').label, '운영중'), value: kpi.running },
      { label: safeLabel(getStatusPalette('PAUSED').label, '일시중지'), value: kpi.paused },
      { label: safeLabel(getStatusPalette('ARCHIVED').label, '보관'), value: kpi.archived },
    ];
  }, [kpi]);

  const recent = useMemo(() => {
    return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 10);
  }, [items]);

  return (
    <div className="space-y-6 mt-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">대시보드</h1>
          <p className="mt-1 text-sm text-slate-600">요약 지표와 최근 변경 사항을 빠르게 확인합니다.</p>
        </div>

        <div className="flex gap-2">
          <Link href="/campaigns" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
            캠페인으로 이동
          </Link>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:opacity-90"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
        </div>
      </div>

      {/* 에러 */}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : null}

      <section className="grid gap-4 lg:grid-cols-[1.15fr_1.85fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-500">오늘의 운영 우선순위</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{erpSummary?.pendingApprovals ?? '—'}건</div>
            </div>
            <Link href="/approvals" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100">
              결재함
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            <OperationRow label="정산 대기" value={`${erpSummary?.pendingSettlements ?? '—'}건`} href="/hr/trip-expenses" tone="emerald" />
            <OperationRow label="정산 대기 금액" value={erpSummary ? `${erpSummary.pendingSettlementAmount.toLocaleString()}원` : '—'} href="/hr/trip-expenses" tone="sky" />
            <OperationRow label="미확인 알림" value={`${erpSummary?.unreadNotifications ?? '—'}건`} href="/notifications" tone="slate" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-500">운영 상태 보드</div>
              <div className="mt-1 text-sm text-slate-600">캠페인과 ERP 흐름을 한 화면에서 봅니다.</div>
            </div>
            <Link href="/hr/leave-stats" className="text-sm font-medium text-slate-600 hover:text-slate-950">근태 통계</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <StatusRail
              title="캠페인"
              items={[
                ['전체', loading ? '—' : kpi.total],
                ['진행중', loading ? '—' : kpi.running],
                ['일시정지', loading ? '—' : kpi.paused],
                ['최근 7일', loading ? '—' : kpi.updated7d],
              ]}
            />
            <StatusRail
              title="ERP"
              items={[
                ['올해 근태 신청', erpSummary?.yearlyLeaveRequests ?? '—'],
                ['대기 결재', erpSummary?.pendingApprovals ?? '—'],
                ['정산 대기', erpSummary?.pendingSettlements ?? '—'],
                ['최근 감사 로그', erpSummary?.recentAuditLogs ?? '—'],
              ]}
            />
          </div>
        </div>
      </section>

      {/* 차트 */}
      <DashboardCharts trend={trend7d} statusDist={statusDist} />

      {/* 최근 변경 */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">최근 변경 캠페인</h2>
          <Link href="/campaigns" className="text-sm text-slate-600 hover:underline">
            전체 보기
          </Link>
        </div>

        <div className="mt-3 grid gap-2 sm:hidden">
          {loading ? (
            Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="mt-3 h-5 w-16 rounded-full" />
                <Skeleton className="mt-3 h-3 w-28" />
              </div>
            ))
          ) : null}
          {!loading && recent.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-8 text-center text-sm text-slate-500">
              캠페인이 없습니다.
            </div>
          ) : null}
          {!loading && recent.map((r) => {
            const p = getStatusPalette(r.status);
            const variant = statusKeyToBadgeVariant(p.key);
            const label = safeLabel(p.label, r.status);

            return (
              <Link
                key={r.id}
                href={`/campaigns/${encodeURIComponent(r.id)}`}
                className="block rounded-lg border border-slate-100 bg-white p-3 shadow-sm transition hover:border-sky-100 hover:bg-sky-50/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-sm font-semibold text-slate-950">{r.name}</div>
                    <div className="mt-1 truncate font-mono text-[11px] text-slate-400">{r.id}</div>
                  </div>
                  <Badge variant={variant}>{label}</Badge>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  업데이트 {new Date(r.updatedAt).toLocaleString()}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-3 hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b">
                <th className="py-2 pr-3">이름</th>
                <th className="py-2 pr-3">상태</th>
                <th className="py-2 pr-3">업데이트</th>
                <th className="py-2 pr-3">ID</th>
              </tr>
            </thead>

            <tbody>
              {loading ? <RecentTableSkeleton /> : null}
              {!loading && recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-sm text-slate-500">
                    캠페인이 없습니다.
                  </td>
                </tr>
              ) : null}

              {!loading && recent.map((r) => {
                const p = getStatusPalette(r.status);
                const variant = statusKeyToBadgeVariant(p.key);

                // ✅ 여기서도 label 빈 문자열 방어 + fallback은 원본 status
                const label = safeLabel(p.label, r.status);

                return (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">
                      <Link href={`/campaigns/${encodeURIComponent(r.id)}`} className="font-medium text-slate-900 hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={variant}>{label}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{new Date(r.updatedAt).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-slate-500">{r.id}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function OperationRow({ label, value, href, tone }: { label: string; value: string; href: string; tone: 'emerald' | 'sky' | 'slate' }) {
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    sky: 'bg-sky-50 text-sky-800 border-sky-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  }[tone];
  return (
    <Link href={href} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition hover:brightness-[0.98] ${toneClass}`}>
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </Link>
  );
}

function StatusRail({ title, items }: { title: string; items: Array<[string, number | string]> }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase text-slate-400">{title}</div>
      <div className="divide-y divide-slate-100 rounded-md border border-slate-100">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="font-semibold text-slate-950">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
