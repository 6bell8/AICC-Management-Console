import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { decideApproval, listApprovalItems } from '@/app/lib/db/hr';

export const runtime = 'nodejs';

const decisionSchema = z.object({
  stepId: z.string().min(1),
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(1000).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (user.role === 'VIEWER') return NextResponse.json({ items: [] }, { status: 200 });

  const items = await listApprovalItems(user);
  return NextResponse.json({ items }, { status: 200 });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (user.role === 'VIEWER') return NextResponse.json({ message: '결재 권한이 없습니다.' }, { status: 403 });

  try {
    const parsed = decisionSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: '결재 처리 정보를 확인해 주세요.' }, { status: 400 });
    await decideApproval({ user, ...parsed.data });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '결재를 처리하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
