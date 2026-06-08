import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { getUserByEmail, withoutPassword } from '@/app/lib/db/users';
import { setSessionCookie } from '@/app/lib/auth/session';

export const runtime = 'nodejs';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = loginSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: '이메일 또는 비밀번호를 확인해 주세요.' }, { status: 400 });

    const user = await getUserByEmail(parsed.data.email);
    if (!user) return NextResponse.json({ message: '이메일 또는 비밀번호를 확인해 주세요.' }, { status: 401 });

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) return NextResponse.json({ message: '이메일 또는 비밀번호를 확인해 주세요.' }, { status: 401 });

    if (user.status === 'PENDING') {
      return NextResponse.json({ message: '관리자 승인 대기 중입니다.' }, { status: 403 });
    }

    if (user.status === 'REJECTED') {
      return NextResponse.json({ message: '가입 신청이 반려된 계정입니다.' }, { status: 403 });
    }

    const safeUser = withoutPassword(user);
    await setSessionCookie(safeUser);
    return NextResponse.json({ user: safeUser }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to login' }, { status: 500 });
  }
}
