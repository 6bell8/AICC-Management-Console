import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/app/lib/auth/session';
import { isGlobalAdmin } from '@/app/lib/auth/authorization';
import { createSecurityAuditLog } from '@/app/lib/db/securityAudit';
import { decideKakaoUserLink, deleteKakaoUserLink, listKakaoLinkAdminData, upsertKakaoUserLink } from '@/app/lib/db/kakao';
import { getUserById, listUsers } from '@/app/lib/db/users';

export const runtime = 'nodejs';

const STATUS_VALUES = ['PENDING', 'APPROVED', 'REJECTED', 'UNLINKED', 'ALL'] as const;

const linkSchema = z.object({
  kakaoUserKey: z.string().trim().min(1).max(120),
  userId: z.string().trim().min(1),
  channelId: z.string().trim().max(120).nullable().optional(),
});

const decisionSchema = z.object({
  kakaoUserKey: z.string().trim().min(1).max(120),
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectedReason: z.string().trim().max(255).nullable().optional(),
});

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!isGlobalAdmin(user)) return null;
  return user;
}

async function buildResponse(req: Request) {
  const url = new URL(req.url);
  const page = Number(url.searchParams.get('page') || 1);
  const pageSize = Number(url.searchParams.get('pageSize') || 20);
  const search = url.searchParams.get('search') || undefined;
  const parsedStatus = z.enum(STATUS_VALUES).safeParse(url.searchParams.get('status') || 'UNLINKED');
  const status = parsedStatus.success ? parsedStatus.data : 'UNLINKED';
  const [kakao, users] = await Promise.all([listKakaoLinkAdminData({ page, pageSize, search, status }), listUsers()]);
  return {
    ...kakao,
    users: users.filter((user) => user.status === 'APPROVED'),
  };
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  return NextResponse.json(await buildResponse(req), { status: 200 });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const parsed = linkSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: '카카오 사용자와 AICC 계정을 확인해 주세요.' }, { status: 400 });

    const target = await getUserById(parsed.data.userId);
    if (!target || target.status !== 'APPROVED') {
      return NextResponse.json({ message: '승인된 AICC 계정만 연결할 수 있습니다.' }, { status: 400 });
    }

    await upsertKakaoUserLink({
      kakaoUserKey: parsed.data.kakaoUserKey,
      userId: parsed.data.userId,
      channelId: parsed.data.channelId ?? null,
    });
    await createSecurityAuditLog({
      actorId: admin.id,
      targetUserId: target.id,
      action: 'SETTINGS_UPDATED',
      details: {
        area: 'kakao_user_link',
        action: 'upsert',
        kakaoUserKey: parsed.data.kakaoUserKey,
        channelId: parsed.data.channelId ?? null,
      },
    });

    return NextResponse.json(await buildResponse(req), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '카카오 계정 연결을 저장하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const parsed = decisionSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ message: '승인/반려 값을 확인해 주세요.' }, { status: 400 });
    if (parsed.data.status === 'REJECTED' && !parsed.data.rejectedReason) {
      return NextResponse.json({ message: '반려 사유를 입력해 주세요.' }, { status: 400 });
    }

    const updated = await decideKakaoUserLink({
      kakaoUserKey: parsed.data.kakaoUserKey,
      status: parsed.data.status,
      actorId: admin.id,
      rejectedReason: parsed.data.rejectedReason ?? null,
    });
    if (!updated) return NextResponse.json({ message: '카카오 연결 요청을 찾지 못했습니다.' }, { status: 404 });

    await createSecurityAuditLog({
      actorId: admin.id,
      targetUserId: null,
      action: 'SETTINGS_UPDATED',
      details: {
        area: 'kakao_user_link',
        action: parsed.data.status.toLowerCase(),
        kakaoUserKey: parsed.data.kakaoUserKey,
        rejectedReason: parsed.data.rejectedReason ?? null,
      },
    });
    return NextResponse.json(await buildResponse(req), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '카카오 계정 연결 상태를 변경하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const kakaoUserKey = new URL(req.url).searchParams.get('kakaoUserKey')?.trim();
  if (!kakaoUserKey) return NextResponse.json({ message: '카카오 사용자 키가 필요합니다.' }, { status: 400 });

  try {
    await deleteKakaoUserLink(kakaoUserKey);
    await createSecurityAuditLog({
      actorId: admin.id,
      targetUserId: null,
      action: 'SETTINGS_UPDATED',
      details: {
        area: 'kakao_user_link',
        action: 'delete',
        kakaoUserKey,
      },
    });
    return NextResponse.json(await buildResponse(req), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '카카오 계정 연결을 해제하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
