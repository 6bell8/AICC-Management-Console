'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CalendarRange, ClipboardList, StickyNote, UsersRound } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import type { LeaveBalanceSummary, LeaveRequest, RequestType } from '@/app/lib/types/hr';
import type { RoomReservationSnapshot } from '@/app/lib/types/roomReservation';

type CalendarMode = 'personal' | 'team';
type CalendarEventType = 'leave' | 'trip' | 'reservation' | 'memo';

type LeaveResponse = {
  items: LeaveRequest[];
  balance: LeaveBalanceSummary;
  visibility: 'ALL' | 'TEAM' | 'SELF';
};

type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  owner: string;
  date: string;
  endDate?: string;
  requestType?: RequestType;
  status?: string;
  description?: string | null;
};

type MemoItem = {
  id: string;
  scope: 'PERSONAL' | 'TEAM';
  date: string;
  text: string;
  createdByName: string;
};

const REQUEST_LABEL: Record<RequestType, string> = {
  ANNUAL: '연차',
  AM_HALF: '오전 반차',
  PM_HALF: '오후 반차',
  SICK: '병가',
  OFFICIAL: '공가',
  COMP: '대체휴무',
  BUSINESS_TRIP: '출장',
  TRIP_EXPENSE: '출장 여비',
};

const EVENT_TONE: Record<CalendarEventType, string> = {
  leave: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  trip: 'border-sky-100 bg-sky-50 text-sky-700',
  reservation: 'border-violet-100 bg-violet-50 text-violet-700',
  memo: 'border-amber-100 bg-amber-50 text-amber-800',
};

const EVENT_LABEL: Record<CalendarEventType, string> = {
  leave: '근태',
  trip: '출장',
  reservation: '공간예약',
  memo: '메모',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '임시저장',
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
  REVOKED: '승인 취소',
};

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
    cells.push({
      date: `${year}-${String(monthRaw).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      day,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ date: '', day: null, muted: true });
  return cells;
}

function monthRange(month: string) {
  const [year, monthRaw] = month.split('-').map(Number);
  const startDate = `${year}-${String(monthRaw).padStart(2, '0')}-01`;
  const end = new Date(year, monthRaw, 0);
  const endDate = `${year}-${String(monthRaw).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  return { startDate, endDate };
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

function toDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function mapLeaveEvent(item: LeaveRequest): CalendarEvent {
  const isTrip = item.requestType === 'BUSINESS_TRIP' || item.requestType === 'TRIP_EXPENSE';
  return {
    id: item.id,
    type: isTrip ? 'trip' : 'leave',
    title: REQUEST_LABEL[item.requestType],
    owner: item.requesterName,
    date: item.startDate,
    endDate: item.endDate,
    requestType: item.requestType,
    status: item.status,
    description: item.reason,
  };
}

function eventToneClass(event: CalendarEvent) {
  if (event.requestType) {
    switch (event.requestType) {
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
        return EVENT_TONE[event.type];
    }
  }
  return EVENT_TONE[event.type];
}

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const { user, canWrite } = useCurrentUser();
  const [month, setMonth] = useState(getMonthValue());
  const [mode, setMode] = useState<CalendarMode>('personal');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [memoText, setMemoText] = useState('');
  const range = useMemo(() => monthRange(month), [month]);
  const memoScope = mode === 'personal' ? 'PERSONAL' : 'TEAM';

  const leaveQuery = useQuery<LeaveResponse>({
    queryKey: ['calendar', 'leave', month],
    queryFn: async () => {
      const res = await fetch(`/api/hr/leave?month=${month}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('근태 일정을 불러오지 못했습니다.');
      return res.json();
    },
    retry: 1,
  });

  const reservationQuery = useQuery<RoomReservationSnapshot>({
    queryKey: ['calendar', 'room-reservations', range.startDate, range.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/room-reservations?startDate=${range.startDate}&endDate=${range.endDate}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('공간 예약 일정을 불러오지 못했습니다.');
      return res.json();
    },
    retry: 1,
  });

  const memoQuery = useQuery<{ items: MemoItem[] }>({
    queryKey: ['calendar', 'memos', memoScope, month],
    queryFn: async () => {
      const res = await fetch(`/api/calendar/memos?scope=${memoScope}&month=${month}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('캘린더 메모를 불러오지 못했습니다.');
      return res.json();
    },
    retry: 1,
  });

  const memoMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !memoText.trim()) throw new Error('메모를 입력해 주세요.');
      const res = await fetch('/api/calendar/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: memoScope, date: selectedDate, text: memoText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '메모를 저장하지 못했습니다.');
      return data;
    },
    onSuccess: async () => {
      setMemoText('');
      await queryClient.invalidateQueries({ queryKey: ['calendar', 'memos'] });
    },
  });

  const leaveItems = leaveQuery.data?.items ?? [];
  const reservationItems = reservationQuery.data?.reservations ?? [];
  const memos = memoQuery.data?.items ?? [];
  const calendar = useMemo(() => buildCalendar(month), [month]);

  const events = useMemo(() => {
    const visibleLeaves = mode === 'personal' ? leaveItems.filter((item) => item.requesterId === user?.id) : leaveItems;
    const leaveEvents = visibleLeaves.map(mapLeaveEvent);
    const reservationEvents =
      mode === 'team'
        ? reservationItems
            .filter((reservation) => reservation.status !== 'CANCELLED')
            .map<CalendarEvent>((reservation) => ({
              id: reservation.id,
              type: 'reservation',
              title: reservation.resourceName,
              owner: reservation.requesterName,
              date: toDateKey(reservation.startsAt),
              status: reservation.status,
              description: `${formatTime(reservation.startsAt)}~${formatTime(reservation.endsAt)} · ${reservation.title}`,
            }))
        : [];
    const memoEvents = memos
      .map<CalendarEvent>((memo) => ({
        id: memo.id,
        type: 'memo',
        title: memo.scope === 'PERSONAL' ? '개인 메모' : '팀 메모',
        owner: memo.createdByName,
        date: memo.date,
        description: memo.text,
      }));

    return [...leaveEvents, ...reservationEvents, ...memoEvents];
  }, [leaveItems, memos, mode, reservationItems, user?.id]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const dates = event.endDate ? eachDateInRange(event.date, event.endDate) : [event.date];
      for (const date of dates) {
        map.set(date, [...(map.get(date) ?? []), event]);
      }
    }
    return map;
  }, [events]);

  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];
  const stats = useMemo(() => {
    return {
      leave: events.filter((event) => event.type === 'leave').length,
      trip: events.filter((event) => event.type === 'trip').length,
      reservation: events.filter((event) => event.type === 'reservation').length,
      memo: events.filter((event) => event.type === 'memo').length,
    };
  }, [events]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            <CalendarRange className="h-3.5 w-3.5" />
            Calendar Workspace
          </div>
          <h1 className="mt-3 text-xl font-semibold text-slate-950">캘린더</h1>
          <p className="mt-1 text-sm text-slate-500">개인 근태와 팀 운영 일정을 분리해서 확인합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="group relative inline-flex h-10 w-[132px] items-center rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40 focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100">
            <span className="pointer-events-none absolute left-3 text-slate-400 transition group-hover:text-sky-500">
              <CalendarDays className="h-4 w-4" />
            </span>
            <Input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value || getMonthValue())}
              aria-label="조회 월"
              className="h-full w-full border-0 bg-transparent pl-9 pr-1 text-sm font-semibold text-slate-700 shadow-none outline-none focus-visible:ring-0 [&::-webkit-calendar-picker-indicator]:mr-0 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:rounded-md [&::-webkit-calendar-picker-indicator]:p-0.5 [&::-webkit-calendar-picker-indicator]:opacity-45 [&::-webkit-calendar-picker-indicator]:transition [&::-webkit-calendar-picker-indicator]:hover:bg-sky-100 [&::-webkit-calendar-picker-indicator]:hover:opacity-70"
            />
          </label>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            {[
              { key: 'personal' as const, label: '내 캘린더' },
              { key: 'team' as const, label: '팀 캘린더' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMode(item.key)}
                className={['rounded-md px-3 py-1.5 text-sm font-semibold transition', mode === item.key ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryTile label="근태" value={stats.leave} tone="emerald" icon={<CalendarDays className="h-4 w-4" />} />
        <SummaryTile label="출장" value={stats.trip} tone="sky" icon={<ClipboardList className="h-4 w-4" />} />
        <SummaryTile label="공간예약" value={stats.reservation} tone="violet" icon={<UsersRound className="h-4 w-4" />} />
        <SummaryTile label="메모" value={stats.memo} tone="amber" icon={<StickyNote className="h-4 w-4" />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="soft-panel overflow-hidden p-3">
          <div className="grid grid-cols-7 rounded-lg border border-slate-100 bg-slate-50/60 text-xs">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <div key={day} className="border-b border-slate-100 bg-white px-2 py-2 text-center font-medium text-slate-500">
                {day}
              </div>
            ))}
            {calendar.map((cell, index) => {
              const dayEvents = cell.date ? eventsByDate.get(cell.date) ?? [] : [];
              const active = selectedDate === cell.date;
              return (
                <button
                  key={`${cell.date}-${index}`}
                  type="button"
                  disabled={!cell.date}
                  onClick={() => setSelectedDate(cell.date)}
                  className={[
                    'min-h-[132px] border-b border-r border-slate-100 bg-white p-2 text-left transition last:border-r-0 disabled:pointer-events-none disabled:bg-slate-50/60',
                    active ? 'bg-sky-50/70 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.9)]' : 'hover:bg-slate-50/70',
                  ].join(' ')}
                >
                  {cell.day ? (
                    <div className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-100">{cell.day}</span>
                        {dayEvents.length > 0 ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">{dayEvents.length}</span> : null}
                      </div>
                      <div className="mt-2 min-w-0 space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div key={`${event.id}-${event.type}`} className={['truncate rounded-md border px-2 py-1 text-[11px] font-semibold', eventToneClass(event)].join(' ')} title={`${event.title} · ${event.owner}`}>
                            {event.title} · {event.owner}
                          </div>
                        ))}
                        {dayEvents.length > 3 ? <div className="pl-1 text-[11px] font-semibold text-slate-400">+{dayEvents.length - 3}건</div> : null}
                      </div>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="soft-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">{selectedDate ?? '날짜를 선택하세요'}</h2>
                <p className="mt-1 text-xs text-slate-500">{mode === 'personal' ? '개인 일정과 메모' : '팀 공유 일정과 메모'}</p>
              </div>
              <span className="rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">{selectedEvents.length}건</span>
            </div>

            <div className="mt-4 space-y-2">
              {selectedEvents.length > 0 ? (
                selectedEvents.map((event) => (
                  <div key={`${event.id}-${event.type}-detail`} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={['rounded-full border px-2.5 py-1 text-xs font-semibold', eventToneClass(event)].join(' ')}>{event.requestType ? REQUEST_LABEL[event.requestType] : EVENT_LABEL[event.type]}</span>
                      {event.status ? <span className="text-[11px] font-semibold text-slate-400">{STATUS_LABEL[event.status] ?? event.status}</span> : null}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{event.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{event.owner}</div>
                    {event.description ? <div className="mt-2 whitespace-pre-line text-sm text-slate-600">{event.description}</div> : null}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-10 text-center text-sm text-slate-500">선택한 날짜에 일정이 없습니다.</div>
              )}
            </div>
          </div>

          <div className="soft-panel p-4">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-slate-950">캘린더 메모</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">선택한 날짜에 {mode === 'personal' ? '개인' : '팀'} 메모를 남깁니다.</p>
            <div className="mt-3 space-y-2">
              <Textarea value={memoText} onChange={(event) => setMemoText(event.target.value)} placeholder={canWrite ? '운영 참고사항을 입력하세요.' : '조회 권한 계정은 메모를 등록할 수 없습니다.'} className="min-h-[92px] resize-none border-slate-200 bg-white" disabled={!selectedDate || !canWrite} />
              {memoMutation.isError ? <div className="text-sm text-rose-600">{(memoMutation.error as Error).message}</div> : null}
              <Button type="button" onClick={() => memoMutation.mutate()} disabled={!selectedDate || !memoText.trim() || memoMutation.isPending || !canWrite} className="w-full">
                {memoMutation.isPending ? '저장 중...' : '메모 추가'}
              </Button>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function SummaryTile({ label, value, tone, icon }: { label: string; value: number; tone: 'emerald' | 'sky' | 'violet' | 'amber'; icon: React.ReactNode }) {
  const toneClass = {
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    sky: 'border-sky-100 bg-sky-50 text-sky-700',
    violet: 'border-violet-100 bg-violet-50 text-violet-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
  }[tone];

  return (
    <div className={['soft-interactive rounded-lg border p-3', toneClass].join(' ')}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold">{label}</div>
        <span className="opacity-80">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
