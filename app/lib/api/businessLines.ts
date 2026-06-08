import type { BusinessLine } from '../types/businessLine';

export type BusinessLineListResponse = {
  items: BusinessLine[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getBusinessLines(params: {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<BusinessLineListResponse> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  qs.set('page', String(params.page ?? 1));
  qs.set('pageSize', String(params.pageSize ?? 10));

  const res = await fetch(`/api/business-lines?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || '사업용 회선 목록을 불러오지 못했습니다.');
  }
  return res.json();
}

export async function saveBusinessLine(line: BusinessLine) {
  const res = await fetch('/api/business-lines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(line),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || '사업용 회선 정보를 저장하지 못했습니다.');
  }
}

export async function deleteBusinessLine(id: string) {
  const res = await fetch(`/api/business-lines?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || '사업용 회선 정보를 삭제하지 못했습니다.');
  }
}
