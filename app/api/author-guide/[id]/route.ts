import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { DB, type AuthorGuide } from '../_store';

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

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // ✅ JSON 우선, 없으면 메모리 DB
  const fileDb = loadJsonDb();
  const items = fileDb ?? DB;

  const idx = findIndexById(items, id);
  if (idx < 0) return NextResponse.json({ message: 'not found' }, { status: 404 });

  return NextResponse.json({ authorGuide: items[idx] });
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

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

  // ✅ JSON이 있으면 JSON을 수정(파일 저장), 없으면 메모리 DB 수정
  const fileDb = loadJsonDb();
  const items = fileDb ?? DB;

  const idx = findIndexById(items, id);
  if (idx < 0) return NextResponse.json({ message: 'not found' }, { status: 404 });

  const prev = items[idx];
  const next: AuthorGuide = {
    ...prev,
    title: title ?? prev.title,
    content: content ?? prev.content,
    status: status ?? prev.status,
    updatedAt: new Date().toISOString(),
  };

  items[idx] = next;

  if (fileDb) {
    // ✅ file db 모드면 파일에 저장
    saveJsonDb(items);
  } else {
    // ✅ 메모리 db 모드면 DB에 반영(참조 동일하지만 명시적으로)
    DB[idx] = next;
  }

  return NextResponse.json({ authorGuide: next });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const fileDb = loadJsonDb();
  const items = fileDb ?? DB;

  const idx = findIndexById(items, id);
  if (idx < 0) return NextResponse.json({ message: 'not found' }, { status: 404 });

  items.splice(idx, 1);

  if (fileDb) {
    saveJsonDb(items);
  } else {
    DB.splice(idx, 1);
  }

  return NextResponse.json({ ok: true, removed: 1 });
}
