'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardCharts from '../../dashboard/DashboardCharts'; // 경로는 실제 위치에 맞게 조정
import { Button } from '@/app/components/ui/button';

type SummaryRes = {
  minutes: number;
  kpi: { total: number; running: number; success: number; failed: number; cancelled: number };
  trend: { label: string; value: number }[];
  stateDist: { label: string; value: number }[];
  topErrors: { code: string; count: number }[];
};

type RunItem = {
  runId: string;
  campaignId: string;
  campaignName: string;
  state: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  processed: number;
  success: number;
  failed: number;
  errorCode: string | null;
  errorCount: number;
  latencyAvgMs: number;
  latencyP95Ms: number;
};

export default function MonitoringPage() {
  const qc = useQueryClient();
  const minutes = 30;

  // 1) 요약(차트/KPI)
  const summaryQ = useQuery({
    queryKey: ['monitoring', 'summary', minutes],
    queryFn: async (): Promise<SummaryRes> => {
      const res = await fetch(`/api/monitoring/summary?minutes=${minutes}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('summary fetch 실패');
      return res.json();
    },
    refetchInterval: 5000, // ✅ 폴링
  });

  // 2) 최근 실행 리스트
  const runsQ = useQuery({
    queryKey: ['monitoring', 'runs'],
    queryFn: async (): Promise<{ items: RunItem[] }> => {
      const res = await fetch('/api/monitoring/run?limit=50', { cache: 'no-store' });
      if (!res.ok) throw new Error('runs fetch 실패');
      return res.json();
    },
    refetchInterval: 5000, // ✅ 폴링
  });

  // 3) 캠페인 중지 액션
  const stopCampaignM = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(`/api/monitoring/campaigns/${encodeURIComponent(campaignId)}/stop`, { method: 'POST' });
      if (!res.ok) throw new Error('중지 실패');
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['monitoring', 'runs'] });
      await qc.invalidateQueries({ queryKey: ['monitoring', 'summary', minutes] });
    },
  });

  const summary = summaryQ.data;
  const runs = runsQ.data?.items ?? [];

  // ✅ 도넛 라벨을 보기 좋게(선택)
  const statusDist = React.useMemo(() => {
    const mapLabel = (s: string) => {
      switch (s) {
        case 'RUNNING':
          return '실행중';
        case 'SUCCESS':
          return '성공';
        case 'FAILED':
          return '실패';
        case 'CANCELLED':
          return '취소';
        default:
          return s;
      }
    };
    return (summary?.stateDist ?? []).map((x) => ({ label: mapLabel(x.label), value: x.value }));
  }, [summary?.stateDist]);

  const trend = summary?.trend ?? [];

  return (
    <div className="space-y-6 mt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">모니터링</h1>
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['monitoring'] })}>
          새로고침
        </Button>
      </div>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard title="총 실행" value={summary?.kpi.total} loading={summaryQ.isLoading} />
        <KpiCard title="실행중" value={summary?.kpi.running} loading={summaryQ.isLoading} />
        <KpiCard title="성공" value={summary?.kpi.success} loading={summaryQ.isLoading} />
        <KpiCard title="실패" value={summary?.kpi.failed} loading={summaryQ.isLoading} />
        <KpiCard title="취소" value={summary?.kpi.cancelled} loading={summaryQ.isLoading} />
      </section>

      {/* 차트 */}
      <DashboardCharts trend={trend} statusDist={statusDist} />

      {/* 최근 실행 테이블 */}
      <section className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">최근 실행</div>
          {runsQ.isFetching ? <span className="text-xs text-slate-500">업데이트 중…</span> : null}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b">
                <th className="py-2 pr-3">캠페인</th>
                <th className="py-2 pr-3">상태</th>
                <th className="py-2 pr-3">처리</th>
                <th className="py-2 pr-3">에러</th>
                <th className="py-2 pr-3">시작</th>
                <th className="py-2 pr-3">조치</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.runId} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{r.campaignName}</div>
                    <div className="text-xs text-slate-500">{r.runId}</div>
                  </td>
                  <td className="py-2 pr-3">{r.state}</td>
                  <td className="py-2 pr-3">{r.processed}건</td>
                  <td className="py-2 pr-3">{r.errorCode ? `${r.errorCode} (${r.errorCount})` : '-'}</td>
                  <td className="py-2 pr-3 text-slate-600">{new Date(r.startedAt).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    <Button
                      variant="outline"
                      disabled={stopCampaignM.isPending || r.state !== 'RUNNING'}
                      onClick={() => stopCampaignM.mutate(r.campaignId)}
                    >
                      캠페인 중지
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {runsQ.isLoading ? <div className="py-6 text-center text-sm text-slate-500">불러오는 중…</div> : null}
        </div>
      </section>
    </div>
  );
}

function KpiCard({ title, value, loading }: { title: string; value?: number; loading: boolean }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-600">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{loading ? '—' : (value ?? 0)}</div>
    </div>
  );
}
