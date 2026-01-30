import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Notice } from '../types/notice';

const DB_PATH = path.join(process.cwd(), 'data', 'notice.json');

async function readAll(): Promise<Notice[]> {
  try {
    const txt = await fs.readFile(DB_PATH, 'utf-8');
    const data = JSON.parse(txt);
    return Array.isArray(data) ? (data as Notice[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: Notice[]) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

const nowIso = () => new Date().toISOString();

export async function listNotices() {
  const all = await readAll();
  // 최신순 기본 정렬 (updatedAt desc)
  return all.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export async function getNotice(id: string) {
  const all = await readAll();
  return all.find((x) => x.id === id) ?? null;
}

export async function createNotice(input: Pick<Notice, 'title' | 'content' | 'pinned' | 'status'>) {
  const all = await readAll();
  const now = nowIso();

  const notice: Notice = {
    id: randomUUID(),
    title: input.title,
    content: input.content,
    pinned: !!input.pinned,
    status: input.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
    createdAt: now,
    updatedAt: now,
  };

  all.unshift(notice);
  await writeAll(all);
  return notice;
}

export async function patchNotice(id: string, patch: Partial<Pick<Notice, 'title' | 'content' | 'pinned' | 'status'>>) {
  const all = await readAll();
  const idx = all.findIndex((x) => x.id === id);
  if (idx < 0) return null;

  const cur = all[idx];
  const next: Notice = {
    ...cur,
    title: typeof patch.title === 'string' ? patch.title : cur.title,
    content: typeof patch.content === 'string' ? patch.content : cur.content,
    pinned: typeof patch.pinned === 'boolean' ? patch.pinned : cur.pinned,
    status: patch.status === 'PUBLISHED' ? 'PUBLISHED' : patch.status === 'DRAFT' ? 'DRAFT' : cur.status,
    updatedAt: nowIso(),
  };

  all[idx] = next;
  await writeAll(all);
  return next;
}

export async function deleteNotice(id: string) {
  const all = await readAll();
  const before = all.length;
  const next = all.filter((x) => x.id !== id);
  await writeAll(next);
  return before - next.length; // removed count
}
