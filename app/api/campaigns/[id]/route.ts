import { NextResponse } from 'next/server';

import { deleteCampaign, getCampaignById, updateCampaign } from '@/app/lib/db/campaigns';
import { campaignUpdateSchema } from '@/app/lib/schemas/campaigns';
import { requireWriteAccess } from '@/app/lib/auth/permissions';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const campaign = await getCampaignById(id);
    if (!campaign) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    return NextResponse.json(campaign, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to load campaign' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = campaignUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid campaign payload' }, { status: 400 });
  }

  try {
    const campaign = await updateCampaign(id, parsed.data);
    if (!campaign) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    return NextResponse.json(campaign, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to update campaign' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { id } = await params;

  try {
    const result = await deleteCampaign(id);
    if (result.blocked) {
      return NextResponse.json({ message: 'RUNNING campaigns cannot be deleted' }, { status: 409 });
    }
    if (!result.deleted) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to delete campaign' }, { status: 500 });
  }
}
