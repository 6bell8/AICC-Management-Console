'use client';

import Link from 'next/link';
import { ArrowUpRight, Bell, ChevronDown, Gift } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import type { Notice } from '@/app/lib/types/notice';
import type { FamilyEventDashboardSummary, FamilyEventType } from '@/app/lib/types/familyEvent';

const OPERATIONS_PREVIEW_OPEN_KEY = 'aicc:dashboard-operations-preview-open';

const EVENT_LABEL: Record<FamilyEventType, string> = {
  MARRIAGE: '결혼',
  BIRTH: '출산',
  FUNERAL: '조의',
  FIRST_BIRTHDAY: '돌잔치',
  HOSPITAL: '입원/위로',
  OTHER: '기타',
};

export default function DashboardOperationsPreviewPanel({
  notices,
  familyEventSummary,
}: {
  notices: Notice[];
  familyEventSummary: FamilyEventDashboardSummary;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem(OPERATIONS_PREVIEW_OPEN_KEY);
    if (saved === '0') setOpen(false);
    if (saved === '1') setOpen(true);
  }, []);

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      window.localStorage.setItem(OPERATIONS_PREVIEW_OPEN_KEY, next ? '1' : '0');
      return next;
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={toggleOpen} className="group flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-100 bg-slate-50 text-slate-500 transition group-hover:border-sky-100 group-hover:bg-sky-50 group-hover:text-sky-600">
            <ChevronDown className={['h-4 w-4 transition-transform duration-200', open ? 'rotate-0' : '-rotate-90'].join(' ')} />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-slate-950">운영 소식</span>
            <span className="mt-1 block truncate text-xs text-slate-500">공지사항과 경조사 현황을 한 번에 확인합니다.</span>
          </span>
        </button>
      </div>

      {open ? (
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <PreviewGroup title="공지사항" href="/board/notice" icon={<Bell className="h-4 w-4" />} tone="sky">
            <div className="grid gap-2">
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
                  <p className="mt-1 line-clamp-1 text-xs leading-5 text-slate-500">{noticeExcerpt(notice.content)}</p>
                  <div className="mt-2 text-[11px] font-medium text-slate-400">{formatShortDate(notice.updatedAt)}</div>
                </Link>
              ))}
              {notices.length === 0 ? <Empty text="표시할 공지사항이 없습니다." /> : null}
            </div>
          </PreviewGroup>

          <PreviewGroup title="경조사 현황" href="/hr/family-events" icon={<Gift className="h-4 w-4" />} tone="amber">

            <div className="grid gap-2">
              {familyEventSummary.recentItems.map((item) => (
                <Link
                  key={item.id}
                  href="/hr/family-events"
                  className="soft-interactive group rounded-md border border-slate-100 bg-slate-50/60 px-3 py-3 transition hover:border-amber-100 hover:bg-amber-50/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-slate-900 group-hover:text-amber-800">
                      {EVENT_LABEL[item.eventType]} · {item.relation || '대상 미입력'}
                    </div>
                  </div>
                  <div className="mt-2 text-xs font-medium text-slate-500">{formatLongDate(item.eventDate)}</div>
                </Link>
              ))}
              {familyEventSummary.recentItems.length === 0 ? <Empty text="표시할 경조사 신청이 없습니다." /> : null}
            </div>
          </PreviewGroup>
        </div>
      ) : null}
    </section>
  );
}

function PreviewGroup({
  title,
  href,
  icon,
  tone,
  children,
}: {
  title: string;
  href: string;
  icon: ReactNode;
  tone: 'sky' | 'amber';
  children: ReactNode;
}) {
  const toneClass = {
    sky: 'border-sky-100 bg-sky-50 text-sky-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
  }[tone];

  return (
    <div className="rounded-md border border-slate-100 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={['inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border', toneClass].join(' ')}>{icon}</span>
          <h2 className="truncate text-sm font-semibold text-slate-950">{title}</h2>
        </div>
        <Link
          href={href}
          aria-label={`${title} 전체 보기`}
          title="전체 보기"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-3 py-8 text-center text-sm text-slate-500">{text}</div>;
}

function noticeExcerpt(content: string) {
  return content.replace(/\s+/g, ' ').trim() || '내용 없음';
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit' }).format(new Date(value));
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
