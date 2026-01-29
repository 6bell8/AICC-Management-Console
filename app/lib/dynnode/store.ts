import type { DynNodePost } from '../types/dynnode';

type DynNodeStore = { items: DynNodePost[] };

const DATA_PATH = process.cwd() + '/data/dynnode.json';

async function readStore(): Promise<DynNodeStore> {
  const fs = await import('fs/promises');

  const raw = await fs.readFile(DATA_PATH, 'utf-8').catch(() => '');
  const text = (raw ?? '').trim();
  if (!text) return { items: [] };

  try {
    const json = JSON.parse(text);
    if (!json || !Array.isArray(json.items)) return { items: [] };
    return { items: json.items };
  } catch {
    return { items: [] };
  }
}

async function writeStore(store: DynNodeStore) {
  const fs = await import('fs/promises');
  const path = await import('path');

  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });

  const body = JSON.stringify(store, null, 2);
  const tmp = `${DATA_PATH}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;

  await fs.writeFile(tmp, body, 'utf-8');
  try {
    await fs.rename(tmp, DATA_PATH);
  } catch (e: any) {
    // Windows에서 rename이 EPERM/EACCES로 막히는 케이스 폴백
    if (e?.code === 'EPERM' || e?.code === 'EACCES') {
      await fs.copyFile(tmp, DATA_PATH);
      await fs.rm(tmp, { force: true }).catch(() => {});
      return;
    }
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return `dn_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export async function listPosts() {
  const store = await readStore();
  // 최신순
  return [...store.items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getPost(id: string) {
  const store = await readStore();
  return store.items.find((x) => x.id === id) ?? null;
}

export async function createPost(input: {
  title: string;
  summary?: string | null;
  code: string;
  sampleCtx?: string;
  tags?: string[];
  status?: 'DRAFT' | 'PUBLISHED';
}) {
  const store = await readStore();
  const now = nowIso();

  const post: DynNodePost = {
    id: makeId(),
    title: input.title,
    summary: input.summary ?? null,
    code: input.code,
    sampleCtx: input.sampleCtx ?? '{\n  \n}\n',
    tags: input.tags ?? [],
    status: input.status ?? 'DRAFT',
    createdAt: now,
    updatedAt: now,
  };

  store.items.unshift(post);
  await writeStore(store);
  return post;
}

export async function patchPost(id: string, patch: Partial<Pick<DynNodePost, 'title' | 'summary' | 'code' | 'sampleCtx' | 'tags' | 'status'>>) {
  const store = await readStore();
  const idx = store.items.findIndex((x) => x.id === id);
  if (idx < 0) return null;

  const cur = store.items[idx];
  const next: DynNodePost = {
    ...cur,
    ...patch,
    updatedAt: nowIso(),
  };

  store.items[idx] = next;
  await writeStore(store);
  return next;
}

export async function deletePost(id: string) {
  const store = await readStore();
  const before = store.items.length;
  store.items = store.items.filter((x) => x.id !== id);
  const removed = before - store.items.length;
  if (removed > 0) await writeStore(store);
  return removed;
}
