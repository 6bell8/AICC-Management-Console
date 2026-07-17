import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { createComment, listComments } from '@/app/lib/comments/store';
import { COMMENT_TARGET_TYPES } from '@/app/lib/types/comments';

export const runtime = 'nodejs';

const targetSchema = z.object({
  targetType: z.enum(COMMENT_TARGET_TYPES),
  targetId: z.string().trim().min(1).max(80),
});

const createSchema = targetSchema.extend({
  content: z.string().trim().min(1).max(2000),
  parentId: z.string().trim().min(1).max(36).nullable().optional(),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  const searchParams = new URL(req.url).searchParams;
  const parsed = targetSchema.safeParse({
    targetType: searchParams.get('targetType'),
    targetId: searchParams.get('targetId'),
  });

  if (!parsed.success) return NextResponse.json({ message: '댓글 대상을 확인해 주세요.' }, { status: 400 });

  const items = await listComments({ ...parsed.data, user });
  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  if (user.role === 'VIEWER') return NextResponse.json({ message: '댓글 작성 권한이 없습니다.' }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ message: '댓글 내용을 확인해 주세요.' }, { status: 400 });

  const comment = await createComment({ ...parsed.data, user });
  return NextResponse.json({ comment }, { status: 201 });
}
