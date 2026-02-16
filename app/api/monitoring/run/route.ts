// app/api/monitoring/run/route.ts
import { NextResponse } from 'next/server';
import { loadStore } from '@/app/lib/monitoring/store';

export async function GET(req: Request) {
  const { runs } = await loadStore();
  return NextResponse.json({ items: runs }, { status: 200 });
}
