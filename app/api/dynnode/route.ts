import { NextResponse } from 'next/server';
import { createPost, listPosts } from '@/app/lib/dynnode/store';

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get('pageSize') ?? 10)));

  const all = await listPosts();
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(totalPages, Math.max(1, page));

  const start = (safePage - 1) * pageSize;
  const items = all.slice(start, start + pageSize);

  return NextResponse.json({ items, total, page: safePage, pageSize, totalPages }, { status: 200 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as any);

  if (!body?.title || typeof body.title !== 'string') {
    return NextResponse.json({ message: 'title is required' }, { status: 400 });
  }
  if (!body?.code || typeof body.code !== 'string') {
    return NextResponse.json({ message: 'code is required' }, { status: 400 });
  }

  const post = await createPost({
    title: body.title,
    summary: typeof body.summary === 'string' ? body.summary : null,
    code: body.code,
    sampleCtx: typeof body.sampleCtx === 'string' ? body.sampleCtx : '{\n  \n}\n',
    tags: Array.isArray(body.tags) ? body.tags.filter((x: any) => typeof x === 'string') : [],
    status: body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
  });

  return NextResponse.json({ post }, { status: 201 });
}
