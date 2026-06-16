'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import { getStatusPalette, normalizeStatusKey } from '@/app/components/ui/status-palette';
import { getCampaigns } from '@/app/lib/api/campaigns';

type Campaign = {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
};

type ErpSummary = {
  pendingApprovals: number;
  unreadNotifications: number;
  pendingSettlements: number;
  pendingSettlementAmount: number;
  yearlyLeaveRequests: number;
  recentAuditLogs: number;
};

function statusKeyToBadgeVariant(key: ReturnType<typeof normalizeStatusKey>): 'running' | 'paused' | 'draft' | 'archived' | 'info' {
  if (key === 'RUNNING') return 'running';
  if (key === 'PAUSED') return 'paused';
  if (key === 'DRAFT') return 'draft';
  if (key === 'ARCHIVED') return 'archived';
  return 'info';
}

function daysDiff(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
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

export default function OperationsClient() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Campaign[]>([]);
  const [erpSummary, setErpSummary] = useState<ErpSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [campaignRes, erpRes] = await Promise.all([
          getCampaigns(),
          fetch('/api/dashboard/erp-summary', { cache: 'no-store' }).then((response) => (response.ok ? response.json() : null)),
        ]);
        const list = ((campaignRes as any)?.items ?? campaignRes ?? []) as Campaign[];
        if (mounted) {
          setItems(list);
          setErpSummary(erpRes);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : '운영 현황을 불러오지 못했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const kpi = useMemo(() => {
    const total = items.length;
    const running = items.filter((item) => normalizeStatusKey(item.status) === 'RUNNING').length;
    const paused = items.filter((item) => normalizeStatusKey(item.status) === 'PAUSED').length;
    const updated7d = items.filter((item) => daysDiff(new Date(item.updatedAt), new Date()) <= 7).length;
    return { total, running, paused, updated7d };
  }, [items]);

  const recent = useMemo(() => [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 10), [items]);

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">운영 현황</h1>
        <p className="mt-1 text-sm text-slate-600">확인해야 할 결재, 정산, 캠페인 상태를 모아봅니다.</p>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : null}

      <section className="grid gap-4 lg:grid-cols-[1.15fr_1.85fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-500">오늘의 운영 우선순위</div>
              {loading ? <Skeleton className="mt-2 h-9 w-20" /> : <div className="mt-2 text-3xl font-semibold text-slate-950">{erpSummary?.pendingApprovals ?? 0}건</div>}
            </div>
            <Link href="/approvals" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100">
              결재함
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            <OperationRow label="정산 대기" value={loading ? <Skeleton className="h-4 w-12" /> : `${erpSummary?.pendingSettlements ?? 0}건`} href="/hr/trip-expenses" tone="emerald" />
            <OperationRow label="정산 대기 금액" value={loading ? <Skeleton className="h-4 w-20" /> : erpSummary ? `${erpSummary.pendingSettlementAmount.toLocaleString()}원` : '0원'} href="/hr/trip-expenses" tone="sky" />
            <OperationRow label="미확인 알림" value={loading ? <Skeleton className="h-4 w-12" /> : `${erpSummary?.unreadNotifications ?? 0}건`} href="/notifications" tone="slate" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-500">운영 상태 보드</div>
              <div className="mt-1 text-sm text-slate-600">캠페인과 ERP 흐름을 함께 확인합니다.</div>
            </div>
            <Link href="/hr/leave-stats" className="text-sm font-medium text-slate-600 hover:text-slate-950">근태 통계</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <StatusRail title="캠페인" items={[['전체', loading ? <Skeleton className="h-4 w-8" /> : kpi.total], ['진행중', loading ? <Skeleton className="h-4 w-8" /> : kpi.running], ['일시정지', loading ? <Skeleton className="h-4 w-8" /> : kpi.paused], ['최근 7일', loading ? <Skeleton className="h-4 w-8" /> : kpi.updated7d]]} />
            <StatusRail title="ERP" items={[['올해 근태 신청', loading ? <Skeleton className="h-4 w-8" /> : erpSummary?.yearlyLeaveRequests ?? 0], ['대기 결재', loading ? <Skeleton className="h-4 w-8" /> : erpSummary?.pendingApprovals ?? 0], ['정산 대기', loading ? <Skeleton className="h-4 w-8" /> : erpSummary?.pendingSettlements ?? 0], ['최근 감사 로그', loading ? <Skeleton className="h-4 w-8" /> : erpSummary?.recentAuditLogs ?? 0]]} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">최근 변경 캠페인</h2>
          <Link href="/campaigns" className="text-sm text-slate-600 hover:underline">전체 보기</Link>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-3">이름</th>
                <th className="py-2 pr-3">상태</th>
                <th className="py-2 pr-3">업데이트</th>
                <th className="py-2 pr-3">ID</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <RecentTableSkeleton /> : null}
              {!loading && recent.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-sm text-slate-500">캠페인이 없습니다.</td></tr>
              ) : null}
              {!loading && recent.map((item) => {
                const palette = getStatusPalette(item.status);
                const label = typeof palette.label === 'string' && palette.label.trim() ? palette.label : item.status;
                return (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 pr-3">
                      <Link href={`/campaigns/${encodeURIComponent(item.id)}`} className="font-medium text-slate-900 hover:underline">{item.name}</Link>
                    </td>
                    <td className="py-2 pr-3"><Badge variant={statusKeyToBadgeVariant(palette.key)}>{label}</Badge></td>
                    <td className="py-2 pr-3 text-slate-600">{new Date(item.updatedAt).toLocaleString('ko-KR')}</td>
                    <td className="py-2 pr-3 text-slate-500">{item.id}</td>
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

function OperationRow({ label, value, href, tone }: { label: string; value: ReactNode; href: string; tone: 'emerald' | 'sky' | 'slate' }) {
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

function StatusRail({ title, items }: { title: string; items: Array<[string, ReactNode]> }) {
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
