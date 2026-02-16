import { NextResponse } from 'next/server';
import { DB, type AuthorGuide } from '../_store';

function findIndexById(id: string) {
  return DB.findIndex((x) => x.id === id);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const idx = findIndexById(id);
  if (idx < 0) return NextResponse.json({ message: 'not found' }, { status: 404 });

  return NextResponse.json({ authorGuide: DB[idx] });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const idx = findIndexById(id);
  if (idx < 0) return NextResponse.json({ message: 'not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const title = body?.title != null ? String(body.title).trim() : undefined;
  const content = body?.content != null ? String(body.content).trim() : undefined;
  const status = body?.status != null ? (body.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED') : undefined;

  if (title !== undefined && title.length === 0) {
    return NextResponse.json({ message: 'title은 비울 수 없습니다.' }, { status: 400 });
  }
  if (content !== undefined && content.length === 0) {
    return NextResponse.json({ message: 'content는 비울 수 없습니다.' }, { status: 400 });
  }

  const prev = DB[idx];
  const next: AuthorGuide = {
    ...prev,
    title: title ?? prev.title,
    content: content ?? prev.content,
    status: status ?? prev.status,
    updatedAt: new Date().toISOString(),
  };

  DB[idx] = next;

  return NextResponse.json({ authorGuide: next });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const idx = findIndexById(id);
  if (idx < 0) return NextResponse.json({ message: 'not found' }, { status: 404 });

  DB.splice(idx, 1);
  return NextResponse.json({ ok: true, removed: 1 });
}
