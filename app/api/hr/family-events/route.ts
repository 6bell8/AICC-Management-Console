import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { createFamilyEventRequest, getFamilyEventReviewScope, listFamilyEventRequests, updateFamilyEventStatus } from '@/app/lib/db/familyEvents';
import { FAMILY_EVENT_STATUSES, FAMILY_EVENT_TYPES } from '@/app/lib/types/familyEvent';

export const runtime = 'nodejs';

const createSchema = z.object({
  eventType: z.enum(FAMILY_EVENT_TYPES),
  relation: z.string().trim().max(80).default(''),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: z.string().trim().max(255).optional(),
  note: z.string().trim().max(2000).optional(),
  wreathRequired: z.boolean().optional(),
});

const statusSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(['CONFIRMED', 'COMPLETED', 'REJECTED']),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const rawStatus = new URL(req.url).searchParams.get('status') || 'ALL';
  const parsedStatus = z.enum([...FAMILY_EVENT_STATUSES, 'ALL'] as const).safeParse(rawStatus);
  const [items, reviewScope] = await Promise.all([
    listFamilyEventRequests({ user, status: parsedStatus.success ? parsedStatus.data : 'ALL' }),
    getFamilyEventReviewScope(user),
  ]);
  return NextResponse.json({ items, canReview: reviewScope.canReview, canCreate: reviewScope.canReview }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const reviewScope = await getFamilyEventReviewScope(user);
  if (!reviewScope.canReview) return NextResponse.json({ message: '경조사 등록은 팀장/관리자/인사팀만 가능합니다.' }, { status: 403 });

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: '경조사 신청 정보를 확인해 주세요.' }, { status: 400 });
    const id = await createFamilyEventRequest({ requester: user, ...parsed.data });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '경조사 신청을 저장하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = statusSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: '처리 상태를 확인해 주세요.' }, { status: 400 });
    const updated = await updateFamilyEventStatus({ user, id: parsed.data.id, status: parsed.data.status });
    if (!updated) return NextResponse.json({ message: '경조사 신청을 찾지 못했거나 처리 권한이 없습니다.' }, { status: 404 });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '경조사 신청 상태를 변경하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
