import { NextResponse } from 'next/server';

import { deleteAuthorGuide, getAuthorGuide, updateAuthorGuide } from '@/app/lib/db/authorGuides';
import { requireWriteAccess } from '@/app/lib/auth/permissions';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const authorGuide = await getAuthorGuide(id);
  if (!authorGuide) return NextResponse.json({ message: 'not found' }, { status: 404 });
  return NextResponse.json({ authorGuide });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const title = body?.title != null ? String(body.title).trim() : undefined;
  const content = body?.content != null ? String(body.content).trim() : undefined;
  const status = body?.status === 'DRAFT' ? 'DRAFT' : body?.status === 'PUBLISHED' ? 'PUBLISHED' : undefined;

  if (title !== undefined && title.length === 0) return NextResponse.json({ message: 'title is required' }, { status: 400 });
  if (content !== undefined && content.length === 0) return NextResponse.json({ message: 'content is required' }, { status: 400 });

  const authorGuide = await updateAuthorGuide(id, { title, content, status });
  if (!authorGuide) return NextResponse.json({ message: 'not found' }, { status: 404 });

  return NextResponse.json({ authorGuide });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const removed = await deleteAuthorGuide(id);
  if (!removed) return NextResponse.json({ message: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true, removed: 1 });
}
