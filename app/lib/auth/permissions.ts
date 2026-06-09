import { NextResponse } from 'next/server';

import { getCurrentUser } from './session';

export async function requireWriteAccess() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (user.role === 'VIEWER') return NextResponse.json({ message: 'Guest viewer is read-only' }, { status: 403 });
  return null;
}
