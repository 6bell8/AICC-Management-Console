import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { createTeam, deleteTeam, listTeams, updateTeam } from '@/app/lib/db/hr';

export const runtime = 'nodejs';

const teamSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  headUserId: z.string().nullable().optional(),
});

async function requireHead() {
  const user = await getCurrentUser();
  if (user?.role !== 'HEAD') return null;
  return user;
}

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== 'HEAD' && user?.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ teams: await listTeams() }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await requireHead();
  if (!user) return NextResponse.json({ message: 'Only HEAD can manage teams' }, { status: 403 });

  try {
    const parsed = teamSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: '팀 정보를 확인해 주세요.' }, { status: 400 });
    const id = await createTeam({ name: parsed.data.name, headUserId: parsed.data.headUserId });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '팀을 저장하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const user = await requireHead();
  if (!user) return NextResponse.json({ message: 'Only HEAD can manage teams' }, { status: 403 });

  try {
    const parsed = teamSchema.extend({ id: z.string().min(1) }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: '팀 정보를 확인해 주세요.' }, { status: 400 });
    await updateTeam({ id: parsed.data.id, name: parsed.data.name, headUserId: parsed.data.headUserId });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '팀을 수정하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await requireHead();
  if (!user) return NextResponse.json({ message: 'Only HEAD can manage teams' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ message: 'Missing team id' }, { status: 400 });

  try {
    await deleteTeam(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '팀을 삭제하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
