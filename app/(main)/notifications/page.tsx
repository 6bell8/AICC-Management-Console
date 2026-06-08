'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import type { NotificationItem } from '@/app/lib/types/hr';

type NotificationResponse = {
  items: NotificationItem[];
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 10;
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
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">알림</h1>
          <p className="text-sm text-muted-foreground">결재 요청, 승인, 반려 등 업무 알림을 확인합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => readMutation.mutate({ all: true })} disabled={unreadCount === 0 || readMutation.isPending}>
            모두 읽음
          </Button>
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? '갱신 중...' : '새로고침'}
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">최근 알림</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {pagedItems.map((item) => (
              <div key={item.id} className={['flex items-start justify-between gap-3 p-4', item.readAt ? 'bg-white' : 'bg-sky-50/40'].join(' ')}>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    {!item.readAt ? <span className="h-2 w-2 rounded-full bg-sky-500" /> : null}
                    <div className="font-medium text-slate-900">{item.title}</div>
                  </div>
                  <div className="text-sm text-slate-600">{item.message}</div>
                  <div className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</div>
                </div>
                <Button variant="outline" size="sm" disabled={Boolean(item.readAt) || readMutation.isPending} onClick={() => readMutation.mutate({ id: item.id })}>
                  {item.readAt ? '읽음' : '읽음 처리'}
                </Button>
              </div>
            ))}
            {items.length === 0 ? <div className="p-6 text-center text-sm text-slate-500">표시할 알림이 없습니다.</div> : null}
          </div>
          {items.length > pageSize ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm text-slate-500">
                {items.length.toLocaleString()}개 중 {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, items.length)}개
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(1)}>
                  First
                </Button>
                <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  이전
                </Button>
                <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-semibold text-white">
                  {safePage}
                </span>
                <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  다음
                </Button>
                <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>
                  Last
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
