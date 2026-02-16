import { NextResponse } from 'next/server';
import { DB, type AuthorGuide } from './_store';

function contains(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const pageSize = Math.max(1, Number(searchParams.get('pageSize') ?? '10'));
  const q = (searchParams.get('q') ?? '').trim();

  let items = DB;

  if (q) {
    items = items.filter((g) => contains(g.title ?? '', q) || contains(g.content ?? '', q));
  }

  items = [...items].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const start = (safePage - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  return NextResponse.json({ items: paged, total, page: safePage, pageSize, totalPages });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const title = String(body?.title ?? '').trim();
  const content = String(body?.content ?? '').trim();
  const status = (body?.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED') as AuthorGuide['status'];

  if (!title || !content) {
    return NextResponse.json({ message: 'title/content는 필수입니다.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const item: AuthorGuide = { id, title, content, status, createdAt: now, updatedAt: now };

  DB.unshift(item);

  return NextResponse.json({ authorGuide: item }, { status: 201 });
}
