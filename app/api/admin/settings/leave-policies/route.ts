import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { createSecurityAuditLog } from '@/app/lib/db/securityAudit';
import { createLeavePolicy, deleteLeavePolicy, updateLeavePolicy } from '@/app/lib/db/settingsCenter';

export const runtime = 'nodejs';

const POSITION_VALUES = ['ALL', 'STAFF', 'ASSISTANT_MANAGER', 'MANAGER', 'SENIOR_MANAGER', 'DIRECTOR'] as const;

const policySchema = z
  .object({
    id: z.string().optional(),
    position: z.enum(POSITION_VALUES),
    minYears: z.coerce.number().int().min(0).max(80),
    maxYears: z.coerce.number().int().min(0).max(80).nullable().optional(),
    grantedDays: z.coerce.number().min(0).max(99),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })
  .refine((value) => value.maxYears == null || value.maxYears >= value.minYears, {
    message: '최대 근속연수는 최소 근속연수보다 작을 수 없습니다.',
    path: ['maxYears'],
  });

async function requireHead() {
  const user = await getCurrentUser();
  if (user?.role !== 'HEAD') return null;
  return user;
}

export async function POST(req: Request) {
  const user = await requireHead();
  if (!user) return NextResponse.json({ message: 'Only HEAD can manage leave policies' }, { status: 403 });

  try {
    const parsed = policySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? '연차 정책 값을 확인해 주세요.' }, { status: 400 });
    const policy = await createLeavePolicy({
      position: parsed.data.position,
      minYears: parsed.data.minYears,
      maxYears: parsed.data.maxYears ?? null,
      grantedDays: parsed.data.grantedDays,
      effectiveFrom: parsed.data.effectiveFrom,
      effectiveTo: parsed.data.effectiveTo ?? null,
    });
    await createSecurityAuditLog({
      actorId: user.id,
      targetUserId: null,
      action: 'SETTINGS_UPDATED',
      details: { area: 'leave_policy', action: 'create', policy },
    });
    return NextResponse.json({ policy }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '연차 정책을 저장하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const user = await requireHead();
  if (!user) return NextResponse.json({ message: 'Only HEAD can manage leave policies' }, { status: 403 });

  try {
    const parsed = policySchema.extend({ id: z.string().min(1) }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? '연차 정책 값을 확인해 주세요.' }, { status: 400 });
    const policy = await updateLeavePolicy(parsed.data.id, {
      position: parsed.data.position,
      minYears: parsed.data.minYears,
      maxYears: parsed.data.maxYears ?? null,
      grantedDays: parsed.data.grantedDays,
      effectiveFrom: parsed.data.effectiveFrom,
      effectiveTo: parsed.data.effectiveTo ?? null,
    });
    await createSecurityAuditLog({
      actorId: user.id,
      targetUserId: null,
      action: 'SETTINGS_UPDATED',
      details: { area: 'leave_policy', action: 'update', policyId: parsed.data.id, policy },
    });
    return NextResponse.json({ policy }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '연차 정책을 수정하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await requireHead();
  if (!user) return NextResponse.json({ message: 'Only HEAD can manage leave policies' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ message: 'Missing leave policy id' }, { status: 400 });

  try {
    await deleteLeavePolicy(id);
    await createSecurityAuditLog({
      actorId: user.id,
      targetUserId: null,
      action: 'SETTINGS_UPDATED',
      details: { area: 'leave_policy', action: 'delete', policyId: id },
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '연차 정책을 삭제하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
