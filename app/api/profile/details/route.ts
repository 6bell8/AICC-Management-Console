import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { getEmployeeProfileDetails, upsertEmployeeProfileDetails } from '@/app/lib/db/profileDetails';

export const runtime = 'nodejs';

const profileDetailsSchema = z.object({
  displayName: z.string().max(100).default(''),
  address: z.string().max(255).default(''),
  education: z.string().max(2000).default(''),
  awards: z.string().max(2000).default(''),
  certifications: z.string().max(2000).default(''),
  photoUrl: z.string().max(1_200_000).default(''),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({ profile: await getEmployeeProfileDetails(user.id) }, { status: 200 });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = profileDetailsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ message: '프로필 입력값을 확인해 주세요.' }, { status: 400 });
    }

    const profile = await upsertEmployeeProfileDetails({
      userId: user.id,
      ...parsed.data,
    });
    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error('Failed to update profile details', error);
    return NextResponse.json({ message: '프로필을 저장하지 못했습니다.' }, { status: 500 });
  }
}
