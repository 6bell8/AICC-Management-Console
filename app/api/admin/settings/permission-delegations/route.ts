import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { getHeadedTeamIds, isGlobalAdmin } from '@/app/lib/auth/authorization';
import { getCurrentUser } from '@/app/lib/auth/session';
import { getMysqlPool } from '@/app/lib/db/mysql';
import {
  cancelPermissionDelegation,
  createPermissionDelegation,
  getPermissionDelegationById,
  PERMISSION_DELEGATION_SCOPES,
  upsertPermissionDelegationPreset,
} from '@/app/lib/db/permissionDelegations';
import { createSecurityAuditLog } from '@/app/lib/db/securityAudit';

export const runtime = 'nodejs';

const delegationSchema = z
  .object({
    delegatorUserId: z.string().trim().min(1),
    delegateeUserId: z.string().trim().min(1),
    teamId: z.string().trim().min(1),
    scope: z.enum(PERMISSION_DELEGATION_SCOPES),
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().trim().max(500).optional(),
    saveAsDefault: z.boolean().optional(),
  })
  .refine((value) => value.delegatorUserId !== value.delegateeUserId, {
    message: '위임자와 대리자는 같을 수 없습니다.',
    path: ['delegateeUserId'],
  })
  .refine((value) => value.endsAt >= value.startsAt, {
    message: '종료일은 시작일보다 빠를 수 없습니다.',
    path: ['endsAt'],
  });

async function getDelegationManager() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (isGlobalAdmin(user)) return { user, allowedTeamIds: null as string[] | null };

  const allowedTeamIds = await getHeadedTeamIds(user);
  if (allowedTeamIds.length === 0) return null;
  return { user, allowedTeamIds };
}

async function isUserInTeam(userId: string, teamId: string) {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `
      SELECT 1
      FROM employee_profiles
      WHERE user_id = ? AND team_id = ?
      LIMIT 1
    `,
    [userId, teamId],
  );
  return Boolean(rows[0]);
}

export async function POST(req: Request) {
  const manager = await getDelegationManager();
  if (!manager) return NextResponse.json({ message: '권한 위임은 관리자 또는 팀장만 등록할 수 있습니다.' }, { status: 403 });

  try {
    const parsed = delegationSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? '권한 위임 정보를 확인해 주세요.' }, { status: 400 });

    if (manager.allowedTeamIds && !manager.allowedTeamIds.includes(parsed.data.teamId)) {
      return NextResponse.json({ message: '본인이 담당하는 팀에만 권한을 위임할 수 있습니다.' }, { status: 403 });
    }

    if (manager.allowedTeamIds && parsed.data.delegatorUserId !== manager.user.id) {
      return NextResponse.json({ message: '팀장은 본인 권한만 위임할 수 있습니다.' }, { status: 403 });
    }

    if (manager.allowedTeamIds && !(await isUserInTeam(parsed.data.delegateeUserId, parsed.data.teamId))) {
      return NextResponse.json({ message: '같은 팀 구성원에게만 권한을 위임할 수 있습니다.' }, { status: 400 });
    }

    const delegation = await createPermissionDelegation({
      ...parsed.data,
      createdBy: manager.user.id,
    });

    if (parsed.data.saveAsDefault) {
      await upsertPermissionDelegationPreset({
        teamId: parsed.data.teamId,
        delegatorUserId: parsed.data.delegatorUserId,
        defaultDelegateeUserId: parsed.data.delegateeUserId,
        createdBy: manager.user.id,
      });
    }

    await createSecurityAuditLog({
      actorId: manager.user.id,
      targetUserId: parsed.data.delegateeUserId,
      action: 'SETTINGS_UPDATED',
      details: { area: 'permission_delegation', action: 'create', saveAsDefault: Boolean(parsed.data.saveAsDefault), delegation },
    });

    return NextResponse.json({ delegation }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '권한 위임을 저장하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const manager = await getDelegationManager();
  if (!manager) return NextResponse.json({ message: '권한 위임은 관리자 또는 팀장만 취소할 수 있습니다.' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ message: '권한 위임 ID가 필요합니다.' }, { status: 400 });

  try {
    const delegation = await getPermissionDelegationById(id);
    if (!delegation) return NextResponse.json({ message: '권한 위임 이력을 찾지 못했습니다.' }, { status: 404 });

    if (manager.allowedTeamIds && !manager.allowedTeamIds.includes(delegation.teamId)) {
      return NextResponse.json({ message: '본인이 담당하는 팀의 권한 위임만 취소할 수 있습니다.' }, { status: 403 });
    }

    const cancelled = await cancelPermissionDelegation({ id, cancelledBy: manager.user.id });
    if (!cancelled) return NextResponse.json({ message: '활성 권한 위임을 찾지 못했습니다.' }, { status: 404 });

    await createSecurityAuditLog({
      actorId: manager.user.id,
      targetUserId: null,
      action: 'SETTINGS_UPDATED',
      details: { area: 'permission_delegation', action: 'cancel', delegationId: id },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '권한 위임을 취소하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
