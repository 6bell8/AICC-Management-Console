'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pin, X } from 'lucide-react';

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
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function NoticeBanner({ limit = 5, intervalMs = 5000 }: { limit?: number; intervalMs?: number }) {
  const [dismissed, setDismissed] = useState(false);
  const [idx, setIdx] = useState(0);

  const q = useQuery({
    queryKey: ['notice', 'banner', limit],
    queryFn: () => getNoticeBanner(limit),
    staleTime: 30_000,
    enabled: !dismissed,
  });

  const items: NoticeItem[] = useMemo(() => {
    const raw = (q.data?.items ?? []) as NoticeItem[];
    return raw
      .filter((notice) => notice.pinned === true)
      .sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
      });
  }, [q.data]);

  const activeIdx = items.length > 0 ? idx % items.length : 0;
  const mobileItem = items[0] ?? null;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === todayKey());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (dismissed || items.length <= 1 || typeof window === 'undefined') return undefined;

    const timer = window.setInterval(() => {
      setIdx((prev) => (prev + 1) % items.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [dismissed, items.length, intervalMs]);

  const onDismissToday = () => {
    window.localStorage.setItem(DISMISS_KEY, todayKey());
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="rounded-lg bg-slate-100/60 p-3">
      <div className="relative flex items-center justify-center gap-3 sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 pr-10 text-center sm:justify-start sm:gap-3 sm:pr-0 sm:text-left">
          <Badge variant="info" className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold tracking-wide sm:text-[16px]">
            공지
          </Badge>

          <div className="min-w-0 flex-1">
            {q.isPending ? (
              <Skeleton className="mx-auto h-5 w-full max-w-[280px] sm:mx-0" />
            ) : items.length === 0 ? (
              <span className="text-sm text-slate-500">표시할 공지가 없습니다.</span>
            ) : (
              <>
                <div className="sm:hidden">
                  <NoticeLink item={mobileItem} className="line-clamp-2 text-sm leading-5 text-slate-800" />
                </div>

                <div className="relative hidden h-6 min-w-0 overflow-hidden sm:block">
                  <div className="transition-transform duration-300 will-change-transform" style={{ transform: `translateY(-${activeIdx * 1.5}rem)` }}>
                    {items.map((item) => (
                      <NoticeLink key={item.id} item={item} className="block h-6 truncate text-sm leading-6 text-slate-800 hover:underline" />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 shrink-0 sm:static sm:translate-y-0"
          aria-label="오늘 공지 배너 숨기기"
          title="오늘 숨기기"
          onClick={onDismissToday}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function NoticeLink({ className, item }: { className: string; item: NoticeItem | null }) {
  if (!item) return null;

  return (
    <Link href={`/board/notice/${encodeURIComponent(item.id)}`} className={className} title={item.title}>
      <Pin className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-rose-500" />
      {item.title}
    </Link>
  );
}
