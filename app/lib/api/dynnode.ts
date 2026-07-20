import type { DynNodePost, DynNodeTemplateFile } from '../types/dynnode';

export type DynNodeListResponse = {
  items: DynNodePost[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

type DynNodeStatusFilter = 'ALL' | 'PUBLISHED' | 'DRAFT';
type ApiErrorBody = {
  message?: unknown;
};

function getErrorMessage(data: unknown, fallback: string) {
  const message = (data as ApiErrorBody | null)?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export async function getDynNodes(params?: { page?: number; pageSize?: number; q?: string; status?: DynNodeStatusFilter }): Promise<DynNodeListResponse> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 10;

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (params?.q?.trim()) qs.set('q', params.q.trim());
  if (params?.status && params.status !== 'ALL') qs.set('status', params.status);

  const res = await fetch(`/api/dynnode?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('동적노드 목록 조회에 실패했습니다.');
  return res.json();
}

export async function getDynNode(id: string): Promise<{ post: DynNodePost }> {
  const res = await fetch(`/api/dynnode/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('동적노드 조회에 실패했습니다.');
  return res.json();
}

export async function createDynNode(input: Pick<DynNodePost, 'title' | 'summary' | 'code' | 'sampleCtx' | 'ctxKey' | 'tags' | 'status'>) {
  const res = await fetch('/api/dynnode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('동적노드 생성에 실패했습니다.');
  return res.json() as Promise<{ post: DynNodePost }>;
}

export async function patchDynNode(id: string, patch: Partial<Pick<DynNodePost, 'title' | 'summary' | 'code' | 'sampleCtx' | 'ctxKey' | 'tags' | 'status'>>) {
  const res = await fetch(`/api/dynnode/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('동적노드 수정에 실패했습니다.');
  return res.json() as Promise<{ post: DynNodePost }>;
}

export async function deleteDynnode(id: string) {
  const res = await fetch(`/api/dynnode/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const data = (await res.json().catch(() => ({}))) as unknown;

  if (!res.ok) throw new Error(getErrorMessage(data, `DELETE failed (${res.status})`));
  return data as { ok: true; removed: number };
}

export async function uploadDynNodeTemplate(id: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`/api/dynnode/${encodeURIComponent(id)}/template`, {
    method: 'POST',
    body: formData,
  });
  const data = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) throw new Error(getErrorMessage(data, `template upload failed (${res.status})`));
  return data as { templateFile: DynNodeTemplateFile };
}

export async function deleteDynNodeTemplate(id: string) {
  const res = await fetch(`/api/dynnode/${encodeURIComponent(id)}/template`, { method: 'DELETE' });
  const data = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) throw new Error(getErrorMessage(data, `template delete failed (${res.status})`));
  return data as { ok: true; templateFile: DynNodeTemplateFile };
}
