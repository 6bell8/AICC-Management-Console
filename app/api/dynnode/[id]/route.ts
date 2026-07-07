import { NextResponse } from 'next/server';
import { deletePost, getPost, patchPost } from '@/app/lib/dynnode/store';
import { requireWriteAccess } from '@/app/lib/auth/permissions';

type Ctx = { params: Promise<{ id: string }> };
type DynNodePatchBody = {
  title?: unknown;
  summary?: unknown;
  code?: unknown;
  sampleCtx?: unknown;
  ctxKey?: unknown;
  tags?: unknown;
  status?: unknown;
};

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;

  const post = await getPost(id);
  if (!post) return NextResponse.json({ message: 'not found' }, { status: 404 });
  return NextResponse.json({ post }, { status: 200 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as DynNodePatchBody;

  const next = await patchPost(id, {
    title: typeof body.title === 'string' ? body.title : undefined,
    summary: typeof body.summary === 'string' ? body.summary : body.summary === null ? null : undefined,
    code: typeof body.code === 'string' ? body.code : undefined,
    sampleCtx: typeof body.sampleCtx === 'string' ? body.sampleCtx : undefined,
    ctxKey: typeof body.ctxKey === 'string' ? body.ctxKey : undefined,
    tags: Array.isArray(body.tags) ? body.tags.filter((x): x is string => typeof x === 'string') : undefined,
    status: body.status === 'PUBLISHED' || body.status === 'DRAFT' ? body.status : undefined,
  });

  if (!next) return NextResponse.json({ message: 'not found' }, { status: 404 });
  return NextResponse.json({ post: next }, { status: 200 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { id } = await params;

  const removed = await deletePost(id);
  if (removed <= 0) {
    return NextResponse.json({ ok: false, message: 'not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, removed });
}
