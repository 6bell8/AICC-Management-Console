import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { getCurrentUser } from '@/app/lib/auth/session';
import { isGlobalAdmin } from '@/app/lib/auth/authorization';
import { createManagedUser, deleteUser, getNextManagedLoginId, listUsers, listUsersPage, resetUserPassword, updateUserControl, USER_ROLES, USER_STATUSES } from '@/app/lib/db/users';
import { createSecurityAuditLog } from '@/app/lib/db/securityAudit';

export const runtime = 'nodejs';

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(USER_STATUSES).optional(),
  role: z.enum(USER_ROLES).optional(),
  resetPassword: z.boolean().optional(),
});

const createSchema = z.object({
  loginId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  role: z.enum(USER_ROLES).default('OPERATOR'),
});

const RESET_PASSWORD = 'new123!@';

function canControl(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return isGlobalAdmin(user);
}

function canChangeRole(user: Awaited<ReturnType<typeof getCurrentUser>>, role?: string) {
  if (!role) return true;
  if (user?.role === 'HEAD') return true;
  return role !== 'HEAD' && role !== 'ADMIN';
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!canControl(user)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const page = Number(url.searchParams.get('page') || 0);
  if (page > 0) {
    const pageSize = Number(url.searchParams.get('pageSize') || 10);
    const search = url.searchParams.get('search') || undefined;
    const status = (url.searchParams.get('status') || 'ALL') as (typeof USER_STATUSES)[number] | 'ALL';
    const role = (url.searchParams.get('role') || 'ALL') as (typeof USER_ROLES)[number] | 'ALL';
    const teamId = url.searchParams.get('teamId') || 'ALL';
    const result = await listUsersPage({ page, pageSize, search, status, role, teamId });
    return NextResponse.json({ ...result, nextLoginId: await getNextManagedLoginId() }, { status: 200 });
  }

  return NextResponse.json({ users: await listUsers(), nextLoginId: await getNextManagedLoginId() }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!canControl(user)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: '계정 생성 정보를 확인해 주세요.' }, { status: 400 });
    if (!canChangeRole(user, parsed.data.role)) return NextResponse.json({ message: 'Only HEAD can assign admin roles' }, { status: 403 });
    if (parsed.data.role === 'HEAD') return NextResponse.json({ message: 'HEAD 계정은 생성할 수 없습니다.' }, { status: 403 });

    const passwordHash = await bcrypt.hash(RESET_PASSWORD, 12);
    const created = await createManagedUser({
      loginId: parsed.data.loginId,
      name: parsed.data.name,
      role: parsed.data.role,
      passwordHash,
      approvedBy: user!.id,
    });
    await createSecurityAuditLog({
      actorId: user!.id,
      targetUserId: created.id,
      action: 'USER_CREATED',
      details: { role: created.role, defaultPassword: RESET_PASSWORD, forcePasswordChange: true },
    });
    return NextResponse.json({ user: created, nextLoginId: await getNextManagedLoginId() }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '계정을 생성하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!canControl(user)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: 'Invalid user control payload' }, { status: 400 });
    if (parsed.data.resetPassword) {
      if (user?.role !== 'HEAD') return NextResponse.json({ message: 'Only HEAD can reset passwords' }, { status: 403 });
      const passwordHash = await bcrypt.hash(RESET_PASSWORD, 12);
      const updated = await resetUserPassword(parsed.data.id, passwordHash);
      if (!updated) return NextResponse.json({ message: 'Not found' }, { status: 404 });
      await createSecurityAuditLog({
        actorId: user.id,
        targetUserId: updated.id,
        action: 'PASSWORD_RESET',
        details: { forcePasswordChange: true },
      });
      return NextResponse.json({ user: updated }, { status: 200 });
    }
    if (!canChangeRole(user, parsed.data.role)) return NextResponse.json({ message: 'Only HEAD can assign admin roles' }, { status: 403 });

    const updated = await updateUserControl(parsed.data.id, {
      status: parsed.data.status,
      role: parsed.data.role,
      approvedBy: user!.id,
    });

    if (!updated) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    return NextResponse.json({ user: updated }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update user';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== 'HEAD') return NextResponse.json({ message: 'Only HEAD can delete users' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ message: 'Missing user id' }, { status: 400 });

  try {
    const result = await deleteUser(id);
    if (!result.deleted) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete user';
    return NextResponse.json({ message }, { status: 500 });
  }
}
