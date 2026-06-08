import { NextResponse } from 'next/server';

import { setSessionCookie } from '@/app/lib/auth/session';
import { upsertGuestUser } from '@/app/lib/db/users';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const user = await upsertGuestUser();
    await setSessionCookie(user);
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to start guest session' }, { status: 500 });
  }
}
