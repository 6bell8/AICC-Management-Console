'use client';

import * as React from 'react';
import { useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend);

type Props = {
  trend: { label: string; value: number }[];
  statusDist: { label: string; value: number }[]; // label: '실행중' | '성공' | '실패' | '취소' 처럼 들어온다고 가정
};

export default function DashboardCharts({ trend, statusDist }: Props) {
  // ✅ 자연스러운 하늘색 계열
  const SKY_LINE = '#38BDF8'; // sky-400 느낌
  const SKY_FILL = 'rgba(56, 189, 248, 0.18)';

  const lineData = useMemo(() => {
    return {
      labels: trend.map((t) => t.label),
      datasets: [
        {
          label: '업데이트(건)',
          data: trend.map((t) => t.value),
          tension: 0.35,

          // ✅ 색상
          borderColor: SKY_LINE,
          backgroundColor: SKY_FILL,
          fill: true,

          // ✅ 점 스타일(선택)
          pointRadius: 2,
          pointHoverRadius: 4,
          pointBackgroundColor: SKY_LINE,
          pointBorderColor: SKY_LINE,
        },
      ],
    };
  }, [trend]);

  const donutData = useMemo(() => {
    const labels = statusDist.map((s) => s.label);

    // ✅ 상태별 색(너무 튀지 않게)
    const colorByLabel: Record<string, string> = {
      실행중: '#34D399', // emerald-400
      성공: '#60A5FA', // blue-400
      실패: '#F87171', // red-400
      취소: '#94A3B8', // slate-400
      RUNNING: '#34D399',
      SUCCESS: '#60A5FA',
      FAILED: '#F87171',
      CANCELLED: '#94A3B8',
    };

    const colors = labels.map((l) => colorByLabel[l] ?? '#CBD5E1'); // 기본 slate-300

    return {
      labels,
      datasets: [
        {
          label: '상태 분포',
          data: statusDist.map((s) => s.value),

          // ✅ 색상
          backgroundColor: colors,
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    };
  }, [statusDist]);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">최근 {trend.length}분 실행 추이</h2>
          <span className="text-xs text-slate-500">단위: 건</span>
        </div>
        <div className="mt-3 h-64">
          <Line
            data={lineData}
            options={{
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: {
                  ticks: { precision: 0 }, // ✅ 정수
                },
              },
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">상태 분포</h2>
          <span className="text-xs text-slate-500">전체 기준</span>
        </div>
        <div className="mt-3 h-64">
          <Doughnut
            data={donutData}
            options={{
              maintainAspectRatio: false,
              cutout: '65%',
              plugins: { legend: { position: 'bottom' } },
            }}
          />
        </div>
      </div>
    </div>
  );
}
