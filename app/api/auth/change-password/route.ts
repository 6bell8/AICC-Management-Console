import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { getCurrentUser, setSessionCookie } from '@/app/lib/auth/session';
import { changeUserPassword, getUserById } from '@/app/lib/db/users';
import { createSecurityAuditLog } from '@/app/lib/db/securityAudit';

export const runtime = 'nodejs';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(req: Request) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  try {
    const parsed = changePasswordSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: '비밀번호 입력값을 확인해 주세요.' }, { status: 400 });

    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return NextResponse.json({ message: '새 비밀번호는 현재 비밀번호와 다르게 설정해 주세요.' }, { status: 400 });
    }

    const user = await getUserById(sessionUser.id);
    if (!user) return NextResponse.json({ message: '계정을 찾을 수 없습니다.' }, { status: 404 });

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) return NextResponse.json({ message: '현재 비밀번호가 올바르지 않습니다.' }, { status: 401 });

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    const updated = await changeUserPassword(user.id, passwordHash);
    if (!updated) return NextResponse.json({ message: '비밀번호 변경에 실패했습니다.' }, { status: 500 });

    await createSecurityAuditLog({
      actorId: user.id,
      targetUserId: user.id,
      action: 'PASSWORD_CHANGED',
      details: { forced: user.forcePasswordChange },
    });
    await setSessionCookie(updated);

    return NextResponse.json({ user: updated }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to change password' }, { status: 500 });
  }
}
