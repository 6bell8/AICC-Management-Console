import type { Notice } from '../types/notice';

export type NoticeListResponse = {
  items: Notice[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getNotices(params?: { page?: number; pageSize?: number }): Promise<NoticeListResponse> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 10;
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });

  const res = await fetch(`/api/notice?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('notice list fetch 실패');
  return res.json();
}

export async function getNotice(id: string): Promise<{ notice: Notice }> {
  const res = await fetch(`/api/notice/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('notice get fetch 실패');
  return res.json();
}

export async function createNotice(input: { title: string; content: string; pinned: boolean; status: 'PUBLISHED' | 'DRAFT' }) {
  const res = await fetch('/api/notice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as any)?.message || `notice create 실패 (${res.status})`);
  }

  return data as { notice: any };
}

export async function patchNotice(id: string, patch: Partial<Pick<Notice, 'title' | 'content' | 'pinned' | 'status'>>) {
  const res = await fetch(`/api/notice/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('notice patch 실패');
  return res.json() as Promise<{ notice: Notice }>;
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
  if (!res.ok) throw new Error('notice banner fetch 실패');
  return res.json();
}
