'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { CONTRACT_STATUS_META, type ContractDeal } from '@/app/lib/types/contracts';
import { getContractDeals } from '@/app/lib/api/contracts';

type Granularity = 'daily' | 'weekly';

type TrendRow = {
  date: string;
  contracts: number;
  amount: number;
  avgAmount: number;
};

type AmountRange = {
  label: string;
  chartLabel: string;
  min: number;
  max: number | null;
  count: number;
  amount: number;
};

const AMOUNT_RANGES: Array<Omit<AmountRange, 'count' | 'amount'>> = [
  { label: '500만원 미만', chartLabel: '~500만', min: 0, max: 5_000_000 },
  { label: '500만~1,000만원', chartLabel: '500~1천만', min: 5_000_000, max: 10_000_000 },
  { label: '1,000만~3,000만원', chartLabel: '1천~3천만', min: 10_000_000, max: 30_000_000 },
  { label: '3,000만~5,000만원', chartLabel: '3천~5천만', min: 30_000_000, max: 50_000_000 },
  { label: '5,000만~1억원', chartLabel: '5천만~1억', min: 50_000_000, max: 100_000_000 },
  { label: '1억원 이상', chartLabel: '1억+', min: 100_000_000, max: null },
];

const RANGE_COLORS = ['#CBD5E1', '#93C5FD', '#7DD3FC', '#86EFAC', '#FDE68A', '#FDBA74'];

function clampNumber(value: number, min = 0) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, value);
}

function calcTotalAmount(deal: ContractDeal) {
  const subtotal = deal.items.reduce((acc, item) => acc + clampNumber(item.qty) * clampNumber(item.unitPrice), 0);
  const discount = clampNumber(deal.discount);
  const supply = Math.max(0, subtotal - discount);
  const vat = Math.round(supply * 0.1);
  return supply + vat;
}

function formatKrw(value: number) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(value % 100_000_000 === 0 ? 0 : 1)}억원`;
  if (value >= 10_000) return `${Math.round(value / 10_000).toLocaleString()}만원`;
  return `${value.toLocaleString()}원`;
}

function formatDateLabel(date: string) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date || '-';
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekStartDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '날짜 없음';
  const start = new Date(d);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}

function formatWeekLabel(weekStart: string) {
  if (weekStart === '날짜 없음') return weekStart;
  const d = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(d.getTime())) return weekStart;
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}주`;
}

function groupTrend(deals: ContractDeal[], granularity: Granularity): TrendRow[] {
  const map = new Map<string, { contracts: number; amount: number }>();

  for (const deal of deals) {
    const key = granularity === 'daily' ? deal.closeDate || '날짜 없음' : getWeekStartDate(deal.closeDate);
    const prev = map.get(key) ?? { contracts: 0, amount: 0 };
    const amount = calcTotalAmount(deal);
    map.set(key, { contracts: prev.contracts + 1, amount: prev.amount + amount });
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date: granularity === 'daily' ? formatDateLabel(date) : formatWeekLabel(date),
      contracts: value.contracts,
      amount: value.amount,
      avgAmount: value.contracts === 0 ? 0 : Math.round(value.amount / value.contracts),
    }));
}

function buildAmountRanges(deals: ContractDeal[]): AmountRange[] {
  const ranges = AMOUNT_RANGES.map((range) => ({ ...range, count: 0, amount: 0 }));

  for (const deal of deals) {
    const amount = calcTotalAmount(deal);
    const bucket = ranges.find((range) => amount >= range.min && (range.max === null || amount < range.max)) ?? ranges[ranges.length - 1];
    bucket.count += 1;
    bucket.amount += amount;
  }

  return ranges;
}

export default function ActivityStatsClient() {
  const [granularity, setGranularity] = useState<Granularity>('daily');

  const query = useQuery<ContractDeal[]>({
    queryKey: ['contracts-deals'],
    queryFn: () => getContractDeals(),
    staleTime: 15_000,
    retry: 1,
  });

  const deals = query.data ?? [];

  const trend = useMemo(() => groupTrend(deals, granularity), [deals, granularity]);
  const amountRanges = useMemo(() => buildAmountRanges(deals), [deals]);
  const statusRows = useMemo(() => {
    return CONTRACT_STATUS_META.map((status) => {
      const rows = deals.filter((deal) => deal.status === status.key);
      const amount = rows.reduce((acc, deal) => acc + calcTotalAmount(deal), 0);
      return { status: status.label, count: rows.length, amount };
    });
  }, [deals]);

  const kpi = useMemo(() => {
    const totalContracts = deals.length;
    const totalAmount = deals.reduce((acc, deal) => acc + calcTotalAmount(deal), 0);
    const contracted = deals.filter((deal) => deal.status === 'CONTRACTED' || deal.status === 'DONE').length;
    const avgAmount = totalContracts === 0 ? 0 : Math.round(totalAmount / totalContracts);

    return {
      totalContracts,
      contracted,
      totalAmount,
      avgAmount,
    };
  }, [deals]);

  if (query.isLoading) return <ActivityStatsSkeleton />;

  if (query.isError) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          계약 통계를 불러오지 못했습니다. {query.error instanceof Error ? query.error.message : ''}
        </div>
        <Button variant="outline" onClick={() => query.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">계약현황통계</h1>
          <p className="text-sm text-muted-foreground">영업현황관리의 실제 계약 데이터 기준으로 계약 건수와 총액을 집계합니다.</p>
        </div>

        <div className="flex items-center gap-2">
          <SegmentButton active={granularity === 'daily'} onClick={() => setGranularity('daily')}>
            일간
          </SegmentButton>
          <SegmentButton active={granularity === 'weekly'} onClick={() => setGranularity('weekly')}>
            주간
          </SegmentButton>
          <Button variant="outline" type="button" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? '갱신 중...' : '새로고침'}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="총 계약 건수" value={`${kpi.totalContracts.toLocaleString()}건`} badge="Deals" />
        <KpiCard title="계약/완료 건수" value={`${kpi.contracted.toLocaleString()}건`} badge="Closed" />
        <KpiCard title="총 계약 금액" value={formatKrw(kpi.totalAmount)} badge="Total" />
        <KpiCard title="평균 계약 금액" value={formatKrw(kpi.avgAmount)} badge="Avg" />
      </div>

      {deals.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          아직 등록된 계약 데이터가 없습니다. 영업현황관리에서 계약을 등록하면 통계가 자동으로 집계됩니다.
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">계약 건수/총액 추이</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" interval={0} tick={{ fontSize: 11 }} height={36} />
                    <YAxis yAxisId="count" allowDecimals={false} />
                    <YAxis yAxisId="amount" orientation="right" tickFormatter={formatKrw} width={72} />
                    <Tooltip formatter={(value, name) => [name === '총액' || name === '평균 금액' ? formatKrw(Number(value)) : `${value}건`, name]} />
                    <Line yAxisId="count" type="monotone" dataKey="contracts" name="계약 건수" stroke="#2563EB" strokeWidth={2} dot={false} />
                    <Line yAxisId="amount" type="monotone" dataKey="amount" name="총액" stroke="#0F766E" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">총 금액 구간</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={amountRanges}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="chartLabel" interval={0} tick={{ fontSize: 11 }} height={48} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(value, name) => [name === '누적 금액' ? formatKrw(Number(value)) : `${Number(value).toLocaleString()}건`, name]} />
                    <Bar dataKey="count" name="계약 건수">
                      {amountRanges.map((_, index) => (
                        <Cell key={index} fill={RANGE_COLORS[index % RANGE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <StatsTable title="금액 구간 상세" rows={amountRanges.map((row) => ({ label: row.label, count: row.count, amount: row.amount }))} />
            <StatsTable title="상태별 상세" rows={statusRows.map((row) => ({ label: row.status, count: row.count, amount: row.amount }))} />
          </div>
        </>
      )}
    </div>
  );
}

function SegmentButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-md border px-3 py-2 text-sm transition',
        active ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function KpiCard({ title, value, badge }: { title: string; value: string; badge: string }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span>{title}</span>
          <Badge variant="secondary">{badge}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatsTable({ title, rows }: { title: string; rows: Array<{ label: string; count: number; amount: number }> }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 text-left font-medium">구분</th>
                <th className="py-2 text-right font-medium">계약</th>
                <th className="py-2 text-right font-medium">금액</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b last:border-b-0">
                  <td className="py-2">{row.label}</td>
                  <td className="py-2 text-right">{row.count.toLocaleString()}건</td>
                  <td className="py-2 text-right">{formatKrw(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityStatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-[360px] rounded-2xl" />
        <Skeleton className="h-[360px] rounded-2xl" />
      </div>
    </div>
  );
}
