'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getNoticeBanner } from '@/app/lib/api/notice';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Badge } from '@/app/components/ui/badge';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/components/ui/collapsible';

export default function NoticeBanner({ limit = 5 }: { limit?: number }) {
  const [open, setOpen] = useState(true);

  const STORAGE_KEY = 'noticeBanner:open';

  function readOpen(defaultValue = true) {
    if (typeof window === 'undefined') return defaultValue;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v == null ? defaultValue : v === '1';
  }

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
  }, [open]);

  const q = useQuery({
    queryKey: ['notice', 'banner', limit],
    queryFn: () => getNoticeBanner(limit),
    staleTime: 30_000,
    enabled: open, // ✅ 접혀있으면 요청도 안 하게 (원하면 제거)
  });

  const items = q.data?.items ?? [];

  // 접혀있을 때도 "공지" 헤더는 보여주고 싶어서, 전체 return을 Collapsible로 감쌉니다.
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border bg-white p-3">
        <div className="flex items-center justify-between">
          <Badge variant="info" className="rounded-md px-2 py-1 text-[16px] font-semibold tracking-wide">
            공지
          </Badge>

          <div className="flex items-center gap-2">
            {/* 목록으로 가는 링크는 유지하고 싶으면 남겨두세요(선택) */}

            <CollapsibleTrigger>
              <Button
                variant="default"
                size="icon"
                className="w-9 px-0"
                aria-label={open ? '공지 접기' : '공지 펼치기'}
                title={open ? '접기' : '펼치기'}
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : 'rotate-0'}`} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          {/* 로딩 */}
          {q.isPending ? (
            <div className="mt-2 space-y-2">
              {Array.from({ length: Math.min(3, limit) }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="mt-2 text-sm text-slate-500">표시할 공지가 없습니다.</div>
          ) : (
            <div className="mt-2 divide-y divide-slate-200">
              {items.map((n) => (
                <Link key={n.id} href={`/board/notice/${encodeURIComponent(n.id)}`} className="block px-2 py-2 text-sm hover:bg-slate-50">
                  <span className="mr-1 text-slate-500">{n.pinned ? '📌' : '•'}</span>
                  <span className="truncate inline-block max-w-[calc(100%-2rem)] align-bottom">{n.title}</span>
                </Link>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
