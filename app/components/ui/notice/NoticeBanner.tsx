'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { getNoticeBanner } from '@/app/lib/api/notice';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';

type NoticeItem = {
  id: string;
  title: string;
  pinned?: boolean;
  createdAt?: string;
};

const DISMISS_KEY = 'noticeBanner:dismissedDate';

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function NoticeBanner({ limit = 5, intervalMs = 5000 }: { limit?: number; intervalMs?: number }) {
  const [dismissed, setDismissed] = useState(false);
  const [idx, setIdx] = useState(0);

  // ✅ mount 후에만 localStorage 읽기 (하이드레이션 안전)
  useEffect(() => {
    const v = window.localStorage.getItem(DISMISS_KEY);
    setDismissed(v === todayKey());
  }, []);

  const q = useQuery({
    queryKey: ['notice', 'banner', limit],
    queryFn: () => getNoticeBanner(limit),
    staleTime: 30_000,
    enabled: !dismissed, // ✅ 오늘 숨김이면 요청도 안 함
  });

  const items: NoticeItem[] = useMemo(() => {
    const raw = (q.data?.items ?? []) as NoticeItem[];

    // ✅ pinned만 배너에 노출하고 싶을 때
    const pinnedOnly = raw.filter((n) => n.pinned === true);

    // pinnedOnly도 최신순 정렬(원하면)
    return [...pinnedOnly].sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });
  }, [q.data]);

  // 데이터가 바뀌면 인덱스 리셋
  useEffect(() => {
    setIdx(0);
  }, [items.length]);

  // ✅ 5초 간격 수직 슬라이드
  useEffect(() => {
    if (dismissed) return;
    if (items.length <= 1) return;

    const t = window.setInterval(() => {
      setIdx((prev) => (prev + 1) % items.length);
    }, intervalMs);

    return () => window.clearInterval(t);
  }, [dismissed, items.length, intervalMs]);

  const onDismissToday = () => {
    window.localStorage.setItem(DISMISS_KEY, todayKey()); // ✅ 오늘 날짜로 기록
    setDismissed(true);
  };

  // ✅ 오늘은 안 보기
  if (dismissed) return null;

  return (
    <div className="rounded-lg bg-slate-100/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Badge variant="info" className="rounded-md px-2 py-1 text-[16px] font-semibold tracking-wide">
            공지
          </Badge>

          {/* ✅ 헤더 안 “수직 티커” */}
          <div className="relative h-6 overflow-hidden min-w-0">
            {q.isPending ? (
              <Skeleton className="h-5 w-[280px]" />
            ) : items.length === 0 ? (
              <span className="text-sm text-slate-500">표시할 공지가 없습니다.</span>
            ) : (
              <div
                className="transition-transform duration-300 will-change-transform"
                style={{ transform: `translateY(-${idx * 1.5}rem)` }} // h-6 = 1.5rem
              >
                {items.map((n) => (
                  <Link
                    key={n.id}
                    href={`/board/notice/${encodeURIComponent(n.id)}`}
                    className="block h-6 leading-6 text-sm text-slate-800 hover:underline truncate"
                    title={n.title}
                  >
                    <span className="mr-1 text-slate-500">{n.pinned ? '📌' : '•'}</span>
                    {n.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ✅ “오늘은 숨김” 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label="오늘은 공지 배너 숨김"
          title="오늘은 숨김"
          onClick={onDismissToday}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
