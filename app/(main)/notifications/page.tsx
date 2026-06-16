'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, Inbox, Sparkles } from 'lucide-react';

import type { NotificationItem } from '@/app/lib/types/hr';

type NotificationResponse = {
  items: NotificationItem[];
};

const PAGE_SIZE = 10;

const TYPE_META: Record<string, { label: string; className: string }> = {
  APPROVAL_REQUESTED: { label: '결재 요청', className: 'border-amber-100 bg-amber-50 text-amber-800' },
  APPROVAL_APPROVED: { label: '승인', className: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
  APPROVAL_REJECTED: { label: '반려', className: 'border-rose-100 bg-rose-50 text-rose-700' },
  REQUEST_CANCELLED: { label: '취소', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  SYSTEM: { label: '시스템', className: 'border-sky-100 bg-sky-50 text-sky-700' },
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const query = useQuery<NotificationResponse>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) throw new Error('알림을 불러오지 못했습니다.');
      return res.json();
    },
    retry: 1,
  });

  const readMutation = useMutation({
    mutationFn: async (input: { id?: string; all?: boolean }) => {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('알림을 읽음 처리하지 못했습니다.');
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notifications'] });
      await qc.invalidateQueries({ queryKey: ['notifications', 'counts'] });
    },
  });

  const items = query.data?.items ?? [];
  const unreadCount = items.filter((item) => !item.readAt).length;
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, safePage]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            <Bell className="h-3.5 w-3.5" />
            업무 알림
          </div>
          <h1 className="mt-3 text-xl font-semibold text-slate-950">알림함</h1>
          <p className="mt-1 text-sm text-slate-500">결재 요청, 승인, 반려 등 놓치기 쉬운 업무 알림을 모아봅니다.</p>
        </div>
        <button
          type="button"
          onClick={() => readMutation.mutate({ all: true })}
          disabled={unreadCount === 0 || readMutation.isPending}
          className="soft-interactive inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:pointer-events-none disabled:opacity-45"
        >
          <CheckCheck className="h-4 w-4" />
          모두 읽음
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="전체 알림" value={`${items.length}건`} tone="sky" />
        <SummaryCard label="읽지 않음" value={`${unreadCount}건`} tone="amber" />
        <SummaryCard label="읽음 처리" value={`${items.length - unreadCount}건`} tone="emerald" />
      </section>

      <section className="soft-panel p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">최근 알림</h2>
            <p className="mt-1 text-xs text-slate-500">
              {items.length ? `${items.length.toLocaleString()}건 중 ${(safePage - 1) * PAGE_SIZE + 1}-${Math.min(safePage * PAGE_SIZE, items.length)}건` : '표시할 알림이 없습니다.'}
            </p>
          </div>
          {unreadCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
              <Sparkles className="h-3.5 w-3.5" />
              새 알림 {unreadCount}
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          {pagedItems.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              pending={readMutation.isPending}
              onRead={() => readMutation.mutate({ id: item.id })}
            />
          ))}
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-12 text-center">
              <Inbox className="mx-auto h-8 w-8 text-slate-300" />
              <div className="mt-3 text-sm font-semibold text-slate-700">표시할 알림이 없습니다.</div>
              <div className="mt-1 text-xs text-slate-500">새 결재나 처리 결과가 생기면 이곳에 표시됩니다.</div>
            </div>
          ) : null}
        </div>

        {items.length > PAGE_SIZE ? (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">{safePage} / {totalPages} 페이지</div>
            <div className="flex flex-wrap gap-1.5">
              <PageButton disabled={safePage <= 1} onClick={() => setPage(1)}>First</PageButton>
              <PageButton disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>이전</PageButton>
              <PageButton active onClick={() => setPage(safePage)}>{safePage}</PageButton>
              <PageButton disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>다음</PageButton>
              <PageButton disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>Last</PageButton>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function NotificationCard({ item, pending, onRead }: { item: NotificationItem; pending: boolean; onRead: () => void }) {
  const meta = TYPE_META[item.type] ?? TYPE_META.SYSTEM;
  const unread = !item.readAt;

  return (
    <article
      className={[
        'soft-interactive rounded-xl border p-3',
        unread ? 'border-sky-100 bg-sky-50/70 shadow-sm' : 'border-slate-100 bg-white',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span className={['mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border', unread ? 'border-sky-100 bg-white text-sky-600' : 'border-slate-100 bg-slate-50 text-slate-400'].join(' ')}>
          {unread ? <Bell className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={['inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', meta.className].join(' ')}>
              {meta.label}
            </span>
            {unread ? <span className="h-2 w-2 rounded-full bg-sky-500" /> : null}
            <time className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('ko-KR')}</time>
          </div>
          <h3 className="mt-2 truncate text-sm font-semibold text-slate-950">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{item.message}</p>
        </div>
        <button
          type="button"
          disabled={!unread || pending}
          onClick={onRead}
          className="soft-interactive shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:pointer-events-none disabled:opacity-40"
        >
          {unread ? '읽음' : '완료'}
        </button>
      </div>
    </article>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'sky' | 'amber' | 'emerald' }) {
  const toneClass = {
    sky: 'border-sky-100 bg-sky-50/60 text-sky-900',
    amber: 'border-amber-100 bg-amber-50/60 text-amber-900',
    emerald: 'border-emerald-100 bg-emerald-50/60 text-emerald-900',
  }[tone];
  return (
    <div className={['soft-interactive rounded-lg border p-3', toneClass].join(' ')}>
      <div className="text-xs font-medium opacity-70">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function PageButton({ children, active = false, disabled = false, onClick }: { children: ReactNode; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'soft-interactive min-w-9 rounded-md border px-2.5 py-1.5 text-sm font-semibold disabled:pointer-events-none disabled:opacity-40',
        active ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
