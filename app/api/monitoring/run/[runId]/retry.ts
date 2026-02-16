// app/api/monitoring/runs/[runId]/retry/route.ts
import { NextResponse } from 'next/server';
import { loadStore, saveStore, makeRun } from '@/app/lib/monitoring/store';

export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  const store = await loadStore();
  const prev = store.runs.find((r) => r.runId === runId);
  if (!prev) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  // 실패/취소된 것만 재시도 허용(원하시면 RUNNING도 허용 가능)
  if (prev.state === 'RUNNING') {
    return NextResponse.json({ message: 'RUNNING 상태는 재시도할 수 없습니다.' }, { status: 409 });
  }

  const nextRun = makeRun(prev.campaignId, prev.campaignName);
  // 재시도 이벤트 느낌 추가
  nextRun.events.push({
    ts: new Date().toISOString(),
    level: 'INFO',
    type: 'RETRY',
    message: `이전 실행(${runId}) 재시도`,
    meta: { fromRunId: runId },
  });

  store.runs.unshift(nextRun);
  await saveStore(store);

  return NextResponse.json(nextRun, { status: 201 });
}
