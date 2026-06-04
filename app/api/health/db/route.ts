import { NextResponse } from 'next/server';

import { getMysqlPool } from '@/app/lib/db/mysql';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const pool = getMysqlPool();
    const [rows] = await pool.query('SELECT 1 AS ok');

    return NextResponse.json({ ok: true, rows }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
