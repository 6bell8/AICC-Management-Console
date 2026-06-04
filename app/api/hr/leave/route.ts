import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { createLeaveRequest, getLeaveBalanceForUser, listLeaveRequests } from '@/app/lib/db/hr';
import { REQUEST_TYPES } from '@/app/lib/types/hr';

export const runtime = 'nodejs';

const createSchema = z.object({
  requestType: z.enum(REQUEST_TYPES),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reason: z.string().max(2000).optional(),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const month = new URL(req.url).searchParams.get('month') ?? undefined;
  const [items, balance] = await Promise.all([listLeaveRequests({ user, month }), getLeaveBalanceForUser(user.id)]);
  return NextResponse.json({ items, balance }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (user.role === 'VIEWER') return NextResponse.json({ message: '게스트 권한은 신청을 등록할 수 없습니다.' }, { status: 403 });

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: '신청 정보를 확인해 주세요.' }, { status: 400 });

    const id = await createLeaveRequest({
      requester: user,
      requestType: parsed.data.requestType,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate ?? parsed.data.startDate,
      reason: parsed.data.reason,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '연차 신청을 저장하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
