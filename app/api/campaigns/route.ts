// app/api/campaigns/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { campaignSchema } from '@/app/lib/schemas/campaigns';

type Campaign = z.infer<typeof campaignSchema>;
type StatusFilter = Campaign['status'] | 'ALL';

const querySchema = z.object({
  q: z.string().optional(),
  status: z.enum(['ALL', 'DRAFT', 'RUNNING', 'PAUSED', 'ARCHIVED']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

// 서버에서만 쓰는 파일 접근
const DATA_PATH = process.cwd() + '/data/campaigns.json';

async function readCampaigns(): Promise<Campaign[]> {
  const fs = await import('fs/promises');
  const raw = await fs.readFile(DATA_PATH, 'utf-8').catch(() => '[]');
  const parsed = z.array(campaignSchema).safeParse(JSON.parse(raw));
  if (!parsed.success) return [];
  return parsed.data;
}

async function writeCampaigns(list: Campaign[]) {
  const fs = await import('fs/promises');
  await fs.writeFile(DATA_PATH, JSON.stringify(list, null, 2), 'utf-8');
}

function nowIso() {
  return new Date().toISOString();
}

function makeNewCampaign(id: string): Campaign {
  const now = nowIso();
  // schema에 맞춰 생성
  return campaignSchema.parse({
    id,
    name: `새 캠페인(${id})`,
    description: '',
    status: 'DRAFT',
    startAt: null,
    endAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    status: (url.searchParams.get('status') ?? undefined) as StatusFilter | undefined,
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid query' }, { status: 400 });
  }

  const { q = '', status = 'ALL', page = 1, pageSize = 10 } = parsed.data;

  const list = await readCampaigns();

  const kw = q.trim().toLowerCase();
  const filtered = list
    .filter((c) => (status === 'ALL' ? true : c.status === status))
    .filter((c) => {
      if (!kw) return true;
      const name = (c.name ?? '').toLowerCase();
      const id = (c.id ?? '').toLowerCase();
      const desc = (c.description ?? '').toLowerCase();
      return name.includes(kw) || id.includes(kw) || desc.includes(kw);
    })
    // ✅ 초안(createdAt) 기준 최신순
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const start = (safePage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return NextResponse.json({ items, total, page: safePage, pageSize, totalPages }, { status: 200 });
}

export async function POST() {
  const list = await readCampaigns();

  // 단순 id 생성(충돌 가능성 낮게)
  const id = `camp_${String(Math.floor(Math.random() * 900000) + 100000)}`;
  const created = makeNewCampaign(id);

  await writeCampaigns([created, ...list]);

  return NextResponse.json(created, { status: 201 });
}
