'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, Gift, MapPin, Search, Send, ShieldCheck } from 'lucide-react';

import { Skeleton } from '@/app/components/ui/skeleton';
import type { FamilyEventRequest, FamilyEventType } from '@/app/lib/types/familyEvent';

type FamilyEventResponse = {
  items: FamilyEventRequest[];
  canCreate: boolean;
};

const EVENT_OPTIONS: Array<{ value: FamilyEventType; label: string }> = [
  { value: 'MARRIAGE', label: '결혼' },
  { value: 'BIRTH', label: '출산' },
  { value: 'FUNERAL', label: '조의' },
  { value: 'FIRST_BIRTHDAY', label: '돌잔치' },
  { value: 'HOSPITAL', label: '입원/위로' },
  { value: 'OTHER', label: '기타' },
];

const EVENT_LABEL: Record<FamilyEventType, string> = Object.fromEntries(EVENT_OPTIONS.map((item) => [item.value, item.label])) as Record<FamilyEventType, string>;

const PAGE_SIZE = 5;

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function FamilyEventsPage() {
  const qc = useQueryClient();
  const [eventType, setEventType] = useState<FamilyEventType>('MARRIAGE');
  const [relation, setRelation] = useState('');
  const [eventDate, setEventDate] = useState(today());
  const [location, setLocation] = useState('');
  const [wreathRequired, setWreathRequired] = useState(false);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery<FamilyEventResponse>({
    queryKey: ['hr', 'family-events'],
    queryFn: async () => {
      const res = await fetch('/api/hr/family-events', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '경조사 목록을 불러오지 못했습니다.');
      return body;
    },
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/family-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          relation,
          eventDate,
          location,
          wreathRequired,
          note,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '경조사 신청을 저장하지 못했습니다.');
      return body;
    },
    onSuccess: async () => {
      setRelation('');
      setEventDate(today());
      setLocation('');
      setWreathRequired(false);
      setNote('');
      await qc.invalidateQueries({ queryKey: ['hr', 'family-events'] });
    },
  });

  const items = query.data?.items ?? [];
  const canCreate = Boolean(query.data?.canCreate);
  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => {
      const haystack = [
        EVENT_LABEL[item.eventType],
        item.requesterName,
        item.teamName ?? '',
        item.relation,
        item.eventDate,
        item.location,
        item.note,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [items, search]);
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedItems = filteredItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filteredItems.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filteredItems.length, safePage * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div>
        <div>
          <h1 className="text-xl font-semibold text-slate-950">경조사 관리</h1>
          <p className="mt-1 text-sm text-slate-500">임직원 경조사 신청과 지원 처리 상태를 관리합니다.</p>
        </div>
      </div>

      <section className={['grid gap-4', canCreate ? 'xl:grid-cols-[360px_1fr]' : ''].join(' ')}>
        {canCreate ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
            className="soft-panel space-y-4 p-4"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-amber-100 bg-amber-50 text-amber-700">
                <Gift className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-950">경조사 등록</h2>
                <p className="text-xs text-slate-500">임직원들의 경조사를 등록해 주세요.</p>
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">경조 유형</span>
              <select value={eventType} onChange={(event) => setEventType(event.target.value as FamilyEventType)} className="form-input">
                {EVENT_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">관계/대상</span>
                <input value={relation} onChange={(event) => setRelation(event.target.value)} className="form-input" placeholder="예: 솔루션사업팀 대리 OOO" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">일자</span>
                <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="form-input" required />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">장소</span>
              <input value={location} onChange={(event) => setLocation(event.target.value)} className="form-input" placeholder="예: 예식장, 장례식장, 병원" />
            </label>

            <div className="-mt-2 flex justify-end">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                <input type="checkbox" checked={wreathRequired} onChange={(event) => setWreathRequired(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-sky-600" />
                화환/조화 필요
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">메모</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} className="form-input min-h-24 resize-y py-2" placeholder="증빙, 요청사항, 참고사항" />
            </label>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-sky-100 bg-sky-50 px-3 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {createMutation.isPending ? '등록 중' : '경조사 등록'}
            </button>
            {createMutation.error ? <p className="text-sm text-rose-600">{createMutation.error.message}</p> : null}
          </form>
        ) : null}

        <div className="soft-panel overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">경조사 목록</h2>
              <p className="mt-0.5 text-xs text-slate-500">등록된 임직원 경조사를 일정과 장소 중심으로 확인합니다.</p>
            </div>
            <div className="relative w-full sm:w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="유형, 이름, 장소 검색"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-sky-100 focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {query.isLoading ? (
              <FamilyEventListSkeleton />
            ) : pagedItems.length > 0 ? (
              pagedItems.map((item) => (
                <div key={item.id} className="px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-950">{EVENT_LABEL[item.eventType]}</span>
                        {item.wreathRequired ? <span className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">화환/조화</span> : null}
                      </div>
                      <div className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 sm:justify-end sm:text-right">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        <span>{formatDate(item.eventDate)} · {item.relation || '-'}</span>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                        {item.requesterName} · {item.teamName ?? '팀 미지정'}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {item.location || '-'}
                      </span>
                    </div>
                    {item.note ? <p className="mt-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{item.note}</p> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-slate-500">조건에 맞는 경조사 항목이 없습니다.</div>
            )}
          </div>
          {!query.isLoading && filteredItems.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-medium text-slate-500">
                {rangeStart}-{rangeEnd} / {filteredItems.length}건
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                  className="soft-interactive inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 disabled:pointer-events-none disabled:opacity-40"
                  aria-label="이전 페이지"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-14 text-center text-xs font-semibold text-slate-600">
                  {safePage} / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={safePage >= pageCount}
                  className="soft-interactive inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 disabled:pointer-events-none disabled:opacity-40"
                  aria-label="다음 페이지"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function FamilyEventListSkeleton() {
  return (
    <>
      {Array.from({ length: PAGE_SIZE }, (_, index) => (
        <div key={index} className="px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16" />
                {index % 2 === 0 ? <Skeleton className="h-5 w-16 rounded-full" /> : null}
              </div>
              <Skeleton className="h-4 w-36 sm:ml-auto" />
            </div>
            <div className="mt-2 grid gap-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="mt-2 h-10 w-full" />
          </div>
        </div>
      ))}
    </>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${year}.${month}.${day}`;
}
