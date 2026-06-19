import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { verifyKakaoLinkCode } from '@/app/lib/db/kakao';
import { createSecurityAuditLog } from '@/app/lib/db/securityAudit';

export const runtime = 'nodejs';

const verifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, '6자리 인증 코드를 입력해 주세요.'),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = verifySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? '인증 코드를 확인해 주세요.' }, { status: 400 });
    }

    const result = await verifyKakaoLinkCode({ userId: user.id, code: parsed.data.code });
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });

    await createSecurityAuditLog({
      actorId: user.id,
      targetUserId: user.id,
      action: 'SETTINGS_UPDATED',
      details: {
        area: 'kakao_self_link',
        action: 'verify',
        kakaoUserKey: result.kakaoUserKey,
      },
    });

    return NextResponse.json({ message: '카카오 계정이 연결되었습니다.' }, { status: 200 });
  } catch (error) {
    console.error('Failed to verify kakao link code', error);
    return NextResponse.json({ message: '카카오 계정 연동을 완료하지 못했습니다.' }, { status: 500 });
  }
}
