import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { listEmployeeProfiles, upsertEmployeeProfile } from '@/app/lib/db/hr';
import { EMPLOYEE_POSITIONS, EMPLOYMENT_TYPES } from '@/app/lib/types/hr';

export const runtime = 'nodejs';

const profileSchema = z.object({
  userId: z.string().min(1),
  teamId: z.string().nullable().optional(),
  position: z.enum(EMPLOYEE_POSITIONS),
  employmentType: z.enum(EMPLOYMENT_TYPES).default('P'),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  yearsOfService: z.number().int().min(0).max(80),
});

function canControl(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return user?.role === 'HEAD' || user?.role === 'ADMIN';
}

export async function GET() {
  const user = await getCurrentUser();
  if (!canControl(user)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ profiles: await listEmployeeProfiles() }, { status: 200 });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!canControl(user)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const parsed = profileSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: 'HR 프로필 정보를 확인해 주세요.' }, { status: 400 });
    await upsertEmployeeProfile(parsed.data);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'HR 프로필을 저장하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
