import { NextResponse } from 'next/server';
import { z } from 'zod';

import { deleteContractDeal, listContractDeals, updateContractDealStatus, upsertContractDeal } from '@/app/lib/db/contracts';
import { CONTRACT_STATUSES } from '@/app/lib/types/contracts';
import { requireWriteAccess } from '@/app/lib/auth/permissions';

export const runtime = 'nodejs';

const contractLineItemSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  qty: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const contractDealSchema = z.object({
  id: z.string().min(1),
  status: z.enum(CONTRACT_STATUSES),
  title: z.string().min(1),
  customer: z.string().min(1),
  owner: z.string().min(1),
  closeDate: z.string(),
  notes: z.string().optional(),
  discount: z.coerce.number().nonnegative(),
  commissionRate: z.coerce.number().nonnegative(),
  items: z.array(contractLineItemSchema).min(1),
});

const statusPatchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(CONTRACT_STATUSES),
});

export async function GET() {
  try {
    return NextResponse.json(await listContractDeals(), { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to load contract deals' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  try {
    const parsed = contractDealSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: 'Invalid contract deal payload' }, { status: 400 });

    await upsertContractDeal(parsed.data);
    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to save contract deal' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  try {
    const parsed = statusPatchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: 'Invalid contract status payload' }, { status: 400 });

    await updateContractDealStatus(parsed.data.id, parsed.data.status);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to update contract status' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ message: 'Missing contract deal id' }, { status: 400 });

  try {
    await deleteContractDeal(id);
    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to delete contract deal' }, { status: 500 });
  }
}
