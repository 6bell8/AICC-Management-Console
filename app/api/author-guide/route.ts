import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { DB, type AuthorGuide } from './_store';

function contains(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function toPosInt(v: string | null, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

function getDbFilePath() {
  return path.join(process.cwd(), 'data', 'authorGuide.json');
}

function loadJsonDb(): AuthorGuide[] | null {
  try {
    const filePath = getDbFilePath();
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return parsed as AuthorGuide[];
  } catch {
    return null;
  }
}

function saveJsonDb(items: AuthorGuide[]) {
  const filePath = getDbFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf-8');
}

function findIndexById(items: AuthorGuide[], id: string) {
  return items.findIndex((x) => x.id === id);
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

  // ✅ JSON 우선 저장(파일이 있으면 파일에 추가)
  const fileDb = loadJsonDb();
  if (fileDb) {
    fileDb.unshift(item);
    saveJsonDb(fileDb);
  } else {
    // ✅ 파일이 없으면 기존 메모리 DB 사용
    DB.unshift(item);
  }

  return NextResponse.json({ authorGuide: item }, { status: 201 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const page = toPosInt(searchParams.get('page'), 1);
  const pageSize = toPosInt(searchParams.get('pageSize'), 10);
  const q = (searchParams.get('q') ?? '').trim();

  // ✅ file db 우선, 없으면 기존 메모리 DB 사용
  let items = loadJsonDb() ?? DB;

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
