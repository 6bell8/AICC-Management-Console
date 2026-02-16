import { NextResponse } from 'next/server';
import { deleteNotice, getNotice, patchNotice } from '@/app/lib/notice/store';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const post = await getNotice(id);
  if (!post) return NextResponse.json({ message: 'not found' }, { status: 404 });

  return NextResponse.json({ notice: post }, { status: 200 });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}) as any);
  const updated = await patchNotice(id, body);

  if (!updated) return NextResponse.json({ message: 'not found' }, { status: 404 });
  return NextResponse.json({ notice: updated }, { status: 200 });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const removed = await deleteNotice(id);
  if (!removed) return NextResponse.json({ message: 'not found' }, { status: 404 });

  return NextResponse.json({ ok: true, removed }, { status: 200 });
}
