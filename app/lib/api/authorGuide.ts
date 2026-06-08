import type { AuthorGuide } from '../types/authorGuide';

export type AuthorGuideListResponse = {
  items: AuthorGuide[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getAuthorGuides(
  params?: { page?: number; pageSize?: number; q?: string },
  opts?: { baseUrl?: string; cookie?: string },
): Promise<AuthorGuideListResponse> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 10;
  const q = params?.q?.trim() ?? '';

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (q) qs.set('q', q);

  const path = `/api/author-guide?${qs.toString()}`;
  const url = opts?.baseUrl ? new URL(path, opts.baseUrl).toString() : path;

  const res = await fetch(url, {
    cache: 'no-store',
    headers: opts?.cookie ? { cookie: opts.cookie } : undefined,
  });

  if (!res.ok) {
    throw new Error(`author-guide list fetch 실패 (${res.status})`);
  }

  return (await res.json()) as AuthorGuideListResponse;
}

export async function getAuthorGuide(id: string): Promise<{ authorGuide: AuthorGuide }> {
  const res = await fetch(`/api/author-guide/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('author-guide get fetch 실패');
  return res.json();
}

export async function createAuthorGuide(input: { title: string; content: string; status: 'PUBLISHED' | 'DRAFT' }) {
  const res = await fetch('/api/author-guide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as any)?.message || `author-guide create 실패 (${res.status})`);
  }

  return data as { authorGuide: any };
}

// notice가 PATCH를 쓰니 동일하게 PATCH로 맞춤
export async function patchAuthorGuide(id: string, patch: Partial<Pick<AuthorGuide, 'title' | 'content' | 'status'>>) {
  const res = await fetch(`/api/author-guide/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as any)?.message || `author-guide patch 실패 (${res.status})`);
  }

  return data as { authorGuide: AuthorGuide };
}

export async function deleteAuthorGuide(id: string) {
  const res = await fetch(`/api/author-guide/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || `DELETE failed (${res.status})`);
  return data as { ok: true; removed: number };
}
