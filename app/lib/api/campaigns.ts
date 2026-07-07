import { z } from 'zod';
import { campaignSchema } from '../schemas/campaigns';
import type { Campaign, CampaignStatus, CampaignUpdateFormValues } from '../types/campaign';

type StatusFilter = CampaignStatus | 'ALL';

export type CampaignListResponse = {
  items: Campaign[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const campaignListResponseSchema = z.object({
  items: z.array(campaignSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

const USE_DUMMY = process.env.NEXT_PUBLIC_USE_DUMMY_CAMPAIGN === '1';

function nowIso() {
  return new Date().toISOString();
}

let DUMMY_DB: Campaign[] | null = null;

function initDummyDb() {
  if (DUMMY_DB) return;

  const base = Date.now();
  const seed = [
    { id: 'camp_001', daysAgo: 3 },
    { id: 'camp_002', daysAgo: 2 },
    { id: 'camp_003', daysAgo: 1 },
  ];

  DUMMY_DB = seed.map(({ id, daysAgo }) => {
    const timestamp = new Date(base - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    return campaignSchema.parse({
      id,
      name: `더미 캠페인 ${id}`,
      description: '상세 UI 확인용 더미 데이터입니다.',
      status: 'DRAFT',
      startAt: null,
      endAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });
}

function ensureDummy() {
  initDummyDb();
  return DUMMY_DB!;
}

function findDummyIndex(id: string) {
  return ensureDummy().findIndex((campaign) => campaign.id === id);
}

export async function getCampaigns(params?: { q?: string; status?: StatusFilter; page?: number; pageSize?: number }): Promise<CampaignListResponse> {
  if (USE_DUMMY) {
    const db = ensureDummy();
    const query = (params?.q ?? '').trim().toLowerCase();
    const status = params?.status ?? 'ALL';
    const pageSize = params?.pageSize ?? 10;
    const page = params?.page ?? 1;

    const filtered = db
      .filter((campaign) => (status === 'ALL' ? true : campaign.status === status))
      .filter((campaign) => {
        if (!query) return true;
        return [campaign.name, campaign.id, campaign.description ?? ''].some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;

    return {
      items: filtered.slice(start, start + pageSize),
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  }

  const searchParams = new URLSearchParams();
  const query = (params?.q ?? '').trim();
  if (query) searchParams.set('q', query);

  const status = params?.status ?? 'ALL';
  if (status !== 'ALL') searchParams.set('status', status);

  const page = params?.page ?? 1;
  if (page > 1) searchParams.set('page', String(page));

  const pageSize = params?.pageSize ?? 10;
  searchParams.set('pageSize', String(pageSize));

  const queryString = searchParams.toString();
  const res = await fetch(`/api/campaigns${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`캠페인 목록 조회 실패 (${res.status}) ${text}`);
  }

  const data = (await res.json()) as unknown;
  return campaignListResponseSchema.parse(data);
}

export async function getCampaign(id: string): Promise<Campaign> {
  if (USE_DUMMY) {
    const found = ensureDummy().find((campaign) => campaign.id === id);
    if (!found) throw new Error('캠페인 상세 조회 실패 (NOT_FOUND)');
    return found;
  }

  const res = await fetch(`/api/campaigns/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`캠페인 상세 조회 실패 (${res.status})`);
  const data = (await res.json()) as unknown;
  return campaignSchema.parse(data);
}

export async function patchCampaign(id: string, input: CampaignUpdateFormValues): Promise<Campaign> {
  if (USE_DUMMY) {
    const db = ensureDummy();
    const index = findDummyIndex(id);
    if (index < 0) throw new Error('캠페인 수정 실패 (NOT_FOUND)');

    const previous = db[index];
    const next = campaignSchema.parse({
      ...previous,
      ...input,
      description: input.description ?? null,
      createdAt: previous.createdAt,
      updatedAt: nowIso(),
    });

    db[index] = next;
    return next;
  }

  const res = await fetch(`/api/campaigns/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      description: input.description ?? null,
    }),
  });

  if (!res.ok) throw new Error(`캠페인 수정 실패 (${res.status})`);
  const data = (await res.json()) as unknown;
  return campaignSchema.parse(data);
}

export async function createCampaign(): Promise<Campaign> {
  if (USE_DUMMY) {
    const db = ensureDummy();
    const id = `camp_${String(Math.floor(Math.random() * 900) + 100)}`;
    const created = campaignSchema.parse({
      id,
      name: `새 캠페인 ${id}`,
      description: null,
      status: 'DRAFT',
      startAt: null,
      endAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    db.unshift(created);
    return created;
  }

  const res = await fetch('/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`캠페인 생성 실패 (${res.status}) ${text}`);
  }

  const data = (await res.json()) as unknown;
  return campaignSchema.parse(data);
}

export async function deleteCampaign(id: string, _opts?: { includeDeleted?: boolean }): Promise<void> {
  if (USE_DUMMY) {
    const db = ensureDummy();
    const index = findDummyIndex(id);
    if (index >= 0) db.splice(index, 1);
    return;
  }

  const res = await fetch(`/api/campaigns/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`캠페인 삭제 실패 (${res.status}) ${text}`);
  }
}
