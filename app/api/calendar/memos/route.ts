import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { createCalendarMemo, listCalendarMemos } from '@/app/lib/db/calendar';

export const runtime = 'nodejs';

const scopeSchema = z.enum(['PERSONAL', 'TEAM']);

const createSchema = z.object({
  scope: scopeSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  text: z.string().trim().min(1).max(1000),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const scope = scopeSchema.safeParse(url.searchParams.get('scope') ?? 'PERSONAL');
  const month = url.searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  if (!scope.success || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ message: '캘린더 메모 조회 조건을 확인해 주세요.' }, { status: 400 });
  }

  const items = await listCalendarMemos({ user, scope: scope.data, month });
  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (user.role === 'VIEWER') return NextResponse.json({ message: '게스트 권한은 메모를 등록할 수 없습니다.' }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: '캘린더 메모 내용을 확인해 주세요.' }, { status: 400 });

  const id = await createCalendarMemo({ user, ...parsed.data });
  return NextResponse.json({ id }, { status: 201 });
}
