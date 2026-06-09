import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/app/lib/auth/session';
import { getDashboardErpSummary } from '@/app/lib/db/erp';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(await getDashboardErpSummary(user), { status: 200 });
}
