'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { RichSelect } from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import type { LeaveBalanceSummary, LeaveRequest, RequestType } from '@/app/lib/types/hr';

type LeaveResponse = {
  items: LeaveRequest[];
  balance: LeaveBalanceSummary;
  visibility: 'ALL' | 'TEAM' | 'SELF';
};

const REQUEST_OPTIONS: Array<{ value: RequestType; label: string }> = [
  { value: 'BUSINESS_TRIP', label: '출장 신청' },
  { value: 'ANNUAL', label: '연차' },
  { value: 'SICK', label: '병가' },
  { value: 'OFFICIAL', label: '공가' },
  { value: 'COMP', label: '대체휴무' },
];

const REQUEST_LABEL: Record<RequestType, string> = {
  ANNUAL: '연차',
  AM_HALF: '오전 반차',
  PM_HALF: '오후 반차',
  SICK: '병가',
  OFFICIAL: '공가',
  COMP: '대체휴무',
  BUSINESS_TRIP: '출장 신청',
  TRIP_EXPENSE: '출장 여비',
};

const STATUS_LABEL: Record<LeaveRequest['status'], string> = {
  DRAFT: '임시저장',
  PENDING: '결재 대기',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
  REVOKED: '승인 취소',
};

const NOTION_APPROVAL_CALENDAR_URL =
  'https://app.notion.com/p/37652247bcaa804f85fef7322c8e10ad?v=37652247bcaa80319bcf000cfd387852';

function getMonthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildCalendar(month: string) {
  const [year, monthRaw] = month.split('-').map(Number);
  const first = new Date(year, monthRaw - 1, 1);
  const last = new Date(year, monthRaw, 0);
  const cells: Array<{ date: string; day: number | null; muted?: boolean }> = [];

  for (let i = 0; i < first.getDay(); i += 1) cells.push({ date: '', day: null, muted: true });
  for (let day = 1; day <= last.getDate(); day += 1) {
    cells.push({
      date: `${year}-${String(monthRaw).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      day,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ date: '', day: null, muted: true });
  return cells;
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

function requestToneClass(type: RequestType) {
  switch (type) {
    case 'ANNUAL':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700';
    case 'AM_HALF':
    case 'PM_HALF':
      return 'border-sky-100 bg-sky-50 text-sky-700';
    case 'SICK':
      return 'border-zinc-200 bg-zinc-50 text-zinc-600';
    case 'OFFICIAL':
      return 'border-violet-100 bg-violet-50 text-violet-700';
    case 'COMP':
      return 'border-amber-100 bg-amber-50 text-amber-800';
    case 'BUSINESS_TRIP':
      return 'border-cyan-100 bg-cyan-50 text-cyan-700';
    case 'TRIP_EXPENSE':
      return 'border-slate-200 bg-slate-50 text-slate-600';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function isHalfDayType(type: RequestType) {
  return type === 'AM_HALF' || type === 'PM_HALF';
}

function requestCategoryValue(type: RequestType) {
  return isHalfDayType(type) ? 'ANNUAL' : type;
}

function formatPeriod(item: LeaveRequest) {
  return item.startDate === item.endDate ? item.startDate : `${item.startDate} ~ ${item.endDate}`;
}

export default function LeavePage() {
  const qc = useQueryClient();
  const { canWrite } = useCurrentUser();
  const [month, setMonth] = useState(getMonthValue());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [moreListDate, setMoreListDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState('');
  const [requestType, setRequestType] = useState<RequestType>('ANNUAL');
  const [reason, setReason] = useState('');
  const [tripPurpose, setTripPurpose] = useState('');
  const [tripPlace, setTripPlace] = useState('');

  const query = useQuery<LeaveResponse>({
    queryKey: ['hr', 'leave', month],
    queryFn: async () => {
      const res = await fetch(`/api/hr/leave?month=${month}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('근태 현황을 불러오지 못했습니다.');
      return res.json();
    },
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate) throw new Error('날짜를 선택해 주세요.');
      const normalizedEndDate = isHalfDayType(requestType) ? selectedDate : endDate || selectedDate;
      const normalizedReason =
        requestType === 'BUSINESS_TRIP'
          ? `출장 날짜: ${selectedDate === normalizedEndDate ? selectedDate : `${selectedDate} ~ ${normalizedEndDate}`}\n출장 목적: ${tripPurpose.trim()}\n출장 장소: ${tripPlace.trim()}`
          : reason;

      if (requestType === 'BUSINESS_TRIP' && (!tripPurpose.trim() || !tripPlace.trim())) {
        throw new Error('출장 신청은 목적과 장소를 필수로 입력해야 합니다.');
      }

      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType, startDate: selectedDate, endDate: normalizedEndDate, reason: normalizedReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '신청을 저장하지 못했습니다.');
      return data;
    },
    onSuccess: async () => {
      setSelectedDate(null);
      setEndDate('');
      setReason('');
      setTripPurpose('');
      setTripPlace('');
      setRequestType('ANNUAL');
      await qc.invalidateQueries({ queryKey: ['hr', 'leave'] });
      await qc.invalidateQueries({ queryKey: ['notifications', 'counts'] });
    },
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const balance = query.data?.balance;
  const calendar = useMemo(() => buildCalendar(month), [month]);
  const sortedItems = useMemo(() => [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [items]);
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
  const canViewRequestList = query.data?.visibility === 'ALL' || query.data?.visibility === 'TEAM';
  const showInitialSkeleton = query.isLoading && !query.data;

  const openRequestModal = (date: string) => {
    if (!date || !canWrite) return;
    setSelectedDate(date);
    setEndDate(date);
  };

  const openRequestModalOnMobile = (date: string) => {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 639px)').matches) return;
    openRequestModal(date);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">근태관리</h1>
          <p className="text-sm text-muted-foreground">월별 캘린더에서 날짜를 선택해 근태 신청을 등록합니다.</p>
        </div>
        <div className="flex w-full items-center justify-end gap-2 self-end sm:w-auto">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || getMonthValue())}
            className="!w-[176px] border-slate-200 bg-white/90 px-3 font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40 focus-visible:border-sky-300 focus-visible:ring-sky-100 sm:!w-[152px] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:rounded-md [&::-webkit-calendar-picker-indicator]:p-1 [&::-webkit-calendar-picker-indicator]:opacity-45 [&::-webkit-calendar-picker-indicator]:transition [&::-webkit-calendar-picker-indicator]:hover:bg-sky-100 [&::-webkit-calendar-picker-indicator]:hover:opacity-70"
          />
        </div>
      </div>

      {!canWrite ? <ReadOnlyNotice /> : null}
      {showInitialSkeleton ? <LeavePageSkeleton /> : null}

      {!showInitialSkeleton ? (
        <>
          <section className="rounded-lg border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-sky-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-semibold">Notion 캘린더 연동 안내</div>
                <p className="mt-1 text-sky-800">근태 신청이 승인되면 Notion 근태 데이터베이스에 자동 등록되고, 신청 기간은 날짜 속성에 바인딩됩니다.</p>
              </div>
              <a
                href={NOTION_APPROVAL_CALENDAR_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Notion 캘린더
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </section>

          {balance ? (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="min-w-0 rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 sm:p-4">
                <div className="truncate text-[11px] font-medium text-emerald-800 sm:text-sm">내 잔여연차</div>
                <div className="mt-1 truncate text-lg font-semibold text-emerald-900 sm:text-2xl">{balance.remainingDays}일</div>
              </div>
              <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
                <div className="truncate text-[11px] text-slate-500 sm:text-sm">고용형태</div>
                <div className="mt-1 truncate text-base font-semibold text-slate-900 sm:text-lg">{balance.employmentType === 'P' ? '정규직' : '계약직'}</div>
              </div>
              <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
                <div className="truncate text-[11px] text-slate-500 sm:text-sm">연차 현황</div>
                <div className="mt-1 text-[13px] font-semibold leading-5 text-slate-900 sm:text-lg">
                  총 {balance.grantedDays} · 잔여 {balance.remainingDays}
                </div>
              </div>
            </div>
          ) : null}

          <section className="soft-panel p-3">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">월간 신청 캘린더</h2>
                <p className="mt-1 text-xs text-slate-500">날짜를 선택해 근태 신청을 등록하고 월간 신청 현황을 확인합니다.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">신청 {items.length}건</span>
                <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">잔여 {balance?.remainingDays ?? 0}일</span>
              </div>
            </div>
            <div className="mx-auto w-full">
              <div className="mx-auto grid grid-cols-7 overflow-hidden rounded-lg border border-slate-100 bg-slate-50/60 text-sm">
                {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                  <div key={day} className="border-b border-r border-slate-100 bg-white px-2 py-2 text-center text-xs font-medium text-slate-500 last:border-r-0">
                    {day}
                  </div>
                ))}
                {calendar.map((cell, index) => {
                  const dayItems = cell.date ? byDate.get(cell.date) ?? [] : [];
                  return (
                    <div
                      key={`${cell.date}-${index}`}
                      onClick={() => openRequestModalOnMobile(cell.date)}
                      className={[
                        'group min-h-[86px] border-b border-r border-slate-100 p-0 text-left align-top transition last:border-r-0 sm:min-h-[132px]',
                        cell.date ? 'bg-white hover:bg-slate-50/70' : '',
                        cell.date && canWrite ? 'cursor-pointer hover:shadow-[inset_0_0_0_1px_rgba(125,211,252,0.75)] sm:cursor-default' : '',
                        cell.muted ? 'bg-slate-50/60' : '',
                      ].join(' ')}
                    >
                      <div className="flex h-full min-h-[86px] flex-col items-center justify-start p-1.5 sm:min-h-[132px] sm:items-start sm:p-2">
                        <div className="flex w-full items-start justify-center gap-2 sm:justify-between">
                          <button
                            type="button"
                            disabled={!cell.date || !canWrite}
                            onClick={() => openRequestModal(cell.date)}
                            className="inline-flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:bg-sky-50 hover:text-sky-700 hover:ring-sky-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:bg-white disabled:hover:text-slate-700 disabled:hover:shadow-none"
                            aria-label={cell.date ? `${cell.date} 신청 등록` : undefined}
                          >
                            {cell.day ?? ''}
                          </button>
                          {dayItems.length > 0 ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">{dayItems.length}</span> : null}
                        </div>

                        <div className="mt-2 hidden w-full space-y-1 sm:block">
                          {dayItems.slice(0, 3).map((item) => (
                            <div
                              key={item.id}
                              className={['truncate rounded-md border px-2 py-1 text-[11px] font-semibold', requestToneClass(item.requestType)].join(' ')}
                              title={`${REQUEST_LABEL[item.requestType]} - ${item.requesterName}`}
                            >
                              {REQUEST_LABEL[item.requestType]} - {item.requesterName}
                            </div>
                          ))}
                          {dayItems.length > 3 ? (
                            <button
                              type="button"
                              className="pl-1 text-left text-[11px] font-semibold text-slate-400 hover:text-sky-700 hover:underline"
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
            </div>
          </section>

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
                          <td className="py-2">{formatPeriod(item)}</td>
                          <td className="py-2">{item.requesterName}</td>
                          <td className="py-2">{REQUEST_LABEL[item.requestType]}</td>
                          <td className="py-2">{item.approverName ?? '-'}</td>
                          <td className="py-2">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs ${statusClass(item.status)}`}>{STATUS_LABEL[item.status]}</span>
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
                                {REQUEST_LABEL[item.requestType]} - {item.requesterName}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{formatPeriod(item)}</div>
                              {item.reason ? <div className="mt-2 whitespace-pre-line text-sm text-slate-600">{item.reason}</div> : null}
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${statusClass(item.status)}`}>{STATUS_LABEL[item.status]}</span>
                          </div>
                        </div>
                      ))}
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
              <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]" onClick={() => setSelectedDate(null)} />
              <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2">
                <Card className="border-sky-100 bg-white shadow-2xl shadow-slate-200/70">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/60">
                    <CardTitle className="text-base text-slate-950">{selectedDate} 신청 등록</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {balance ? (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-800">
                        <div className="font-semibold">잔여연차 {balance.remainingDays}일</div>
                        <div className="mt-0.5 text-xs text-emerald-700">
                          부여 {balance.grantedDays}일 / 사용 {balance.usedDays}일
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-2">
                      <label className="text-sm font-medium">신청 유형</label>
                      <RichSelect
                        value={requestCategoryValue(requestType)}
                        onChange={(value) => {
                          const next = value as RequestType;
                          setRequestType(next);
                          if (selectedDate) setEndDate(selectedDate);
                        }}
                        options={REQUEST_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                        buttonClassName="min-h-10 rounded-md border-slate-200 px-3 text-sm"
                      />
                    </div>

                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-medium">반차 기준</label>
                        <span className="text-xs text-slate-500">선택한 날짜 하루로 신청합니다.</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'AM_HALF' as const, label: '오전 반차' },
                          { value: 'PM_HALF' as const, label: '오후 반차' },
                        ].map((option) => {
                          const checked = requestType === option.value;
                          return (
                            <label key={option.value} className={['flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition', checked ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'].join(' ')}>
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
                          className="border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-sky-200 focus-visible:border-sky-300 focus-visible:ring-sky-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:rounded-md [&::-webkit-calendar-picker-indicator]:p-1 [&::-webkit-calendar-picker-indicator]:opacity-45 [&::-webkit-calendar-picker-indicator]:transition [&::-webkit-calendar-picker-indicator]:hover:bg-sky-100 [&::-webkit-calendar-picker-indicator]:hover:opacity-70"
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
                          className="border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-sky-200 focus-visible:border-sky-300 focus-visible:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-400 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:rounded-md [&::-webkit-calendar-picker-indicator]:p-1 [&::-webkit-calendar-picker-indicator]:opacity-45 [&::-webkit-calendar-picker-indicator]:transition [&::-webkit-calendar-picker-indicator]:hover:bg-sky-100 [&::-webkit-calendar-picker-indicator]:hover:opacity-70"
                        />
                      </div>
                    </div>

                    {requestType === 'BUSINESS_TRIP' ? (
                      <div className="grid gap-3 rounded-lg border border-sky-100 bg-sky-50/50 p-3">
                        <div className="text-sm font-semibold text-sky-900">출장 신청 정보</div>
                        <div className="grid gap-2">
                          <label className="text-sm font-medium text-slate-700">출장 날짜</label>
                          <Input value={selectedDate === (endDate || selectedDate) ? selectedDate : `${selectedDate} ~ ${endDate || selectedDate}`} readOnly className="border-slate-200 bg-white/80 text-slate-700 shadow-sm focus-visible:border-sky-300 focus-visible:ring-sky-100" />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-sm font-medium text-slate-700">
                            출장 목적 <span className="text-rose-500">*</span>
                          </label>
                          <Input value={tripPurpose} onChange={(e) => setTripPurpose(e.target.value)} placeholder="출장 목적을 입력하세요" className="border-slate-200 bg-white text-slate-700 shadow-sm transition placeholder:text-slate-400 hover:border-sky-200 focus-visible:border-sky-300 focus-visible:ring-sky-100" />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-sm font-medium text-slate-700">
                            출장 장소 <span className="text-rose-500">*</span>
                          </label>
                          <Input value={tripPlace} onChange={(e) => setTripPlace(e.target.value)} placeholder="출장 장소를 입력하세요" className="border-slate-200 bg-white text-slate-700 shadow-sm transition placeholder:text-slate-400 hover:border-sky-200 focus-visible:border-sky-300 focus-visible:ring-sky-100" />
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">사유</label>
                        <Textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="필요 시 사유를 입력해 주세요"
                          className="min-h-[96px] resize-none border-slate-200 bg-white text-slate-700 shadow-sm transition placeholder:text-slate-400 hover:border-sky-200 focus-visible:border-sky-300 focus-visible:ring-sky-100"
                        />
                      </div>
                    )}

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
        </>
      ) : null}
    </div>
  );
}

function LeavePageSkeleton() {
  return (
    <div className="space-y-5" aria-label="근태관리 로딩 중">
      <section className="rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-sky-100" />
            <div className="h-3 w-80 max-w-full animate-pulse rounded bg-sky-100/80" />
          </div>
          <div className="h-9 w-28 animate-pulse rounded-md bg-white/80" />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 h-7 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <section className="soft-panel p-3">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-72 max-w-full animate-pulse rounded bg-slate-100" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-20 animate-pulse rounded-full bg-slate-100" />
            <div className="h-7 w-20 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
        <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-100 bg-white">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={`head-${index}`} className="border-b border-r border-slate-100 px-2 py-2 last:border-r-0">
              <div className="mx-auto h-3 w-5 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
          {Array.from({ length: 35 }).map((_, index) => (
            <div key={index} className="min-h-[132px] border-b border-r border-slate-100 p-2 last:border-r-0">
              <div className="flex items-start justify-between">
                <div className="h-6 w-6 animate-pulse rounded-full bg-slate-100" />
                <div className="h-4 w-8 animate-pulse rounded-full bg-slate-100" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-5 w-4/5 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-5">
              {Array.from({ length: 5 }).map((__, cellIndex) => (
                <div key={cellIndex} className="h-4 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
