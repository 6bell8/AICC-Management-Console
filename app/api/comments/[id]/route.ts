import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/app/lib/auth/session';
import { deleteComment } from '@/app/lib/comments/store';

export const runtime = 'nodejs';

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  const { id } = await context.params;
  const result = await deleteComment({ id, user });
  if (result.forbidden) return NextResponse.json({ message: '댓글 삭제 권한이 없습니다.' }, { status: 403 });
  if (!result.deleted) return NextResponse.json({ message: '댓글을 찾을 수 없습니다.' }, { status: 404 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
