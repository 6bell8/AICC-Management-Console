import { NextResponse } from 'next/server';

import { createKakaoLinkVerification, getActiveKakaoLinkSession, getUserByKakaoKey, logKakaoMessage, startKakaoLinkSession } from '@/app/lib/db/kakao';
import { cancelRoomReservation, createRoomReservation, listRoomReservationSnapshot } from '@/app/lib/db/roomReservations';
import type { RoomResource } from '@/app/lib/types/roomReservation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type KakaoSkillBody = {
  userRequest?: {
    utterance?: string;
    user?: {
      id?: string;
      properties?: Record<string, string | undefined>;
    };
  };
  bot?: {
    id?: string;
  };
  action?: {
    params?: Record<string, string | undefined>;
  };
};

type KakaoButton = {
  label: string;
  messageText: string;
};

type KakaoThumbnail = {
  imageUrl: string;
  fixedRatio?: boolean;
  width?: number;
  height?: number;
};

type KakaoTextResult = {
  text: string;
  outputs?: KakaoOutput[];
};

type KakaoOutput =
  | { simpleText: { text: string } }
  | {
      basicCard: {
        title: string;
        description?: string;
        thumbnail?: KakaoThumbnail;
        buttons?: Array<{ action: 'message'; label: string; messageText: string }>;
      };
    }
  | {
      carousel: {
        type: 'basicCard';
        items: Array<{
          title: string;
          description?: string;
          thumbnail?: KakaoThumbnail;
          buttons?: Array<{ action: 'message'; label: string; messageText: string }>;
        }>;
      };
    };

const KAKAO_CHANNEL_BANNER = '/kakao-channel-banner.png';

function toKakaoButtons(buttons: KakaoButton[] = []) {
  return buttons.slice(0, 3).map((item) => ({
    label: item.label,
    action: 'message' as const,
    messageText: item.messageText,
  }));
}

function simpleOutput(text: string): KakaoOutput {
  return { simpleText: { text } };
}

function getPublicAssetUrl(path: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://aicc-management-console.vercel.app');
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function kakaoThumbnail(imagePath = '/og-image.png'): KakaoThumbnail {
  return {
    imageUrl: getPublicAssetUrl(imagePath),
    fixedRatio: true,
    width: 800,
    height: 450,
  };
}

function cardOutput(title: string, description: string, buttons: KakaoButton[] = [], thumbnail?: KakaoThumbnail): KakaoOutput {
  return {
    basicCard: {
      title,
      description,
      ...(thumbnail ? { thumbnail } : {}),
      buttons: toKakaoButtons(buttons),
    },
  };
}

function carouselOutput(items: Array<{ title: string; description?: string; thumbnail?: KakaoThumbnail; buttons?: KakaoButton[] }>): KakaoOutput {
  return {
    carousel: {
      type: 'basicCard',
      items: items.slice(0, 10).map((item) => ({
        title: item.title,
        description: item.description,
        ...(item.thumbnail ? { thumbnail: item.thumbnail } : {}),
        buttons: toKakaoButtons(item.buttons),
      })),
    },
  };
}

function kakaoText(result: KakaoTextResult) {
  return NextResponse.json({
    version: '2.0',
    template: {
      outputs: result.outputs?.length ? result.outputs : [simpleOutput(result.text)],
    },
  });
}

function getKakaoUserKey(body: KakaoSkillBody) {
  return body.userRequest?.user?.id ?? body.userRequest?.user?.properties?.plusfriendUserKey ?? null;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function hasAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function isTodayScheduleIntent(utterance: string) {
  return hasAny(utterance, ['오늘 공간 일정', '오늘 일정', '오늘 예약', '오늘 회의실 예약', '예약 현황']) || (utterance.includes('오늘') && hasAny(utterance, ['일정', '예약', '회의실', '공간']));
}

function isMainMenuIntent(utterance: string) {
  return hasAny(utterance, ['메뉴', '시작', '처음', '웰컴', '홈', '업무']);
}

function isAvailabilityIntent(utterance: string) {
  return hasAny(utterance, ['예약가능', '예약 가능', '빈 회의실', '빈 공간', '가능한 공간', '가능한 회의실']);
}

function isReservationCreateIntent(utterance: string) {
  return utterance.startsWith('예약 ') || utterance.includes('예약해');
}

function isMyReservationsIntent(utterance: string) {
  return hasAny(utterance, ['내 예약', '나의 예약', '내 일정', '내 공간 예약', '내 회의실 예약']);
}

function isReservationCancelIntent(utterance: string) {
  return hasAny(utterance, ['예약취소', '예약 취소', '취소']);
}

function isResourceListIntent(utterance: string) {
  return hasAny(utterance, ['공간예약', '공간 예약', '회의실 예약', '교육장 예약', '공간 목록', '회의실 목록', '교육장 목록']);
}

function isAttendanceIntent(utterance: string) {
  return hasAny(utterance, ['근태', '근태신청', '출근', '퇴근', '외근']);
}

function isLeaveIntent(utterance: string) {
  return hasAny(utterance, ['연차', '휴가', '휴가신청', '연차신청']);
}

function isApprovalIntent(utterance: string) {
  return hasAny(utterance, ['결재', '결재함', '승인', '승인요청']);
}

function isNotificationIntent(utterance: string) {
  return hasAny(utterance, ['알림', '내 알림', '공지']);
}

function isKakaoLinkIntent(utterance: string) {
  return hasAny(utterance, ['연동', '계정연동', '계정 연동', '인증', '본인인증']);
}

function isKakaoLinkStartIntent(utterance: string) {
  return ['본인인증', '계정연동', '계정 연동', '카카오 연동', 'AICC 연동', 'aicc 연동'].includes(utterance);
}

function parseEmail(utterance: string) {
  const match = utterance.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() ?? null;
}

function getKstDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

function parseDate(value: string) {
  if (value.includes('내일')) return getKstDate(1);
  if (value.includes('오늘')) return getKstDate();
  const match = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return match?.[1] ?? null;
}

function parseTimes(value: string) {
  const matches = [...value.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)].map((match) => `${match[1].padStart(2, '0')}:${match[2]}`);
  if (matches.length < 2) return null;
  return { startTime: matches[0], endTime: matches[1] };
}

function toKstIso(date: string, time: string) {
  return `${date}T${time}:00+09:00`;
}

function formatReservationTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function findResource(resources: RoomResource[], utterance: string) {
  const normalized = utterance.toLowerCase();
  return resources.find((resource) => normalized.includes(resource.name.toLowerCase())) ?? null;
}

function parseTitle(utterance: string) {
  const titleMatch = utterance.match(/(?:제목|회의명|목적)\s*[:：]?\s*(.+)$/);
  return titleMatch?.[1]?.trim() || '카카오톡 공간 예약';
}

function parseReservationId(utterance: string) {
  const match = utterance.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
  return match?.[0] ?? null;
}

function defaultButtons(): KakaoButton[] {
  const today = getKstDate();
  const tomorrow = getKstDate(1);
  return [
    { label: '오늘 일정', messageText: '오늘 공간 일정' },
    { label: '오늘 10시 가능', messageText: `예약가능 ${today} 10:00 11:00` },
    { label: '오늘 14시 가능', messageText: `예약가능 ${today} 14:00 15:00` },
    { label: '내일 10시 가능', messageText: `예약가능 ${tomorrow} 10:00 11:00` },
    { label: '내 예약', messageText: '내 예약' },
  ];
}

function availabilityButtons(date: string, startTime: string, endTime: string, resources: RoomResource[]): KakaoButton[] {
  return [
    ...resources.slice(0, 6).map((resource) => ({
      label: `${resource.name} 예약`,
      messageText: `예약 ${resource.name} ${date} ${startTime} ${endTime} 제목 회의`,
    })),
    { label: '오늘 일정', messageText: '오늘 공간 일정' },
    { label: '공간 목록', messageText: '공간예약' },
  ];
}

function handleMainMenu(): KakaoTextResult {
  const text = 'AICC 업무 메뉴입니다. 필요한 업무를 선택해 주세요.';
  return {
    text,
    outputs: [
      simpleOutput(text),
      carouselOutput([
        {
          title: 'AICC 계정 인증',
          description: '카카오톡 사용자와 AICC 로그인 계정을 본인인증으로 연결합니다.',
          thumbnail: kakaoThumbnail(KAKAO_CHANNEL_BANNER),
          buttons: [
            { label: '본인인증', messageText: '본인인증' },
            { label: '공간예약', messageText: '공간예약' },
            { label: '내 예약', messageText: '내 예약' },
          ],
        },
        {
          title: '공간예약',
          description: '회의실/교육장 예약 가능 시간을 확인하고 예약합니다.',
          thumbnail: kakaoThumbnail(),
          buttons: [
            { label: '공간예약 열기', messageText: '공간예약' },
            { label: '오늘 일정', messageText: '오늘 공간 일정' },
            { label: '내 예약', messageText: '내 예약' },
          ],
        },
        {
          title: '근태신청',
          description: '출근/퇴근, 외근, 근태 신청 기능을 준비 중입니다.',
          thumbnail: kakaoThumbnail(),
          buttons: [
            { label: '근태 메뉴', messageText: '근태신청' },
            { label: '메인 메뉴', messageText: '메뉴' },
          ],
        },
        {
          title: '연차/휴가',
          description: '연차 신청과 휴가 현황 조회 기능을 준비 중입니다.',
          thumbnail: kakaoThumbnail(),
          buttons: [
            { label: '연차 메뉴', messageText: '연차신청' },
            { label: '메인 메뉴', messageText: '메뉴' },
          ],
        },
        {
          title: '결재함',
          description: '결재 요청과 승인 현황 조회 기능을 준비 중입니다.',
          thumbnail: kakaoThumbnail(),
          buttons: [
            { label: '결재함 열기', messageText: '결재함' },
            { label: '메인 메뉴', messageText: '메뉴' },
          ],
        },
        {
          title: '내 알림',
          description: '공지와 업무 알림을 확인하는 기능을 준비 중입니다.',
          thumbnail: kakaoThumbnail(),
          buttons: [
            { label: '알림 보기', messageText: '내 알림' },
            { label: '메인 메뉴', messageText: '메뉴' },
          ],
        },
      ]),
    ],
  };
}

function handlePendingMenu(title: string, description: string): KakaoTextResult {
  const text = `${title} 기능은 카카오톡 채널 연동 준비 중입니다.\n현재는 공간예약 기능을 먼저 사용할 수 있습니다.`;
  return {
    text,
    outputs: [
      simpleOutput(text),
      cardOutput(title, description, [
        { label: '공간예약', messageText: '공간예약' },
        { label: '메인 메뉴', messageText: '메뉴' },
      ], kakaoThumbnail(KAKAO_CHANNEL_BANNER)),
    ],
  };
}

function handleUnlinkedUserMenu(): KakaoTextResult {
  const text = ['AICC 계정과 카카오톡 사용자가 연결되지 않았습니다.', '아래 버튼에서 본인인증을 시작해 주세요.'].join('\n');
  return {
    text,
    outputs: [
      simpleOutput(text),
      cardOutput('AICC 계정 인증', '카카오톡 사용자와 AICC 로그인 계정을 본인인증으로 연결합니다.', [
        { label: '본인인증', messageText: '본인인증' },
        { label: '연동 방법', messageText: '연동' },
        { label: '공간예약', messageText: '공간예약' },
      ], kakaoThumbnail()),
    ],
  };
}

async function handleResources(): Promise<KakaoTextResult> {
  const snapshot = await listRoomReservationSnapshot();
  if (snapshot.resources.length === 0) {
    return { text: '등록된 공간이 없습니다. AICC Console에서 회의실/교육장을 먼저 등록해 주세요.' };
  }
  const text = [
    '예약 가능한 공간입니다.',
    ...snapshot.resources.map((resource) => `- ${resource.name} (${resource.type === 'MEETING_ROOM' ? '회의실' : '교육장'}, ${resource.capacity}명)`),
    '',
    '아래 버튼에서 시간대를 먼저 확인해 주세요.',
  ].join('\n');
  return {
    text,
    outputs: [
      simpleOutput(text),
      cardOutput('공간 예약', '원하는 시간대를 먼저 확인해 주세요.', defaultButtons(), kakaoThumbnail()),
    ],
  };
}

async function handleAvailability(utterance: string): Promise<KakaoTextResult> {
  const date = parseDate(utterance);
  const times = parseTimes(utterance);
  if (!date || !times) {
    const text = '예약 가능 여부는 날짜와 시작/종료 시간이 필요합니다.\n아래 버튼에서 자주 쓰는 시간대를 선택해 주세요.';
    return {
      text,
      outputs: [simpleOutput(text), cardOutput('예약 가능 시간 확인', '날짜와 시간대를 선택하면 가능한 공간을 보여드립니다.', defaultButtons(), kakaoThumbnail())],
    };
  }

  const snapshot = await listRoomReservationSnapshot(date);
  const start = new Date(toKstIso(date, times.startTime)).getTime();
  const end = new Date(toKstIso(date, times.endTime)).getTime();
  const busyResourceIds = new Set(
    snapshot.reservations
      .filter((reservation) => reservation.status !== 'CANCELLED')
      .filter((reservation) => new Date(reservation.startsAt).getTime() < end && new Date(reservation.endsAt).getTime() > start)
      .map((reservation) => reservation.resourceId),
  );
  const available = snapshot.resources.filter((resource) => !busyResourceIds.has(resource.id));
  if (available.length === 0) {
    const text = `${date} ${times.startTime}~${times.endTime}에 예약 가능한 공간이 없습니다.`;
    return {
      text,
      outputs: [simpleOutput(text), cardOutput('다른 시간 확인', '다른 시간대로 다시 조회해 주세요.', defaultButtons(), kakaoThumbnail())],
    };
  }
  const text = [`${date} ${times.startTime}~${times.endTime} 예약 가능 공간`, ...available.map((resource) => `- ${resource.name}`), '', '예약할 공간을 선택해 주세요.'].join('\n');
  return {
    text,
    outputs: [
      simpleOutput(text),
      carouselOutput(
        available.map((resource) => ({
          title: resource.name,
          description: `${resource.type === 'MEETING_ROOM' ? '회의실' : '교육장'} · ${resource.capacity}명\n${date} ${times.startTime}~${times.endTime}`,
          buttons: [
            { label: '예약하기', messageText: `예약 ${resource.name} ${date} ${times.startTime} ${times.endTime} 제목 회의` },
            { label: '오늘 일정', messageText: '오늘 공간 일정' },
          ],
        })),
      ),
    ],
  };
}

async function handleReservation(utterance: string, user: NonNullable<Awaited<ReturnType<typeof getUserByKakaoKey>>>): Promise<KakaoTextResult> {
  if (user.role === 'VIEWER') return { text: '조회 권한 계정은 공간 예약을 등록할 수 없습니다.' };

  const date = parseDate(utterance);
  const times = parseTimes(utterance);
  if (!date || !times) {
    const text = '예약하려면 공간명, 날짜, 시작/종료 시간이 필요합니다.\n먼저 예약 가능한 시간대를 확인해 주세요.';
    return {
      text,
      outputs: [simpleOutput(text), cardOutput('예약 가능 시간 확인', '아래 버튼에서 시간대를 먼저 선택해 주세요.', defaultButtons())],
    };
  }

  const snapshot = await listRoomReservationSnapshot(date);
  const resource = findResource(snapshot.resources, utterance);
  if (!resource) {
    const text = ['공간명을 찾지 못했습니다. 예약할 공간을 선택해 주세요.', ...snapshot.resources.map((item) => `- ${item.name}`)].join('\n');
    return {
      text,
      outputs: [
        simpleOutput(text),
        carouselOutput(
          snapshot.resources.map((item) => ({
            title: item.name,
            description: `${item.type === 'MEETING_ROOM' ? '회의실' : '교육장'} · ${item.capacity}명\n${date} ${times.startTime}~${times.endTime}`,
            buttons: [{ label: '예약하기', messageText: `예약 ${item.name} ${date} ${times.startTime} ${times.endTime} 제목 회의` }],
          })),
        ),
      ],
    };
  }

  try {
    await createRoomReservation({
      user,
      resourceId: resource.id,
      title: parseTitle(utterance),
      purpose: '카카오톡 챗봇 예약',
      startsAt: toKstIso(date, times.startTime),
      endsAt: toKstIso(date, times.endTime),
    });
    const text = [`예약이 완료되었습니다.`, `공간: ${resource.name}`, `시간: ${date} ${times.startTime}~${times.endTime}`, `예약자: ${user.name}`].join('\n');
    return {
      text,
      outputs: [
        simpleOutput(text),
        cardOutput('다음 작업', '예약 내용을 확인하거나 다른 공간을 예약할 수 있습니다.', [
          { label: '오늘 일정', messageText: '오늘 공간 일정' },
          { label: '내 예약', messageText: '내 예약' },
          { label: '공간 목록', messageText: '공간예약' },
        ]),
      ],
    };
  } catch (error) {
    const text = error instanceof Error ? error.message : '예약을 저장하지 못했습니다.';
    return {
      text,
      outputs: [simpleOutput(text), cardOutput('다른 시간 확인', '다른 시간대를 선택해 다시 시도해 주세요.', defaultButtons())],
    };
  }
}

async function handleTodaySchedule(): Promise<KakaoTextResult> {
  const date = getKstDate();
  const snapshot = await listRoomReservationSnapshot(date);
  const active = snapshot.reservations.filter((reservation) => reservation.status !== 'CANCELLED');
  if (active.length === 0) {
    const text = `오늘(${date}) 등록된 공간 예약이 없습니다.`;
    return {
      text,
      outputs: [simpleOutput(text), cardOutput('공간 예약', '필요한 시간대를 확인해 보세요.', defaultButtons())],
    };
  }
  const text = [
    `오늘(${date}) 공간 예약`,
    ...active.slice(0, 8).map((reservation) => `- ${reservation.resourceName}: ${formatReservationTime(reservation.startsAt)}~${formatReservationTime(reservation.endsAt)} ${reservation.title}`),
  ].join('\n');
  return {
    text,
    outputs: [simpleOutput(text), cardOutput('다음 작업', '내 예약을 보거나 새 예약을 진행할 수 있습니다.', [{ label: '내 예약', messageText: '내 예약' }, { label: '공간 목록', messageText: '공간예약' }])],
  };
}

async function handleMyReservations(user: NonNullable<Awaited<ReturnType<typeof getUserByKakaoKey>>>): Promise<KakaoTextResult> {
  const startDate = getKstDate();
  const endDate = getKstDate(14);
  const snapshot = await listRoomReservationSnapshot({ startDate, endDate });
  const active = snapshot.reservations
    .filter((reservation) => reservation.status !== 'CANCELLED' && reservation.requesterId === user.id)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  if (active.length === 0) {
    const text = `앞으로 14일 동안 등록된 내 공간 예약이 없습니다.`;
    return {
      text,
      outputs: [simpleOutput(text), cardOutput('공간 예약', '필요한 시간대를 확인해 보세요.', defaultButtons())],
    };
  }

  const text = [
    `내 공간 예약`,
    ...active.slice(0, 8).map((reservation, index) => `${index + 1}. ${reservation.resourceName}: ${formatReservationTime(reservation.startsAt)}~${formatReservationTime(reservation.endsAt)} ${reservation.title}`),
    '',
    '취소할 예약을 선택해 주세요.',
  ].join('\n');
  return {
    text,
    outputs: [
      simpleOutput(text),
      carouselOutput(
        active.slice(0, 8).map((reservation) => ({
          title: reservation.resourceName,
          description: `${formatReservationTime(reservation.startsAt)}~${formatReservationTime(reservation.endsAt)}\n${reservation.title}`,
          buttons: [
            { label: '예약 취소', messageText: `예약취소 ${reservation.id}` },
            { label: '공간 목록', messageText: '공간예약' },
          ],
        })),
      ),
    ],
  };
}

async function handleCancelReservation(utterance: string, user: NonNullable<Awaited<ReturnType<typeof getUserByKakaoKey>>>): Promise<KakaoTextResult> {
  const reservationId = parseReservationId(utterance);
  if (!reservationId) {
    return handleMyReservations(user);
  }

  const cancelled = await cancelRoomReservation({ id: reservationId, user });
  if (!cancelled) {
    const text = '취소할 수 있는 예약을 찾지 못했습니다. 이미 취소되었거나 권한이 없는 예약일 수 있습니다.';
    return {
      text,
      outputs: [simpleOutput(text), cardOutput('예약 확인', '내 예약 목록에서 다시 선택해 주세요.', [{ label: '내 예약', messageText: '내 예약' }, { label: '공간 목록', messageText: '공간예약' }])],
    };
  }

  return {
    text: '예약이 취소되었습니다.',
    outputs: [
      simpleOutput('예약이 취소되었습니다.'),
      cardOutput('다음 작업', '예약 목록을 다시 확인하거나 새 예약을 진행할 수 있습니다.', [
        { label: '내 예약', messageText: '내 예약' },
        { label: '오늘 일정', messageText: '오늘 공간 일정' },
        { label: '공간 목록', messageText: '공간예약' },
      ]),
    ],
  };
}

async function handleKakaoLinkVerification(utterance: string, kakaoUserKey: string | null, channelId: string | null): Promise<KakaoTextResult> {
  if (!kakaoUserKey) {
    return { text: '카카오 사용자 정보를 확인하지 못했습니다. 카카오톡 채널에서 다시 시도해 주세요.' };
  }

  const email = parseEmail(utterance);
  if (!email) {
    await startKakaoLinkSession({ kakaoUserKey, channelId });
    const text = ['AICC 계정 연동을 시작합니다.', '아래 형식으로 AICC 로그인 이메일을 보내 주세요.', '', '예: 연동 user@company.com'].join('\n');
    return {
      text,
      outputs: [simpleOutput(text), cardOutput('AICC 계정 연동', '승인된 AICC 계정 이메일로 1회용 코드를 발급합니다.', [{ label: '이메일 입력 예시', messageText: 'user@company.com' }], kakaoThumbnail(KAKAO_CHANNEL_BANNER))],
    };
  }

  const result = await createKakaoLinkVerification({ kakaoUserKey, channelId, email });
  if (!result.ok) {
    return {
      text: result.message,
      outputs: [simpleOutput(result.message), cardOutput('계정 확인 필요', 'AICC에 승인된 이메일인지 확인한 뒤 다시 시도해 주세요.', [{ label: '다시 연동', messageText: '연동' }])],
    };
  }

  const text = [
    `${result.user.name}님 계정으로 1회용 인증 코드를 발급했습니다.`,
    '',
    `인증 코드: ${result.code}`,
    '유효 시간: 10분',
    '',
    'AICC Console에 해당 이메일로 로그인한 뒤 마이페이지의 카카오 연동에서 코드를 입력해 주세요.',
  ].join('\n');
  return {
    text,
    outputs: [
      simpleOutput(text),
      cardOutput('AICC 카카오 연동', 'AICC 웹에서 코드를 확인하면 이 카카오 계정이 로그인 계정과 연결됩니다.', [
        { label: '다시 발급', messageText: `연동 ${email}` },
        { label: '공간예약', messageText: '공간예약' },
      ], kakaoThumbnail(KAKAO_CHANNEL_BANNER)),
    ],
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as KakaoSkillBody;
  const utterance = normalizeText(body.userRequest?.utterance ?? body.action?.params?.utterance ?? '');
  const kakaoUserKey = getKakaoUserKey(body);
  const channelId = body.bot?.id ?? null;

  const email = parseEmail(utterance);
  const activeLinkSession = email ? await getActiveKakaoLinkSession(kakaoUserKey) : null;
  if (isKakaoLinkStartIntent(utterance) || isKakaoLinkIntent(utterance) || activeLinkSession) {
    const result = await handleKakaoLinkVerification(utterance, kakaoUserKey, channelId);
    void logKakaoMessage({ kakaoUserKey, channelId, direction: 'INBOUND', payload: body });
    void logKakaoMessage({ kakaoUserKey, channelId, direction: 'OUTBOUND', payload: result });
    return kakaoText(result);
  }

  const user = await getUserByKakaoKey(kakaoUserKey);
  if (!user) {
    const result = handleUnlinkedUserMenu();
    void logKakaoMessage({ kakaoUserKey, channelId, direction: 'INBOUND', payload: body });
    void logKakaoMessage({ kakaoUserKey, channelId, direction: 'OUTBOUND', payload: result });
    return kakaoText(result);
  }

  let result: KakaoTextResult;
  if (!utterance || utterance.includes('도움')) {
    result = handleMainMenu();
  } else if (isMainMenuIntent(utterance)) {
    result = handleMainMenu();
  } else if (isReservationCancelIntent(utterance)) {
    result = await handleCancelReservation(utterance, user);
  } else if (isMyReservationsIntent(utterance)) {
    result = await handleMyReservations(user);
  } else if (isAvailabilityIntent(utterance)) {
    result = await handleAvailability(utterance);
  } else if (isReservationCreateIntent(utterance)) {
    result = await handleReservation(utterance, user);
  } else if (isTodayScheduleIntent(utterance)) {
    result = await handleTodaySchedule();
  } else if (isResourceListIntent(utterance) || utterance.includes('공간') || utterance.includes('회의실') || utterance.includes('교육장')) {
    result = await handleResources();
  } else if (isAttendanceIntent(utterance)) {
    result = handlePendingMenu('근태신청', '출근/퇴근, 외근, 근태 신청 기능을 카카오톡 채널에 연결할 예정입니다.');
  } else if (isLeaveIntent(utterance)) {
    result = handlePendingMenu('연차/휴가', '연차 신청, 휴가 현황, 승인 알림 기능을 카카오톡 채널에 연결할 예정입니다.');
  } else if (isApprovalIntent(utterance)) {
    result = handlePendingMenu('결재함', '결재 요청, 승인/반려, 처리 결과 알림 기능을 카카오톡 채널에 연결할 예정입니다.');
  } else if (isNotificationIntent(utterance)) {
    result = handlePendingMenu('내 알림', '공지, 예약, 결재, 근태 알림을 카카오톡 채널에서 확인하도록 확장할 예정입니다.');
  } else {
    const text = ['공간예약 명령을 입력해 주세요.', '공간 목록: 공간예약', '가능 확인: 예약가능 오늘 10:00 11:00', '예약 등록: 예약 회의실 1 오늘 10:00 11:00 제목 회의'].join('\n');
    result = {
      text,
      outputs: [
        simpleOutput(text),
        cardOutput('공간 예약', '아래 버튼에서 원하는 작업을 선택해 주세요.', [
          { label: '공간 목록', messageText: '공간예약' },
          { label: '오늘 일정', messageText: '오늘 공간 일정' },
          { label: '내 예약', messageText: '내 예약' },
        ]),
      ],
    };
  }

  void logKakaoMessage({ kakaoUserKey, channelId, direction: 'INBOUND', payload: body });
  void logKakaoMessage({ kakaoUserKey, channelId, direction: 'OUTBOUND', payload: result });
  return kakaoText(result);
}
