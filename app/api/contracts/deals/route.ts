import { NextResponse } from 'next/server';
import contracts from '@/data/contracts.json';

export async function GET() {
  return NextResponse.json(contracts);
}
