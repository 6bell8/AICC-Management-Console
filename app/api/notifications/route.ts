import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { getNotificationCounts, listNotifications, markAllNotificationsRead, markNotificationRead } from '@/app/lib/db/hr';

export const runtime = 'nodejs';

const readSchema = z.object({
  id: z.string().min(1).optional(),
  all: z.boolean().optional(),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const mode = new URL(req.url).searchParams.get('mode');
  if (mode === 'counts') {
    const counts = await getNotificationCounts(user);
    return NextResponse.json(counts, { status: 200 });
  }

  const items = await listNotifications(user.id);
  return NextResponse.json({ items }, { status: 200 });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const parsed = readSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: '알림 정보를 확인해 주세요.' }, { status: 400 });
  if (parsed.data.all) {
    await markAllNotificationsRead(user.id);
  } else if (parsed.data.id) {
    await markNotificationRead(user.id, parsed.data.id);
  } else {
    return NextResponse.json({ message: '알림 정보를 확인해 주세요.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
