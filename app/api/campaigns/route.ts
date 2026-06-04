import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createCampaign, listCampaigns, type CampaignStatusFilter } from '@/app/lib/db/campaigns';
import { requireWriteAccess } from '@/app/lib/auth/permissions';

export const runtime = 'nodejs';

const querySchema = z.object({
  q: z.string().optional(),
  status: z.enum(['ALL', 'DRAFT', 'RUNNING', 'PAUSED', 'ARCHIVED']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    status: (url.searchParams.get('status') ?? undefined) as CampaignStatusFilter | undefined,
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid query' }, { status: 400 });
  }

  try {
    const result = await listCampaigns(parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to load campaigns' }, { status: 500 });
  }
}

export async function POST() {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  try {
    const campaign = await createCampaign();
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to create campaign' }, { status: 500 });
  }
}
