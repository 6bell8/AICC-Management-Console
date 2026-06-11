import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import {
  cancelRoomReservation,
  createRoomReservation,
  createRoomResource,
  deleteRoomResource,
  listRoomReservationSnapshot,
} from '@/app/lib/db/roomReservations';
import { ROOM_RESOURCE_TYPES } from '@/app/lib/types/roomReservation';

export const runtime = 'nodejs';

const resourceSchema = z.object({
  action: z.literal('createResource'),
  name: z.string().trim().min(1).max(100),
  type: z.enum(ROOM_RESOURCE_TYPES),
  location: z.string().trim().max(120).optional().nullable(),
  capacity: z.coerce.number().int().positive().max(999),
  description: z.string().trim().max(1000).optional().nullable(),
});

const reservationSchema = z.object({
  action: z.literal('createReservation'),
  resourceId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  purpose: z.string().trim().max(1000).optional().nullable(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  return NextResponse.json(
    await listRoomReservationSnapshot({
      date: url.searchParams.get('date') ?? undefined,
      startDate: url.searchParams.get('startDate') ?? undefined,
      endDate: url.searchParams.get('endDate') ?? undefined,
    }),
    { status: 200 },
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = body?.action;

  try {
    if (action === 'createResource') {
      if (user.role !== 'HEAD') return NextResponse.json({ message: '공간 등록은 HEAD 권한만 가능합니다.' }, { status: 403 });
      const parsed = resourceSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ message: '공간 정보를 확인해 주세요.' }, { status: 400 });
      const id = await createRoomResource(parsed.data);
      return NextResponse.json({ id }, { status: 201 });
    }

    if (action === 'createReservation') {
      if (user.role === 'VIEWER') return NextResponse.json({ message: '게스트 권한은 예약을 등록할 수 없습니다.' }, { status: 403 });
      const parsed = reservationSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ message: '예약 정보를 확인해 주세요.' }, { status: 400 });
      const id = await createRoomReservation({ user, ...parsed.data });
      return NextResponse.json({ id }, { status: 201 });
    }

    return NextResponse.json({ message: '요청 작업을 확인해 주세요.' }, { status: 400 });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : '예약 정보를 저장하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ message: '삭제 대상을 확인해 주세요.' }, { status: 400 });

  try {
    if (type === 'resource') {
      if (user.role !== 'HEAD') return NextResponse.json({ message: '공간 삭제는 HEAD 권한만 가능합니다.' }, { status: 403 });
      const deleted = await deleteRoomResource(id);
      if (!deleted) return NextResponse.json({ message: '공간을 찾을 수 없습니다.' }, { status: 404 });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (type === 'reservation') {
      if (user.role === 'VIEWER') return NextResponse.json({ message: '게스트 권한은 예약을 취소할 수 없습니다.' }, { status: 403 });
      const deleted = await cancelRoomReservation({ id, user });
      if (!deleted) return NextResponse.json({ message: '예약을 찾을 수 없거나 취소할 권한이 없습니다.' }, { status: 404 });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json({ message: '삭제 유형을 확인해 주세요.' }, { status: 400 });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : '삭제 처리에 실패했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
