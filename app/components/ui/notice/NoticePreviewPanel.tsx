'use client';

import Link from 'next/link';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { Notice } from '@/app/lib/types/notice';

const NOTICE_PREVIEW_OPEN_KEY = 'aicc:dashboard-notice-preview-open';

export default function NoticePreviewPanel({ notices, compact = false }: { notices: Notice[]; compact?: boolean }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem(NOTICE_PREVIEW_OPEN_KEY);
    if (saved === '0') setOpen(false);
    if (saved === '1') setOpen(true);
  }, []);

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      window.localStorage.setItem(NOTICE_PREVIEW_OPEN_KEY, next ? '1' : '0');
      return next;
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggleOpen}
          className="group flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-100 bg-slate-50 text-slate-500 transition group-hover:border-sky-100 group-hover:bg-sky-50 group-hover:text-sky-600">
            <ChevronDown className={['h-4 w-4 transition-transform duration-200', open ? 'rotate-0' : '-rotate-90'].join(' ')} />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-slate-950">공지사항</span>
            <span className="mt-1 block truncate text-xs text-slate-500">최근 공지를 빠르게 확인합니다.</span>
          </span>
        </button>
        <Link
          href="/board/notice"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700"
        >
          전체보기
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {open ? (
        <div className={['mt-3', compact ? 'grid gap-2 md:grid-cols-3' : 'grid gap-2'].join(' ')}>
          {notices.map((notice) => (
            <Link
              key={notice.id}
              href={`/board/notice/${encodeURIComponent(notice.id)}`}
              className="soft-interactive group rounded-md border border-slate-100 bg-slate-50/60 px-3 py-3 transition hover:border-sky-100 hover:bg-sky-50/70"
            >
              <div className="flex items-center gap-2">
                {notice.pinned ? <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">고정</span> : null}
                <div className="truncate text-sm font-semibold text-slate-900 group-hover:text-sky-700">{notice.title}</div>
              </div>
              <p className={['mt-1 text-xs leading-5 text-slate-500', compact ? 'line-clamp-1' : 'line-clamp-2'].join(' ')}>{noticeExcerpt(notice.content)}</p>
              <div className="mt-2 text-[11px] font-medium text-slate-400">{formatShortDate(notice.updatedAt)}</div>
            </Link>
          ))}
          {notices.length === 0 ? <div className="px-3 py-8 text-center text-sm text-slate-500">표시할 공지사항이 없습니다.</div> : null}
        </div>
      ) : null}
    </section>
  );
}

function noticeExcerpt(content: string) {
  return content.replace(/\s+/g, ' ').trim() || '내용 없음';
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit' }).format(new Date(value));
}
