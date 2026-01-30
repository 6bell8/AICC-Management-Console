// app/api/monitoring/runs/[runId]/route.ts
import { NextResponse } from 'next/server';
import { loadAndTickStore } from '@/app/lib/monitoring/store';

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const { runs } = await loadAndTickStore();

  const found = runs.find((r) => r.runId === runId);
  if (!found) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  return NextResponse.json(found, { status: 200 });
}
