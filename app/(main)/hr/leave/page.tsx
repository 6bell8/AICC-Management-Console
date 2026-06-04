'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import { EMPLOYMENT_TYPE_LABEL, REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL, type LeaveBalanceSummary, type LeaveRequest, type RequestType } from '@/app/lib/types/hr';

type LeaveResponse = {
  items: LeaveRequest[];
  balance: LeaveBalanceSummary;
};

const REQUEST_OPTIONS: Array<{ value: RequestType; label: string }> = [
  { value: 'ANNUAL', label: '연차' },
  { value: 'SICK', label: '병가' },
  { value: 'OFFICIAL', label: '공가' },
  { value: 'COMP', label: '대체휴무' },
];

function getMonthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildCalendar(month: string) {
  const [year, monthRaw] = month.split('-').map(Number);
  const first = new Date(year, monthRaw - 1, 1);
  const last = new Date(year, monthRaw, 0);
  const cells: Array<{ date: string; day: number | null; muted?: boolean }> = [];

  for (let i = 0; i < first.getDay(); i++) cells.push({ date: '', day: null, muted: true });
  for (let day = 1; day <= last.getDate(); day++) {
    const date = `${year}-${String(monthRaw).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ date, day });
  }
  while (cells.length % 7 !== 0) cells.push({ date: '', day: null, muted: true });
  return cells;
}

function statusClass(status: LeaveRequest['status']) {
  switch (status) {
    case 'APPROVED':
      return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200';
    case 'REJECTED':
      return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
    case 'PENDING':
      return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  }
}

function isHalfDayType(type: RequestType) {
  return type === 'AM_HALF' || type === 'PM_HALF';
}

function requestCategoryValue(type: RequestType) {
  return isHalfDayType(type) ? 'ANNUAL' : type;
}

function eachDateInRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [startDate];

  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export default function LeavePage() {
  const qc = useQueryClient();
  const { canWrite, user } = useCurrentUser();
  const canViewRequestList = user?.role === 'HEAD' || user?.role === 'ADMIN';
  const [month, setMonth] = useState(getMonthValue());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [moreListDate, setMoreListDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState('');
  const [requestType, setRequestType] = useState<RequestType>('ANNUAL');
  const [reason, setReason] = useState('');

  const query = useQuery<LeaveResponse>({
    queryKey: ['hr', 'leave', month],
    queryFn: async () => {
      const res = await fetch(`/api/hr/leave?month=${month}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('연차 현황을 불러오지 못했습니다.');
      return res.json();
    },
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate) throw new Error('날짜를 선택해 주세요.');
      const normalizedEndDate = isHalfDayType(requestType) ? selectedDate : endDate || selectedDate;
      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType, startDate: selectedDate, endDate: normalizedEndDate, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '신청을 저장하지 못했습니다.');
      return data;
    },
    onSuccess: async () => {
      setSelectedDate(null);
      setEndDate('');
      setReason('');
      setRequestType('ANNUAL');
      await qc.invalidateQueries({ queryKey: ['hr', 'leave'] });
      await qc.invalidateQueries({ queryKey: ['notifications', 'counts'] });
    },
  });

  const items = query.data?.items ?? [];
  const balance = query.data?.balance;
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items]);
  const calendar = useMemo(() => buildCalendar(month), [month]);
  const byDate = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();
    for (const item of items) {
      for (const date of eachDateInRange(item.startDate, item.endDate)) {
        const list = map.get(date) ?? [];
        list.push(item);
        map.set(date, list);
      }
    }
    return map;
  }, [items]);
  const moreListItems = moreListDate ? byDate.get(moreListDate) ?? [] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">연차신청 관리 현황</h1>
          <p className="text-sm text-muted-foreground">월별 캘린더에서 날짜를 선택해 연차, 반차, 출장성 신청을 등록합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value || getMonthValue())} className="w-[170px]" />
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? '갱신 중...' : '새로고침'}
          </Button>
        </div>
      </div>

      {!canWrite ? <ReadOnlyNotice /> : null}

      {balance ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="text-sm font-medium text-emerald-800">내 잔여연차</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-900">{balance.remainingDays}일</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">고용형태</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {balance.employmentType} · {EMPLOYMENT_TYPE_LABEL[balance.employmentType]}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">연차 현황</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">부여 {balance.grantedDays}일 / 사용 {balance.usedDays}일</div>
          </div>
        </div>
      ) : null}

      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">월간 신청 캘린더</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-amber-100/80 bg-amber-50/40 text-sm shadow-sm">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <div
                key={day}
                className="border-b-2 border-r border-slate-200 bg-gradient-to-b from-slate-100 via-slate-50 to-white px-2 py-2.5 text-center text-xs font-bold text-slate-600 shadow-sm last:border-r-0"
              >
                {day}
              </div>
            ))}
            {calendar.map((cell, index) => {
              const dayItems = cell.date ? byDate.get(cell.date) ?? [] : [];
              return (
                <div
                  key={`${cell.date}-${index}`}
                  className={[
                    'group min-h-[124px] border-b border-r border-amber-100/80 p-0 text-left align-top transition last:border-r-0',
                    cell.date ? 'bg-gradient-to-br from-white via-amber-50/35 to-yellow-50/45 hover:from-amber-50 hover:to-yellow-100/50' : '',
                    cell.date && canWrite ? 'hover:shadow-[inset_0_0_0_1px_rgba(245,158,11,0.35)]' : '',
                    cell.muted ? 'bg-slate-50/70' : '',
                  ].join(' ')}
                >
                  <div className="flex h-full min-h-[124px] flex-col items-start justify-start p-2.5">
                    <div className="flex w-full items-start justify-between gap-2">
                      <button
                        type="button"
                        disabled={!cell.date || !canWrite}
                        onClick={() => {
                          setSelectedDate(cell.date);
                          setEndDate(cell.date);
                        }}
                        className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/80 px-1.5 text-xs font-semibold text-slate-700 ring-1 ring-amber-100 transition hover:bg-amber-50 disabled:cursor-default"
                        aria-label={cell.date ? `${cell.date} 신청 등록` : undefined}
                      >
                        {cell.day ?? ''}
                      </button>
                      {dayItems.length > 0 ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{dayItems.length}</span>
                      ) : null}
                    </div>

                    <div className="mt-2 w-full space-y-1">
                      {dayItems.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="truncate rounded-md bg-white/85 px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm ring-1 ring-amber-100"
                          title={`${REQUEST_TYPE_LABEL[item.requestType]} · ${item.requesterName}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {REQUEST_TYPE_LABEL[item.requestType]} · {item.requesterName}
                        </div>
                      ))}
                      {dayItems.length > 3 ? (
                        <button
                          type="button"
                          className="pl-1 text-left text-[11px] font-medium text-amber-700 hover:text-amber-900 hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMoreListDate(cell.date);
                          }}
                        >
                          +{dayItems.length - 3}건 더보기
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {canViewRequestList ? (
        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">신청 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[360px] overflow-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white text-muted-foreground shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-left font-medium">일자</th>
                    <th className="py-2 text-left font-medium">신청자</th>
                    <th className="py-2 text-left font-medium">유형</th>
                    <th className="py-2 text-left font-medium">결재자</th>
                    <th className="py-2 text-left font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60">
                      <td className="py-2">{item.startDate === item.endDate ? item.startDate : `${item.startDate} ~ ${item.endDate}`}</td>
                      <td className="py-2">{item.requesterName}</td>
                      <td className="py-2">{REQUEST_TYPE_LABEL[item.requestType]}</td>
                      <td className="py-2">{item.approverName ?? '-'}</td>
                      <td className="py-2">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs ${statusClass(item.status)}`}>{REQUEST_STATUS_LABEL[item.status]}</span>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td className="py-6 text-center text-sm text-slate-500" colSpan={5}>
                        해당 월 신청 내역이 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-slate-200 bg-slate-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">잔여연차 설정 힌트</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="font-medium text-slate-900">직급별 기본 부여</div>
            <div className="mt-1">사원/대리/과장 등 직급별 기본 연차와 근속 가산일을 정책 테이블로 관리하는 방식이 좋습니다.</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="font-medium text-slate-900">사용량 차감</div>
            <div className="mt-1">승인된 연차는 1일, 반차는 0.5일로 차감하고 반려/취소 건은 잔여일에 반영하지 않습니다.</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="font-medium text-slate-900">추천 테이블</div>
            <div className="mt-1">`leave_policies`, `leave_balances`, `leave_balance_events`로 정책, 잔여일, 차감 이력을 분리하면 확장성이 좋습니다.</div>
          </div>
        </CardContent>
      </Card>

      {moreListDate ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/35" onClick={() => setMoreListDate(null)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2">
            <Card className="border-slate-200 bg-white shadow-xl">
              <CardHeader>
                <CardTitle className="text-base">{moreListDate} 신청 내역</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-100">
                  {moreListItems.map((item) => (
                    <div key={item.id} className="border-b border-slate-100 p-3 last:border-b-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">
                            {REQUEST_TYPE_LABEL[item.requestType]} · {item.requesterName}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.startDate === item.endDate ? item.startDate : `${item.startDate} ~ ${item.endDate}`}
                          </div>
                          {item.reason ? <div className="mt-2 text-sm text-slate-600">{item.reason}</div> : null}
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${statusClass(item.status)}`}>{REQUEST_STATUS_LABEL[item.status]}</span>
                      </div>
                    </div>
                  ))}
                  {moreListItems.length === 0 ? <div className="p-6 text-center text-sm text-slate-500">표시할 신청 내역이 없습니다.</div> : null}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" onClick={() => setMoreListDate(null)}>
                    닫기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {selectedDate ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/45" onClick={() => setSelectedDate(null)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2">
            <Card className="border-slate-200 bg-white shadow-xl">
              <CardHeader>
                <CardTitle className="text-base">{selectedDate} 신청 등록</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {balance ? (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-800">
                    <div className="font-semibold">잔여연차 {balance.remainingDays}일</div>
                    <div className="mt-0.5 text-xs text-emerald-700">
                      {balance.employmentType} · {EMPLOYMENT_TYPE_LABEL[balance.employmentType]} / 부여 {balance.grantedDays}일 / 사용 {balance.usedDays}일
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <label className="text-sm font-medium">신청 유형</label>
                  <select
                    value={requestCategoryValue(requestType)}
                    onChange={(e) => {
                      const next = e.target.value as RequestType;
                      setRequestType(next);
                      if (selectedDate) setEndDate(selectedDate);
                    }}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    {REQUEST_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium">반차 기준</label>
                    <span className="text-xs text-slate-500">선택 시 기준일 하루로 신청됩니다.</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'AM_HALF' as const, label: '오전 반차' },
                      { value: 'PM_HALF' as const, label: '오후 반차' },
                    ].map((option) => {
                      const checked = requestType === option.value;
                      return (
                        <label
                          key={option.value}
                          className={[
                            'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
                            checked ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setRequestType(checked ? 'ANNUAL' : option.value);
                              if (selectedDate) setEndDate(selectedDate);
                            }}
                            className="h-4 w-4 accent-blue-600"
                          />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">시작일</label>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        setSelectedDate(nextStart);
                        if (!endDate || endDate < nextStart || isHalfDayType(requestType)) setEndDate(nextStart);
                      }}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">종료일</label>
                    <Input
                      type="date"
                      value={isHalfDayType(requestType) ? selectedDate : endDate || selectedDate}
                      min={selectedDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={isHalfDayType(requestType)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">사유</label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="필요 시 사유를 입력해 주세요." className="min-h-[96px]" />
                </div>
                {createMutation.isError ? <div className="text-sm text-rose-600">{(createMutation.error as Error).message}</div> : null}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedDate(null)} disabled={createMutation.isPending}>
                    취소
                  </Button>
                  <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                    {createMutation.isPending ? '신청 중...' : '신청'}
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
