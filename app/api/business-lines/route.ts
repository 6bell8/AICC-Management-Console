import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireWriteAccess } from '@/app/lib/auth/permissions';
import { deleteBusinessLine, listBusinessLines, upsertBusinessLine } from '@/app/lib/db/businessLines';
import { BUSINESS_LINE_SERVICE_TYPES, BUSINESS_LINE_STATUSES } from '@/app/lib/types/businessLine';

export const runtime = 'nodejs';

const lineSchema = z.object({
  id: z.string().optional().default(''),
  jiraKey: z.string().nullable().optional().default(null),
  lineNumber: z.string().min(1),
  serviceType: z.enum(BUSINESS_LINE_SERVICE_TYPES),
  botName: z.string().min(1),
  botCode: z.string().min(1),
  requester: z.string().trim().min(1).max(100).refine(
    (value) => !/^[가-힣]{2,4}$/.test(value),
    '실명 대신 요청부서 또는 식별코드를 입력해 주세요.',
  ),
  requestedAt: z.string().min(1),
  endedAt: z.string().nullable().optional().default(null),
  regiStatus: z.enum(BUSINESS_LINE_STATUSES),
  memo: z.string().nullable().optional().default(null),
});

function toPosInt(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const result = await listBusinessLines({
    q: searchParams.get('q') ?? '',
    status: status === 'DONE' || status === 'CANCELLED' || status === 'PENDING' ? status : 'ALL',
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
    page: toPosInt(searchParams.get('page'), 1),
    pageSize: toPosInt(searchParams.get('pageSize'), 10),
  });

  return NextResponse.json(result, { status: 200 });
}

export async function POST(req: Request) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  try {
    const parsed = lineSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ message: '필수 회선 정보를 확인해 주세요.' }, { status: 400 });

    const id = await upsertBusinessLine(parsed.data);
    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: '사업용 회선 정보를 저장하지 못했습니다.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ message: 'Missing business line id' }, { status: 400 });

  try {
    const deleted = await deleteBusinessLine(id);
    if (!deleted) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: '사업용 회선 정보를 삭제하지 못했습니다.' }, { status: 500 });
  }
}
