'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';

import { ResponsiveContainer, LineChart, Line, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

type Granularity = 'daily' | 'weekly';

// 더미 데이터(일별)
const DUMMY_DAILY = [
  { date: '02-01', contracts: 3, activities: 12, amount: 320 },
  { date: '02-02', contracts: 5, activities: 18, amount: 540 },
  { date: '02-03', contracts: 2, activities: 9, amount: 210 },
  { date: '02-04', contracts: 6, activities: 22, amount: 610 },
  { date: '02-05', contracts: 4, activities: 15, amount: 430 },
  { date: '02-06', contracts: 7, activities: 26, amount: 720 },
  { date: '02-07', contracts: 5, activities: 19, amount: 560 },
];

// 더미 데이터(주별)
const DUMMY_WEEKLY = [
  { date: 'W1', contracts: 18, activities: 72, amount: 2100 },
  { date: 'W2', contracts: 24, activities: 95, amount: 2760 },
  { date: 'W3', contracts: 16, activities: 61, amount: 1840 },
  { date: 'W4', contracts: 28, activities: 110, amount: 3120 },
];

export default function ActivityStatsClient() {
  const [granularity, setGranularity] = useState<Granularity>('daily');

  const data = useMemo(() => {
    return granularity === 'daily' ? DUMMY_DAILY : DUMMY_WEEKLY;
  }, [granularity]);

  const kpi = useMemo(() => {
    const totalContracts = data.reduce((acc, cur) => acc + cur.contracts, 0);
    const totalActivities = data.reduce((acc, cur) => acc + cur.activities, 0);
    const totalAmount = data.reduce((acc, cur) => acc + cur.amount, 0);

    const avgActivitiesPerContract = totalContracts === 0 ? 0 : Math.round((totalActivities / totalContracts) * 10) / 10;

    return {
      totalContracts,
      totalActivities,
      totalAmount,
      avgActivitiesPerContract,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">계약활동통계</h1>
          <p className="text-sm text-muted-foreground">기간/단위별로 계약·활동량·금액 지표를 요약합니다. (현재 더미 데이터)</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGranularity('daily')}
            className={[
              'rounded-md border px-3 py-2 text-sm transition',
              granularity === 'daily' ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-50 text-slate-600',
            ].join(' ')}
          >
            일간
          </button>

          <button
            type="button"
            onClick={() => setGranularity('weekly')}
            className={[
              'rounded-md border px-3 py-2 text-sm transition',
              granularity === 'weekly' ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-50 text-slate-600',
            ].join(' ')}
          >
            주간
          </button>

          <Button variant="outline" type="button" onClick={() => alert('추후 CSV 내보내기 설정.')}>
            내보내기
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="총 계약 건수" value={`${kpi.totalContracts}건`} badge="Contracts" />
        <KpiCard title="총 활동 수" value={`${kpi.totalActivities}회`} badge="Activities" />
        <KpiCard title="총 금액(지표)" value={`${kpi.totalAmount}`} badge="Amount" />
        <KpiCard title="계약당 평균 활동" value={`${kpi.avgActivitiesPerContract}`} badge="Avg" />
      </div>

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">계약/활동 추이</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="contracts" name="계약" stroke="#60A5FA" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="activities" name="활동" stroke="#A7F3D0" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">금액(지표) 분포</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === '금액(지표)') return [Number(value).toLocaleString(), name];
                    return [value, name];
                  }}
                />
                <Bar dataKey="amount" name="금액(지표)" fill="#84c676" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">상세</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">구간</th>
                  <th className="py-2 text-right font-medium">계약</th>
                  <th className="py-2 text-right font-medium">활동</th>
                  <th className="py-2 text-right font-medium">금액(지표)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.date} className="border-b last:border-b-0">
                    <td className="py-2">{row.date}</td>
                    <td className="py-2 text-right">{row.contracts}</td>
                    <td className="py-2 text-right">{row.activities}</td>
                    <td className="py-2 text-right">{row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">다음 단계: 더미 데이터 상태입니다.</div>
    </div>
  );
}

function KpiCard({ title, value, badge }: { title: string; value: string; badge: string }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
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
