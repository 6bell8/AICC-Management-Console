import { NextResponse } from 'next/server';
import { createNotice, listNotices } from '@/app/lib/notice/store';

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = clamp(Number(url.searchParams.get('page') ?? 1), 1, 10_000);
  const pageSize = clamp(Number(url.searchParams.get('pageSize') ?? 10), 5, 50);

  const all = await listNotices();
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clamp(page, 1, totalPages);

  const start = (safePage - 1) * pageSize;
  const items = all.slice(start, start + pageSize);

  return NextResponse.json({ items, total, page: safePage, pageSize, totalPages }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}) as any);

    if (!body?.title || typeof body.title !== 'string') {
      return NextResponse.json({ message: 'title is required' }, { status: 400 });
    }
    if (!body?.content || typeof body.content !== 'string') {
      return NextResponse.json({ message: 'content is required' }, { status: 400 });
    }

    const notice = await createNotice({
      title: body.title,
      content: body.content,
      pinned: body.pinned === true,
      status: body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
    });

    return NextResponse.json({ notice }, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ message: e?.message ?? 'server error' }, { status: 500 });
  }
}
