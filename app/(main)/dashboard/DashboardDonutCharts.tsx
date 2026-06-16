'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

type ChartItem = {
  label: string;
  value: number;
};

const COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#a78bfa', '#94a3b8'];

export default function DashboardDonutCharts({
  contractItems,
  campaignItems,
}: {
  contractItems: ChartItem[];
  campaignItems: ChartItem[];
}) {
  return (
    <section className="grid gap-3 xl:grid-cols-3">
      <DonutCard title="계약 단계 분포" items={contractItems} />
      <DonutCard title="캠페인 상태 분포" items={campaignItems} />
      <FunnelCard title="영업 퍼널" items={contractItems} />
    </section>
  );
}

function DonutCard({ title, items }: { title: string; items: ChartItem[] }) {
  const total = items.reduce((acc, item) => acc + item.value, 0);
  const chartItems = total > 0 ? items : [{ label: '데이터 없음', value: 1 }];

  return (
    <div className="soft-panel soft-flow-hover p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">전체 {total.toLocaleString()}건 기준</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
          분포
        </span>
      </div>
      <div className="grid items-center gap-2 sm:grid-cols-[132px_1fr] xl:grid-cols-1 2xl:grid-cols-[132px_1fr]">
        <div className="relative h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartItems}
                dataKey="value"
                nameKey="label"
                innerRadius={38}
                outerRadius={56}
                paddingAngle={2}
                stroke="#ffffff"
                strokeWidth={2}
              >
                {chartItems.map((item, index) => (
                  <Cell key={item.label} fill={total > 0 ? COLORS[index % COLORS.length] : '#e2e8f0'} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${Number(value).toLocaleString()}건`, '건수']}
                contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', boxShadow: '0 12px 28px rgb(15 23 42 / 0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-semibold text-slate-950">{total}</div>
              <div className="text-[11px] text-slate-400">건</div>
            </div>
          </div>
        </div>
        <div className="grid gap-1.5">
          {items.map((item, index) => (
            <div key={item.label} className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-2.5 py-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="truncate text-xs font-medium text-slate-600">{item.label}</span>
              </div>
              <span className="text-xs font-semibold text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FunnelCard({ title, items }: { title: string; items: ChartItem[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const total = items.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="soft-panel soft-flow-hover p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">단계별 전환 흐름 · 총 {total.toLocaleString()}건</p>
        </div>
        <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
          funnel
        </span>
      </div>

      <div className="space-y-1.5">
        {items.map((item, index) => {
          const width = Math.max(34, (item.value / max) * 100);
          return (
            <div key={item.label} className="group">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600">{item.label}</span>
                <span className="font-semibold text-slate-900">{item.value}건</span>
              </div>
              <div className="h-8 rounded-lg bg-slate-50 p-1">
                <div
                  className="activity-heatmap-cell activity-heatmap-cell-active flex h-full items-center justify-end rounded-md px-2 text-[11px] font-semibold text-white shadow-sm transition-all duration-200 group-hover:brightness-105"
                  style={{
                    width: `${width}%`,
                    background: `linear-gradient(90deg, ${COLORS[index % COLORS.length]}, ${COLORS[(index + 1) % COLORS.length]})`,
                  }}
                >
                  {Math.round(width)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
          <div className="text-[11px] font-medium text-slate-500">시작 단계</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">{items[0]?.label ?? '-'}</div>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
          <div className="text-[11px] font-medium text-emerald-700/80">완료 단계</div>
          <div className="mt-0.5 text-sm font-semibold text-emerald-950">{items[items.length - 1]?.value ?? 0}건</div>
        </div>
      </div>
    </div>
  );
}
