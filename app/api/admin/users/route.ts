import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { getCurrentUser } from '@/app/lib/auth/session';
import { deleteUser, listUsers, resetUserPassword, updateUserControl, USER_ROLES, USER_STATUSES } from '@/app/lib/db/users';
import { createSecurityAuditLog } from '@/app/lib/db/securityAudit';

export const runtime = 'nodejs';

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(USER_STATUSES).optional(),
  role: z.enum(USER_ROLES).optional(),
  resetPassword: z.boolean().optional(),
});

const RESET_PASSWORD = 'new123!@';

function canControl(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return user?.role === 'HEAD' || user?.role === 'ADMIN';
}

function canChangeRole(user: Awaited<ReturnType<typeof getCurrentUser>>, role?: string) {
  if (!role) return true;
  if (user?.role === 'HEAD') return true;
  return role !== 'HEAD' && role !== 'ADMIN';
}

export async function GET() {
  const user = await getCurrentUser();
  if (!canControl(user)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  return NextResponse.json({ users: await listUsers() }, { status: 200 });
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
