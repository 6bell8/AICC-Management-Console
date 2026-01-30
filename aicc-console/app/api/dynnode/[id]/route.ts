import { NextResponse } from 'next/server';
import { deletePost, getPost, patchPost } from '@/app/lib/dynnode/store';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;

  const post = await getPost(id);
  if (!post) return NextResponse.json({ message: 'not found' }, { status: 404 });
  return NextResponse.json({ post }, { status: 200 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}) as any);

  const next = await patchPost(id, {
    title: typeof body.title === 'string' ? body.title : undefined,
    summary: typeof body.summary === 'string' ? body.summary : body.summary === null ? null : undefined,
    code: typeof body.code === 'string' ? body.code : undefined,
    sampleCtx: typeof body.sampleCtx === 'string' ? body.sampleCtx : undefined,
    tags: Array.isArray(body.tags) ? body.tags.filter((x: any) => typeof x === 'string') : undefined,
    status: body.status === 'PUBLISHED' || body.status === 'DRAFT' ? body.status : undefined,
  });

  if (!next) return NextResponse.json({ message: 'not found' }, { status: 404 });
  return NextResponse.json({ post: next }, { status: 200 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;

  const removed = await deletePost(id);
  if (removed <= 0) {
    return NextResponse.json({ ok: false, message: 'not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, removed });
}
