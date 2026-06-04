import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { createSignupUser, getUserByEmail } from '@/app/lib/db/users';

export const runtime = 'nodejs';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
});

export async function POST(req: Request) {
  try {
    const parsed = signupSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: 'Invalid signup payload' }, { status: 400 });

    const email = parsed.data.email.trim().toLowerCase();
    const exists = await getUserByEmail(email);
    if (exists) return NextResponse.json({ message: '이미 등록된 이메일입니다.' }, { status: 409 });

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await createSignupUser({
      email,
      passwordHash,
      name: parsed.data.name,
    });

    return NextResponse.json({ user, message: '가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.' }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to create signup request' }, { status: 500 });
  }
}
