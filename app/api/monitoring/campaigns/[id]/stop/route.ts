// app/api/monitoring/campaigns/[id]/stop/route.ts
import { NextResponse } from 'next/server';
import { loadStore, saveStore } from '@/app/lib/monitoring/store';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const store = await loadStore();

  let cancelled = 0;
  for (const r of store.runs) {
    if (r.campaignId !== id) continue;
    if (r.state !== 'RUNNING') continue;

    r.state = 'CANCELLED';
    r.endedAt = new Date().toISOString();
    r.durationMs = Date.now() - new Date(r.startedAt).getTime();
    r.events.push({
      ts: new Date().toISOString(),
      level: 'WARN',
      type: 'STOP',
      message: '캠페인 중지로 실행 취소',
      meta: { campaignId: id },
    });

    cancelled += 1;
  }

  await saveStore(store);
  return NextResponse.json({ ok: true, campaignId: id, cancelled }, { status: 200 });
}
