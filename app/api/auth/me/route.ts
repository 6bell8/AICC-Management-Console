import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/app/lib/auth/session';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user }, { status: 200 });
}
