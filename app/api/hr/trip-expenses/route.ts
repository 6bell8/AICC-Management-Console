import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { createTripExpenseRequest, listEligibleBusinessTrips, listTripExpenseRequests, settleTripExpenseRequest } from '@/app/lib/db/tripExpenses';
import { TRANSPORT_TYPES, TRIP_SCOPES } from '@/app/lib/types/tripExpense';

export const runtime = 'nodejs';

const createSchema = z.object({
  businessTripRequestId: z.string().min(1),
  origin: z.string().trim().min(1).max(150),
  destination: z.string().trim().min(1).max(150),
  tripScope: z.enum(TRIP_SCOPES),
  transportType: z.enum(TRANSPORT_TYPES),
  trainFareAmount: z.coerce.number().min(0).default(0),
  carDepreciationAmount: z.coerce.number().min(0).default(0),
  otherAmount: z.coerce.number().min(0).default(0),
  lodgingNights: z.coerce.number().int().min(0).default(0),
  memo: z.string().max(2000).optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  action: z.literal('SETTLE'),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const [eligibleTrips, items] = await Promise.all([listEligibleBusinessTrips(user), listTripExpenseRequests(user)]);
  return NextResponse.json({ eligibleTrips, items }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (user.role === 'VIEWER') return NextResponse.json({ message: '게스트 권한은 출장여비 신청을 등록할 수 없습니다.' }, { status: 403 });

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: '출장여비 신청 정보를 확인해 주세요.' }, { status: 400 });

    const id = await createTripExpenseRequest({ user, ...parsed.data });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '출장여비 신청을 저장하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: '출장여비 처리 정보를 확인해 주세요.' }, { status: 400 });

    await settleTripExpenseRequest({ user, id: parsed.data.id });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '출장여비 정산 처리에 실패했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
