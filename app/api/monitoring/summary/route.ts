// app/api/monitoring/summary/route.ts
import { NextResponse } from 'next/server';
import { loadStore } from '@/app/lib/monitoring/store';

function toMinuteKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const minutes = Math.min(Math.max(Number(url.searchParams.get('minutes') ?? 30), 5), 180);

  const store = await loadStore();
  const runs = store.runs ?? [];

  // ✅ minutes 필터 대신 "최근 N개" 기준
  const recent = [...runs].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 200);

  // KPI
  const total = recent.length;
  const running = recent.filter((r) => r.state === 'RUNNING').length;
  const success = recent.filter((r) => r.state === 'SUCCESS').length;
  const failed = recent.filter((r) => r.state === 'FAILED').length;
  const cancelled = recent.filter((r) => r.state === 'CANCELLED').length;

  // 상태 분포(도넛)
  const stateDist = [
    { label: 'RUNNING', value: running },
    { label: 'SUCCESS', value: success },
    { label: 'FAILED', value: failed },
    { label: 'CANCELLED', value: cancelled },
  ];

  // ✅ trend 버킷 (recent의 시간대 기준으로 생성)
  const bucket: Record<string, number> = {};

  if (recent.length > 0) {
    const times = recent.map((r) => new Date(r.startedAt).getTime());
    const maxT = Math.max(...times); // ✅ recent의 최신 시간 기준
    const startT = maxT - (minutes - 1) * 60 * 1000;

    for (let t = startT; t <= maxT; t += 60 * 1000) {
      bucket[toMinuteKey(new Date(t))] = 0;
    }

    for (const r of recent) {
      const k = toMinuteKey(new Date(r.startedAt));
      if (k in bucket) bucket[k] += 1;
    }
  } else {
    // 데이터 없을 때도 라벨은 유지(0으로)
    const maxT = Date.now();
    const startT = maxT - (minutes - 1) * 60 * 1000;
    for (let t = startT; t <= maxT; t += 60 * 1000) {
      bucket[toMinuteKey(new Date(t))] = 0;
    }
  }

  // ✅ trend는 시간순으로 정렬해서 반환(차트가 안정적)
  const trend = Object.keys(bucket)
    .sort() // "YYYY-MM-DD HH:mm" 포맷이라 문자열 정렬 = 시간 정렬
    .map((k) => ({ label: k.slice(11), value: bucket[k] }));

  // 에러 Top
  const errorTop: Record<string, number> = {};
  for (const r of recent) {
    if (!r.errorCode) continue;
    errorTop[r.errorCode] = (errorTop[r.errorCode] ?? 0) + r.errorCount;
  }
  const topErrors = Object.entries(errorTop)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }));

  return NextResponse.json({ minutes, kpi: { total, running, success, failed, cancelled }, stateDist, trend, topErrors }, { status: 200 });
}
