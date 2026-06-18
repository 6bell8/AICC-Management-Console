import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { createSecurityAuditLog } from '@/app/lib/db/securityAudit';
import { deleteOrganizationSeal, updateOrganizationSeal } from '@/app/lib/db/erp';

export const runtime = 'nodejs';

const sealSchema = z.object({
  imageUrl: z.string().min(1).max(1_200_000),
  fileName: z.string().trim().min(1).max(255),
  storageKey: z.string().trim().max(255).nullable().optional(),
});

async function requireHead() {
  const user = await getCurrentUser();
  if (user?.role !== 'HEAD') return null;
  return user;
}

export async function PATCH(req: Request) {
  const user = await requireHead();
  if (!user) return NextResponse.json({ message: 'Only HEAD can manage document seal' }, { status: 403 });

  try {
    const parsed = sealSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: '전자직인 이미지와 파일명을 확인해 주세요.' }, { status: 400 });

    const seal = await updateOrganizationSeal({
      imageUrl: parsed.data.imageUrl,
      fileName: parsed.data.fileName,
      storageKey: parsed.data.storageKey ?? null,
    });
    await createSecurityAuditLog({
      actorId: user.id,
      targetUserId: null,
      action: 'SETTINGS_UPDATED',
      details: { area: 'document_seal', action: 'update', fileName: seal.sealFileName, storageKey: seal.sealStorageKey || null },
    });
    return NextResponse.json({ seal }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '전자직인을 저장하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await requireHead();
  if (!user) return NextResponse.json({ message: 'Only HEAD can manage document seal' }, { status: 403 });

  try {
    const seal = await deleteOrganizationSeal();
    await createSecurityAuditLog({
      actorId: user.id,
      targetUserId: null,
      action: 'SETTINGS_UPDATED',
      details: { area: 'document_seal', action: 'delete' },
    });
    return NextResponse.json({ seal }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '전자직인을 삭제하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
