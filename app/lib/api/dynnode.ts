import type { DynNodePost } from '../types/dynnode';

export type DynNodeListResponse = {
  items: DynNodePost[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

// ✅ 목록 (기존 호출부: getDynNodes()도 OK / 페이징: getDynNodes({page,pageSize})도 OK)
export async function getDynNodes(params?: { page?: number; pageSize?: number }): Promise<DynNodeListResponse> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 10;

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  const res = await fetch(`/api/dynnode?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('dynnode list fetch 실패');
  return res.json();
}

// ✅ 단건
export async function getDynNode(id: string): Promise<{ post: DynNodePost }> {
  const res = await fetch(`/api/dynnode/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('dynnode get fetch 실패');
  return res.json();
}

export async function createDynNode(input: Pick<DynNodePost, 'title' | 'summary' | 'code' | 'sampleCtx' | 'tags' | 'status'>) {
  const res = await fetch('/api/dynnode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('dynnode create 실패');
  return res.json() as Promise<{ post: DynNodePost }>;
}

export async function patchDynNode(id: string, patch: Partial<Pick<DynNodePost, 'title' | 'summary' | 'code' | 'sampleCtx' | 'tags' | 'status'>>) {
  const res = await fetch(`/api/dynnode/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('dynnode patch 실패');
  return res.json() as Promise<{ post: DynNodePost }>;
}

export async function deleteDynnode(id: string) {
  const res = await fetch(`/api/dynnode/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error((data as any)?.message || `DELETE failed (${res.status})`);
  return data as { ok: true; removed: number };
}
