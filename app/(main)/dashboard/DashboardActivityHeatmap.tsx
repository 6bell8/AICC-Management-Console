'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';

type ActivityType = 'all' | 'leave' | 'approval' | 'expense' | 'reservation';

type ActivityHeatmapItem = {
  date: string;
  type: string;
  count: number;
};

const FILTERS: Array<{ key: ActivityType; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'leave', label: '연차' },
  { key: 'approval', label: '결재' },
  { key: 'expense', label: '출장여비' },
  { key: 'reservation', label: '공간예약' },
];

const TYPE_LABEL: Record<string, string> = {
  leave: '연차/출장 신청',
  approval: '결재 단계',
  expense: '출장여비',
  reservation: '공간예약',
};

const TYPE_TONE: Record<string, string> = {
  leave: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  approval: 'border-amber-100 bg-amber-50 text-amber-800',
  expense: 'border-sky-100 bg-sky-50 text-sky-700',
  reservation: 'border-violet-100 bg-violet-50 text-violet-700',
};

export default function DashboardActivityHeatmap({ items }: { items: ActivityHeatmapItem[] }) {
  const [filter, setFilter] = useState<ActivityType>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const filteredItems = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.type === filter)),
    [filter, items],
  );
  const countByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of filteredItems) {
      map.set(item.date, (map.get(item.date) ?? 0) + item.count);
    }
    return map;
  }, [filteredItems]);
  const detailByDate = useMemo(() => {
    const map = new Map<string, ActivityHeatmapItem[]>();
    for (const item of items) {
      map.set(item.date, [...(map.get(item.date) ?? []), item]);
    }
    return map;
  }, [items]);

  const firstDate = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0);
  const startOffset = firstDate.getDay();
  const totalDays = lastDate.getDate();
  const max = Math.max(1, ...Array.from(countByDate.values()));
  const total = filteredItems.reduce((acc, item) => acc + item.count, 0);
  const peak = Array.from(countByDate.entries()).reduce(
    (best, [date, count]) => (count > best.count ? { date, count } : best),
    { date: '', count: 0 },
  );
  const cells = [
    ...Array.from({ length: startOffset }, (_, index) => ({ key: `empty-${index}`, day: null as number | null, date: '', count: 0 })),
    ...Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { key: date, day, date, count: countByDate.get(date) ?? 0 };
    }),
  ];
  const selectedDetails = selectedDate ? detailByDate.get(selectedDate) ?? [] : [];
  const selectedTotal = selectedDetails.reduce((acc, item) => acc + item.count, 0);

  return (
    <section className="soft-panel p-3">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">월간 업무 밀도</h2>
          <p className="mt-1 text-xs text-slate-500">연차, 결재, 출장여비, 공간 예약이 몰린 날짜를 보여줍니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={[
                'soft-interactive rounded-full border px-3 py-1 text-xs font-semibold',
                filter === item.key ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-500',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <Badge label={`이번 달 ${total}건`} tone="sky" />
        {peak.date ? <Badge label={`최다 ${peak.date.slice(5)} · ${peak.count}건`} tone="emerald" /> : <Badge label="데이터 없음" tone="slate" />}
      </div>
      <div className="grid grid-cols-7 overflow-visible rounded-lg border border-slate-100 bg-slate-50/60 text-xs">
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
          <div key={day} className="border-b border-slate-100 bg-white px-2 py-2 text-center font-medium text-slate-500">
            {day}
          </div>
        ))}
        {cells.map((cell) => (
          <button
            key={cell.key}
            type="button"
            disabled={!cell.day}
            onClick={() => cell.day && setSelectedDate(cell.date)}
            className={[
              'activity-heatmap-cell min-h-16 border-b border-r border-slate-100 p-2 text-left last:border-r-0 disabled:pointer-events-none',
              cell.day ? heatmapTone(cell.count, max) : 'bg-slate-50/50',
              cell.count > 0 ? 'activity-heatmap-cell-active' : '',
            ].join(' ')}
            title={cell.day ? `${cell.date}: ${cell.count}건` : undefined}
          >
            {cell.day ? (
              <div className="relative z-10 flex h-full flex-col justify-between">
                <span className="text-xs font-semibold text-slate-700">{cell.day}</span>
                <span className="self-end rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm">
                  {cell.count}건
                </span>
              </div>
            ) : null}
          </button>
        ))}
      </div>

      {selectedDate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-[2px]" onClick={() => setSelectedDate(null)}>
          <div className="soft-panel soft-flow-hover w-full max-w-md p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-950">{selectedDate} 업무 밀도</h3>
                <p className="mt-1 text-sm text-slate-500">선택한 날짜에 집계된 운영 이벤트입니다.</p>
              </div>
              <button type="button" onClick={() => setSelectedDate(null)} className="soft-icon-button" aria-label="닫기">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {selectedDetails.length > 0 ? (
                selectedDetails.map((item) => (
                  <div key={`${item.date}-${item.type}`} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                    <span className={['inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', TYPE_TONE[item.type] ?? TYPE_TONE.approval].join(' ')}>
                      {TYPE_LABEL[item.type] ?? item.type}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{item.count}건</span>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">집계된 업무가 없습니다.</div>
              )}
            </div>
            <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-right text-sm font-semibold text-slate-700">합계 {selectedTotal}건</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Badge({ label, tone }: { label: string; tone: 'sky' | 'emerald' | 'slate' }) {
  const toneClass = {
    sky: 'border-sky-100 bg-sky-50 text-sky-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  }[tone];
  return <span className={['inline-flex rounded-full border px-2.5 py-1 font-semibold', toneClass].join(' ')}>{label}</span>;
}

function heatmapTone(count: number, max: number) {
  if (count <= 0) return 'bg-white';
  const ratio = count / max;
  if (ratio >= 0.75) return 'bg-sky-200/90';
  if (ratio >= 0.5) return 'bg-sky-100';
  if (ratio >= 0.25) return 'bg-sky-50';
  return 'bg-slate-50';
}
