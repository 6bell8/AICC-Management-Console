'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { REQUEST_TYPE_LABEL, type ApprovalItem } from '@/app/lib/types/hr';

type ApprovalResponse = {
  items: ApprovalItem[];
};

function formatPeriod(item: ApprovalItem) {
  return item.startDate === item.endDate ? item.startDate : `${item.startDate} ~ ${item.endDate}`;
}

export default function ApprovalsPage() {
  const qc = useQueryClient();
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
    mutationFn: async (input: { stepId: string; decision: 'APPROVED' | 'REJECTED' }) => {
      const res = await fetch('/api/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '결재를 처리하지 못했습니다.');
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['approvals'] });
      await qc.invalidateQueries({ queryKey: ['hr', 'leave'] });
      await qc.invalidateQueries({ queryKey: ['notifications', 'counts'] });
    },
  });

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">결재함</h1>
          <p className="text-sm text-muted-foreground">팀원이 올린 연차, 반차, 출장성 신청을 승인하거나 반려합니다.</p>
        </div>
        <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          {query.isFetching ? '갱신 중...' : '새로고침'}
        </Button>
      </div>

      {decisionMutation.isError ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{(decisionMutation.error as Error).message}</div> : null}

      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">대기 중인 결재</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left font-medium">신청자</th>
                  <th className="py-2 text-left font-medium">팀</th>
                  <th className="py-2 text-left font-medium">유형</th>
                  <th className="py-2 text-left font-medium">기간</th>
                  <th className="py-2 text-left font-medium">사유</th>
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
                      <td className="py-2">{formatPeriod(item)}</td>
                      <td className="max-w-[280px] truncate py-2" title={item.reason ?? ''}>
                        {item.reason ?? '-'}
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                            disabled={pending}
                            onClick={() => decisionMutation.mutate({ stepId: item.approvalStepId, decision: 'REJECTED' })}
                          >
                            반려
                          </Button>
                          <Button
                            size="sm"
                            variant="saveOutlineGreen"
                            disabled={pending}
                            onClick={() => decisionMutation.mutate({ stepId: item.approvalStepId, decision: 'APPROVED' })}
                          >
                            승인
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-sm text-slate-500" colSpan={6}>
                      대기 중인 결재가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
