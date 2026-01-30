import { NextResponse } from 'next/server';
import { z } from 'zod';
import { campaignSchema } from '../../../lib/schemas/campaigns';
import type { CampaignUpdateFormValues } from '../../../lib/types/campaign';

type Campaign = z.infer<typeof campaignSchema>;

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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // ✅ 핵심: await

  const list = await readCampaigns();
  const found = list.find((c) => c.id === id);

  if (!found) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  return NextResponse.json(found, { status: 200 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // ✅ 핵심: await
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const input = body as CampaignUpdateFormValues;

  const list = await readCampaigns();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const updated: Campaign = campaignSchema.parse({
    ...list[idx],
    ...input,
    description: input.description ?? null,
    updatedAt: nowIso(),
  });

  const next = [...list];
  next[idx] = updated;
  await writeCampaigns(next);

  return NextResponse.json(updated, { status: 200 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 옵션 파싱 (원하신 스펙)
  const url = new URL(req.url);
  const includeDeleted = url.searchParams.get('includeDeleted') === 'true';

  const list = await readCampaigns();
  const target = list.find((c) => c.id === id);

  if (!target) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  // 제약: RUNNING 삭제 불가
  if (target.status === 'RUNNING') {
    return NextResponse.json({ message: 'RUNNING 캠페인은 삭제할 수 없습니다. 중지(PAUSED) 또는 보관(ARCHIVED) 후 삭제하세요.' }, { status: 409 });
  }

  // 하드 삭제: 리스트에서 제거
  const next = list.filter((c) => c.id !== id);
  await writeCampaigns(next);

  // includeDeleted는 “옵션을 받았다”는 표시 정도로만 반환(하드 삭제에서는 큰 의미 없음)
  return NextResponse.json({ ok: true, id, includeDeleted }, { status: 200 });
}
