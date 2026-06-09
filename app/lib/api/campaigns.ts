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

// ✅ 서버 응답 검증(안전망)
const campaignListResponseSchema = z.object({
  items: z.array(campaignSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

// ✅ .env.local 로 제어 (개발 중에만 1)
const USE_DUMMY = process.env.NEXT_PUBLIC_USE_DUMMY_CAMPAIGN === '1';

function nowIso() {
  return new Date().toISOString();
}

/**
 * ✅ 더미 저장소 (in-memory)
 * - makeDummyCampaign처럼 매 호출마다 now를 찍지 않고,
 * - 한번 생성한 뒤 CRUD가 같은 배열만 보도록 고정합니다.
 */
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
    const t = new Date(base - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    return campaignSchema.parse({
      id,
      name: `더미 캠페인(${id})`,
      description: '상세 UI 확인용 더미 데이터입니다.',
      status: 'DRAFT',
      startAt: null,
      endAt: null,
      createdAt: t,
      updatedAt: t,
    });
  });
}

function ensureDummy() {
  initDummyDb();
  return DUMMY_DB!;
}

function findDummyIndex(id: string) {
  const db = ensureDummy();
  return db.findIndex((c) => c.id === id);
}

/**
 * ✅ A안: 서버 필터/검색/페이지네이션 기반
 * GET /api/campaigns?q=&status=&page=&pageSize=* -> { items, total, page, pageSize, totalPages }
 */
export async function getCampaigns(params?: { q?: string; status?: StatusFilter; page?: number; pageSize?: number }): Promise<CampaignListResponse> {
  if (USE_DUMMY) {
    const db = ensureDummy();
    const q = (params?.q ?? '').trim().toLowerCase();
    const status = params?.status ?? 'ALL';
    const pageSize = params?.pageSize ?? 10;
    const page = params?.page ?? 1;

    const filtered = db
      .filter((c) => (status === 'ALL' ? true : c.status === status))
      .filter((c) => {
        if (!q) return true;
        const name = (c.name ?? '').toLowerCase();
        const id = (c.id ?? '').toLowerCase();
        const desc = (c.description ?? '').toLowerCase();
        return name.includes(q) || id.includes(q) || desc.includes(q);
      })
      // ✅ 초안 발생일(createdAt) 기준 최신순
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);

    const start = (safePage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return { items, total, page: safePage, pageSize, totalPages };
  }

  // ===== 실서버 모드 =====
  const sp = new URLSearchParams();
  const q = (params?.q ?? '').trim();
  if (q) sp.set('q', q);

  const status = params?.status ?? 'ALL';
  if (status !== 'ALL') sp.set('status', status);

  const page = params?.page ?? 1;
  if (page > 1) sp.set('page', String(page));

  const pageSize = params?.pageSize ?? 10;
  sp.set('pageSize', String(pageSize));

  const qs = sp.toString();

  const res = await fetch(`/api/campaigns${qs ? `?${qs}` : ''}`, {
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
    const db = ensureDummy();
    const found = db.find((c) => c.id === id);
    if (!found) throw new Error(`캠페인 상세 조회 실패 (NOT_FOUND)`);
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
    const idx = findDummyIndex(id);
    if (idx < 0) throw new Error(`캠페인 수정 실패 (NOT_FOUND)`);

    const prev = db[idx];
    const next = campaignSchema.parse({
      ...prev,
      ...input,
      description: input.description ?? null,
      createdAt: prev.createdAt, // ✅ 생성일 유지
      updatedAt: nowIso(), // ✅ 수정일 갱신
    });

    db[idx] = next;
    return next;
  }

  const payload = {
    ...input,
    description: input.description ?? null,
  };

  const res = await fetch(`/api/campaigns/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`캠페인 수정 실패 (${res.status})`);
  const data = (await res.json()) as unknown;
  return campaignSchema.parse(data);
}

export async function createCampaign(): Promise<Campaign> {
  if (USE_DUMMY) {
    const db = ensureDummy();
    const id = `camp_${String(Math.floor(Math.random() * 900) + 100)}`;
    const now = nowIso();

    const created = campaignSchema.parse({
      id,
      name: `새 캠페인(${id})`,
      description: null,
      status: 'DRAFT',
      startAt: null,
      endAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // ✅ 생성된 캠페인이 목록에 실제로 들어가도록 저장
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
    const idx = findDummyIndex(id);
    if (idx >= 0) db.splice(idx, 1);
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
