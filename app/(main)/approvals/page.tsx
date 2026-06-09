'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { REQUEST_TYPE_LABEL, type ApprovalItem } from '@/app/lib/types/hr';

type ApprovalResponse = {
  items: ApprovalItem[];
};

type DecisionResponse = {
  ok: true;
  calendarSync: {
    status: 'PENDING' | 'SYNCED' | 'FAILED';
    mode: 'mock' | 'real' | null;
    externalPageId: string | null;
    externalUrl: string | null;
    error: string | null;
  } | null;
};

function formatPeriod(item: ApprovalItem) {
  return item.startDate === item.endDate ? item.startDate : `${item.startDate} ~ ${item.endDate}`;
}

function approvalStageLabel(item: ApprovalItem) {
  if (item.requestType === 'TRIP_EXPENSE') {
    return item.approvalStepOrder >= 2 ? '인사팀 최종 결재 대기' : '팀장 결재 대기';
  }
  return '결재 대기';
}

function stageBadgeClass(item: ApprovalItem) {
  if (item.requestType === 'TRIP_EXPENSE' && item.approvalStepOrder >= 2) return 'border-sky-200 bg-sky-50 text-sky-700';
  if (item.requestType === 'TRIP_EXPENSE') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [rejectItem, setRejectItem] = useState<ApprovalItem | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const query = useQuery<ApprovalResponse>({
    queryKey: ['approvals'],
    queryFn: async () => {
      const res = await fetch('/api/approvals', { cache: 'no-store' });
      if (!res.ok) throw new Error('결재함을 불러오지 못했습니다.');
      return res.json();
    },
    retry: 1,
  });

  const decisionMutation = useMutation({
    mutationFn: async (input: { stepId: string; decision: 'APPROVED' | 'REJECTED'; comment?: string }) => {
      const res = await fetch('/api/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '결재를 처리하지 못했습니다.');
      return data as DecisionResponse;
    },
    onSuccess: async () => {
      setSelectedItem(null);
      setRejectItem(null);
      setRejectComment('');
      await qc.invalidateQueries({ queryKey: ['approvals'] });
      await qc.invalidateQueries({ queryKey: ['hr', 'leave'] });
      await qc.invalidateQueries({ queryKey: ['hr', 'trip-expenses'] });
      await qc.invalidateQueries({ queryKey: ['notifications', 'counts'] });
    },
  });

  const items = query.data?.items ?? [];
  const selectedPending = useMemo(() => {
    if (!decisionMutation.isPending) return false;
    const stepId = decisionMutation.variables?.stepId;
    return stepId === selectedItem?.approvalStepId || stepId === rejectItem?.approvalStepId;
  }, [decisionMutation.isPending, decisionMutation.variables?.stepId, rejectItem?.approvalStepId, selectedItem?.approvalStepId]);

  function approve(item: ApprovalItem) {
    decisionMutation.mutate({ stepId: item.approvalStepId, decision: 'APPROVED' });
  }

  function reject() {
    if (!rejectItem) return;
    decisionMutation.mutate({
      stepId: rejectItem.approvalStepId,
      decision: 'REJECTED',
      comment: rejectComment.trim() || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">결재함</h1>
          <p className="text-sm text-muted-foreground">팀원이 올린 연차, 반차, 출장, 출장여비 신청을 승인하거나 반려합니다.</p>
        </div>
        <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          {query.isFetching ? '갱신 중...' : '새로고침'}
        </Button>
      </div>

      {decisionMutation.isError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{(decisionMutation.error as Error).message}</div>
      ) : null}
      {decisionMutation.data?.calendarSync ? (
        <div
          className={[
            'rounded-md border px-3 py-2 text-sm',
            decisionMutation.data.calendarSync.status === 'SYNCED'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700',
          ].join(' ')}
        >
          {decisionMutation.data.calendarSync.status === 'SYNCED'
            ? `Notion calendar sync ${decisionMutation.data.calendarSync.mode === 'mock' ? 'mock ' : ''}completed.`
            : `Notion calendar sync failed: ${decisionMutation.data.calendarSync.error ?? 'unknown error'}`}
        </div>
      ) : null}

      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">대기 중인 결재</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left font-medium">신청자</th>
                  <th className="py-2 text-left font-medium">팀</th>
                  <th className="py-2 text-left font-medium">유형</th>
                  <th className="py-2 text-left font-medium">결재 상태</th>
                  <th className="py-2 text-left font-medium">기간</th>
                  <th className="py-2 text-left font-medium">내용</th>
                  <th className="py-2 text-right font-medium">처리</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const pending = decisionMutation.isPending && decisionMutation.variables?.stepId === item.approvalStepId;
                  return (
                    <tr key={item.approvalStepId} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60">
                      <td className="py-2">{item.requesterName}</td>
                      <td className="py-2">{item.teamName ?? '-'}</td>
                      <td className="py-2">{REQUEST_TYPE_LABEL[item.requestType]}</td>
                      <td className="py-2">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${stageBadgeClass(item)}`}>{approvalStageLabel(item)}</span>
                      </td>
                      <td className="py-2">{formatPeriod(item)}</td>
                      <td className="max-w-[260px] truncate py-2" title={item.reason ?? ''}>
                        {item.reason ?? '-'}
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" disabled={pending} onClick={() => setSelectedItem(item)}>
                            상세
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                            disabled={pending}
                            onClick={() => {
                              setRejectItem(item);
                              setRejectComment('');
                            }}
                          >
                            반려
                          </Button>
                          <Button size="sm" variant="saveOutlineGreen" disabled={pending} onClick={() => approve(item)}>
                            승인
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-sm text-slate-500" colSpan={7}>
                      대기 중인 결재가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedItem ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/35" onClick={() => setSelectedItem(null)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2">
            <Card className="border-slate-200 bg-white shadow-xl">
              <CardHeader>
                <CardTitle className="text-base">결재 상세</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-sm sm:grid-cols-2">
                  <Detail label="신청자" value={selectedItem.requesterName} />
                  <Detail label="팀" value={selectedItem.teamName ?? '-'} />
                  <Detail label="유형" value={REQUEST_TYPE_LABEL[selectedItem.requestType]} />
                  <Detail label="결재 상태" value={approvalStageLabel(selectedItem)} />
                  <Detail label="기간" value={formatPeriod(selectedItem)} />
                  <Detail label="결재자" value={selectedItem.approverName ?? '-'} />
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-700">내용</div>
                  <div className="min-h-[92px] whitespace-pre-wrap rounded-lg border border-slate-100 bg-white p-3 text-sm text-slate-700">
                    {selectedItem.reason ?? '-'}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedItem(null)} disabled={selectedPending}>
                    닫기
                  </Button>
                  <Button
                    variant="outline"
                    className="border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                    disabled={selectedPending}
                    onClick={() => {
                      setRejectItem(selectedItem);
                      setRejectComment('');
                    }}
                  >
                    반려
                  </Button>
                  <Button variant="saveOutlineGreen" disabled={selectedPending} onClick={() => approve(selectedItem)}>
                    승인
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {rejectItem ? (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/35" onClick={() => setRejectItem(null)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2">
            <Card className="border-slate-200 bg-white shadow-xl">
              <CardHeader>
                <CardTitle className="text-base">반려 사유 입력</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-3 text-sm text-rose-800">
                  {rejectItem.requesterName}님의 {REQUEST_TYPE_LABEL[rejectItem.requestType]} 신청을 반려합니다.
                </div>
                <textarea
                  value={rejectComment}
                  onChange={(event) => setRejectComment(event.target.value)}
                  placeholder="반려 사유를 입력해 주세요."
                  className="min-h-[110px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                  maxLength={1000}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setRejectItem(null)} disabled={selectedPending}>
                    취소
                  </Button>
                  <Button
                    variant="outline"
                    className="border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                    disabled={selectedPending}
                    onClick={reject}
                  >
                    반려 처리
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}
