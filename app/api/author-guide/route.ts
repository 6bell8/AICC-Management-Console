import { NextResponse } from 'next/server';

import { createAuthorGuide, listAuthorGuides } from '@/app/lib/db/authorGuides';
import { requireWriteAccess } from '@/app/lib/auth/permissions';

export const runtime = 'nodejs';

function toPosInt(v: string | null, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

export async function POST(req: Request) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? '').trim();
  const content = String(body?.content ?? '').trim();
  const status = body?.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED';

  if (!title || !content) {
    return NextResponse.json({ message: 'title/content is required' }, { status: 400 });
  }

  const authorGuide = await createAuthorGuide({ title, content, status });
  return NextResponse.json({ authorGuide }, { status: 201 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const result = await listAuthorGuides({
    page: toPosInt(searchParams.get('page'), 1),
    pageSize: toPosInt(searchParams.get('pageSize'), 10),
    q: (searchParams.get('q') ?? '').trim(),
  });

  return NextResponse.json(result);
}
