import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { listOrganizationSnapshot, updateOrganizationRootName } from '@/app/lib/db/erp';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(await listOrganizationSnapshot(), { status: 200 });
}

const patchSchema = z.object({
  rootName: z.string().trim().min(1).max(100),
});

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== 'HEAD') {
    return NextResponse.json({ message: 'Only HEAD can update organization settings' }, { status: 403 });
  }

  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: 'ROOT명을 확인해 주세요.' }, { status: 400 });
    return NextResponse.json(await updateOrganizationRootName(parsed.data.rootName), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '조직 설정을 저장하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
