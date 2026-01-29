import { NextResponse } from 'next/server';
import { listNotices } from '@/app/lib/notice/store';

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = clamp(Number(url.searchParams.get('limit') ?? 5), 1, 5);

  const all = await listNotices();

  // (선택) PUBLISHED만 배너에 노출
  const published = all.filter((n) => n.status === 'PUBLISHED');

  const pinned = published.filter((n) => n.pinned);
  const unpinned = published.filter((n) => !n.pinned);

  const items = [...pinned, ...unpinned].slice(0, limit);

  return NextResponse.json({ items }, { status: 200 });
}
