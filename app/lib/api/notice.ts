import type { Notice } from '../types/notice';

export type NoticeListResponse = {
  items: Notice[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getNotices(
  params?: { page?: number; pageSize?: number; q?: string; status?: 'ALL' | 'PUBLISHED' | 'DRAFT'; pinned?: boolean },
  opts?: { baseUrl?: string; cookie?: string },
): Promise<NoticeListResponse> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 10;
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (params?.q?.trim()) qs.set('q', params.q.trim());
  if (params?.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params?.pinned) qs.set('pinned', 'true');

  const path = `/api/notice?${qs.toString()}`;
  const url = opts?.baseUrl ? new URL(path, opts.baseUrl).toString() : path;

  const res = await fetch(url, {
    cache: 'no-store',
    headers: opts?.cookie ? { cookie: opts.cookie } : undefined,
  });

  if (!res.ok) throw new Error(`notice list fetch failed (${res.status})`);
  return res.json();
}

export async function getNotice(id: string): Promise<{ notice: Notice }> {
  const res = await fetch(`/api/notice/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('notice get fetch failed');
  return res.json();
}

export async function createNotice(input: Pick<Notice, 'title' | 'content' | 'pinned' | 'status'> & { attachments?: Notice['attachments'] }) {
  const res = await fetch('/api/notice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || `notice create failed (${res.status})`);
  return data as { notice: Notice };
}

export async function patchNotice(id: string, patch: Partial<Pick<Notice, 'title' | 'content' | 'pinned' | 'status' | 'attachments'>>) {
  const res = await fetch(`/api/notice/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || 'notice patch failed');
  return data as { notice: Notice };
}

export async function deleteNotice(id: string) {
  const res = await fetch(`/api/notice/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || `DELETE failed (${res.status})`);
  return data as { ok: true; removed: number };
}

export async function getNoticeBanner(limit = 5): Promise<{ items: Notice[] }> {
  const qs = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`/api/notice/banner?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('notice banner fetch failed');
  return res.json();
}

export async function getPinnedCount() {
  const r = await fetch('/api/notice/pinned-count', {
    method: 'GET',
    cache: 'no-store',
  });
  if (!r.ok) throw new Error('pinned count fetch failed');
  return (await r.json()) as { count: number };
}
