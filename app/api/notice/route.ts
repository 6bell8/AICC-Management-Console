import { NextResponse } from 'next/server';
import { createNotice, listNotices } from '@/app/lib/notice/store';
import { requireWriteAccess } from '@/app/lib/auth/permissions';
import { getCurrentUser } from '@/app/lib/auth/session';

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = clamp(Number(url.searchParams.get('page') ?? 1), 1, 10_000);
  const pageSize = clamp(Number(url.searchParams.get('pageSize') ?? 10), 5, 50);
  const q = (url.searchParams.get('q') ?? '').trim();
  const statusParam = url.searchParams.get('status');
  const status = statusParam === 'PUBLISHED' || statusParam === 'DRAFT' ? statusParam : 'ALL';
  const pinned = url.searchParams.get('pinned') === 'true';

  const all = await listNotices({ q, status, pinned });
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clamp(page, 1, totalPages);

  const start = (safePage - 1) * pageSize;
  const items = all.slice(start, start + pageSize);

  return NextResponse.json({ items, total, page: safePage, pageSize, totalPages }, { status: 200 });
}

export async function POST(req: Request) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

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
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      editorName: (await getCurrentUser())?.name ?? null,
    });

    return NextResponse.json({ notice }, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ message: e?.message ?? 'server error' }, { status: 500 });
  }
}
