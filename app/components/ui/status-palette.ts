// app/lib/ui/status-palette.ts

// ✅ 차트(HEX) + 배지(클래스) + 텍스트톤(클래스)를 한 번에 관리
export type StatusKey = 'DRAFT' | 'RUNNING' | 'PAUSED' | 'ARCHIVED' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export type StatusPalette = {
  key: StatusKey | null;
  label?: string; // ✅ 핵심: label 존재를 타입에 선언
  badge?: string;
  text?: string;
  chart?: string;
};

export const STATUS_PALETTE: Record<
  StatusKey,
  {
    label?: string; // 필요하면 UI 라벨도 같이 관리 가능
    chart: string; // chart.js에서 쓰는 HEX
    badge: string; // Badge className에 붙일 tailwind class
    text: string; // 설명/본문 텍스트 톤용(선택)
  }
> = {
  RUNNING: {
    label: '운영중',
    chart: '#34D399', // emerald
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    text: 'text-emerald-700/80',
  },
  PAUSED: {
    label: '일시중지',
    chart: '#FBBF24', // amber-400 느낌 (차트에서 잘 보임)
    badge: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    text: 'text-amber-800/80',
  },

  DRAFT: {
    label: '초안',
    chart: '#60A5FA', // blue
    badge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
    text: 'text-sky-700/80',
  },
  ARCHIVED: {
    label: '보관',
    chart: '#94A3B8', // slate
    badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    text: 'text-slate-700/70',
  },

  // 아래는 대시보드 차트/확장 대비 (캠페인에는 당장 없어도 OK)
  SUCCESS: {
    label: '성공',
    chart: '#60A5FA',
    badge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
    text: 'text-sky-700/80',
  },
  FAILED: {
    label: '실패',
    chart: '#F87171',
    badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    text: 'text-rose-700/80',
  },
  CANCELLED: {
    label: '취소',
    chart: '#94A3B8',
    badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    text: 'text-slate-700/70',
  },
};

export const DEFAULT_STATUS = {
  chart: '#CBD5E1', // slate-300
  badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  text: 'text-slate-700/70',
} as const;

/** label(한글/영문 혼재) -> StatusKey로 normalize */
export function normalizeStatusKey(input: string): StatusKey | null {
  const x = input.trim();

  // 영문
  if (x === 'RUNNING' || x === 'PAUSED' || x === 'DRAFT' || x === 'ARCHIVED' || x === 'SUCCESS' || x === 'FAILED' || x === 'CANCELLED') return x;

  // 한글 (대시보드에서 label로 들어오는 케이스)
  if (x === '운영중' || x === '실행중') return 'RUNNING';
  if (x === '일시중지' || x === '중지') return 'PAUSED';
  if (x === '초안') return 'DRAFT';
  if (x === '보관') return 'ARCHIVED';
  if (x === '성공') return 'SUCCESS';
  if (x === '실패') return 'FAILED';
  if (x === '취소') return 'CANCELLED';

  return null;
}

export function getStatusPalette(input: string): StatusPalette {
  const key = normalizeStatusKey(input);
  if (!key) return { key: null, ...DEFAULT_STATUS };
  return { key, ...STATUS_PALETTE[key] };
}
