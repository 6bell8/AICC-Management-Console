import { NextResponse } from 'next/server';
import { createPost, listPosts } from '@/app/lib/dynnode/store';
import { requireWriteAccess } from '@/app/lib/auth/permissions';
import { getCurrentUser } from '@/app/lib/auth/session';

type DynNodeBody = {
  title?: unknown;
  summary?: unknown;
  code?: unknown;
  sampleCtx?: unknown;
  ctxKey?: unknown;
  tags?: unknown;
  status?: unknown;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get('pageSize') ?? 10)));
  const q = (url.searchParams.get('q') ?? '').trim();
  const statusParam = url.searchParams.get('status');
  const status = statusParam === 'PUBLISHED' || statusParam === 'DRAFT' ? statusParam : 'ALL';

  const all = await listPosts({ q, status });
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(totalPages, Math.max(1, page));

  const start = (safePage - 1) * pageSize;
  const items = all.slice(start, start + pageSize);

  return NextResponse.json({ items, total, page: safePage, pageSize, totalPages }, { status: 200 });
}

export async function POST(req: Request) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as DynNodeBody;

  if (!body?.title || typeof body.title !== 'string') {
    return NextResponse.json({ message: 'title is required' }, { status: 400 });
  }
  if (!body?.code || typeof body.code !== 'string') {
    return NextResponse.json({ message: 'code is required' }, { status: 400 });
  }

  const user = await getCurrentUser();
  const post = await createPost({
    title: body.title,
    summary: typeof body.summary === 'string' ? body.summary : null,
    code: body.code,
    sampleCtx: typeof body.sampleCtx === 'string' ? body.sampleCtx : '{\n  \n}\n',
    ctxKey: typeof body.ctxKey === 'string' ? body.ctxKey : 'api:API01',
    tags: Array.isArray(body.tags) ? body.tags.filter((x): x is string => typeof x === 'string') : [],
    status: body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
    editorName: user?.name ?? null,
  });

  return NextResponse.json({ post }, { status: 201 });
}
