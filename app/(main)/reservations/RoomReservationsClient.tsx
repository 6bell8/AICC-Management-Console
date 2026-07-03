'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarDays, Clock3, GraduationCap, Plus, Trash2, Users, X } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { RichSelect } from '@/app/components/ui/select';
import type { AuthUser } from '@/app/lib/db/users';
import type { RoomReservation, RoomReservationSnapshot, RoomResource, RoomResourceType } from '@/app/lib/types/roomReservation';

const RESOURCE_TYPE_LABEL: Record<RoomResourceType, string> = {
  MEETING_ROOM: '회의실',
  TRAINING_ROOM: '교육장',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  APPROVED: '예약',
  CANCELLED: '취소',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border-slate-200 bg-slate-50 text-slate-500',
};

const inputClass =
  'h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-100';

type ResourceForm = {
  name: string;
  type: RoomResourceType;
  location: string;
  capacity: number;
  description: string;
};

type ReservationForm = {
  resourceId: string;
  title: string;
  purpose: string;
  startsAt: string;
  endsAt: string;
};

type ReservationView = 'manage' | 'board' | 'weekly';
type ConfirmDialog = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
};

const VIEW_LABEL: Record<ReservationView, string> = {
  manage: '공간 관리',
  board: '공간 예약보드',
  weekly: '주간 타임라인',
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toDateTimeLocal(date: string, time: string) {
  return `${date}T${time}`;
}

function toDateKey(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekDays(dateKey: string) {
  const base = new Date(`${dateKey}T00:00:00`);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      key: toDateKey(date),
      label: new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(date),
      day: date.getDate(),
    };
  });
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function isSameDate(value: string, dateKey: string) {
  return toDateKey(new Date(value)) === dateKey;
}

async function fetchSnapshot(date: string, weekStart: string, weekEnd: string): Promise<RoomReservationSnapshot> {
  const params = new URLSearchParams({ date, startDate: weekStart, endDate: weekEnd });
  const res = await fetch(`/api/room-reservations?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('예약 현황을 불러오지 못했습니다.');
  return res.json();
}

export default function RoomReservationsClient({
  initialData,
  currentUser,
  initialDate,
}: {
  initialData: RoomReservationSnapshot;
  currentUser: AuthUser;
  initialDate: string;
}) {
  const qc = useQueryClient();
  const canManageResources = currentUser.role === 'HEAD';
  const canReserve = currentUser.role !== 'VIEWER';
  const [selectedDate, setSelectedDate] = useState(initialDate || today());
  const [activeView, setActiveView] = useState<ReservationView>('manage');
  const [message, setMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [resourceForm, setResourceForm] = useState<ResourceForm>({
    name: '',
    type: 'MEETING_ROOM',
    location: '',
    capacity: 6,
    description: '',
  });
  const [reservationForm, setReservationForm] = useState<ReservationForm>({
    resourceId: initialData.resources[0]?.id ?? '',
    title: '',
    purpose: '',
    startsAt: toDateTimeLocal(initialDate || today(), '09:00'),
    endsAt: toDateTimeLocal(initialDate || today(), '10:00'),
  });
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const weekStart = weekDays[0]?.key ?? selectedDate;
  const weekEnd = weekDays[6]?.key ?? selectedDate;

  const query = useQuery({
    queryKey: ['room-reservations', selectedDate, weekStart, weekEnd],
    queryFn: () => fetchSnapshot(selectedDate, weekStart, weekEnd),
    initialData,
    staleTime: 10_000,
  });
  const data = query.data;
  const selectedDateReservations = useMemo(
    () => data.reservations.filter((item) => item.status !== 'CANCELLED' && (isSameDate(item.startsAt, selectedDate) || isSameDate(item.endsAt, selectedDate))),
    [data.reservations, selectedDate],
  );

  const reservationsByResource = useMemo(() => {
    const grouped = new Map<string, RoomReservation[]>();
    for (const reservation of selectedDateReservations) {
      grouped.set(reservation.resourceId, [...(grouped.get(reservation.resourceId) ?? []), reservation]);
    }
    return grouped;
  }, [selectedDateReservations]);

  const summary = useMemo(() => {
    return {
      resources: data.resources.length,
      meetingRooms: data.resources.filter((item) => item.type === 'MEETING_ROOM').length,
      trainingRooms: data.resources.filter((item) => item.type === 'TRAINING_ROOM').length,
      reservations: selectedDateReservations.length,
    };
  }, [data.resources, selectedDateReservations]);

  const createResourceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/room-reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createResource', ...resourceForm }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '공간을 등록하지 못했습니다.');
    },
    onSuccess: async () => {
      setMessage('공간이 등록되었습니다.');
      setResourceForm({ name: '', type: 'MEETING_ROOM', location: '', capacity: 6, description: '' });
      await qc.invalidateQueries({ queryKey: ['room-reservations'] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : '공간을 등록하지 못했습니다.'),
  });

  const createReservationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/room-reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createReservation', ...reservationForm }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '예약을 등록하지 못했습니다.');
    },
    onSuccess: async () => {
      setMessage('예약이 등록되었습니다.');
      setReservationForm((prev) => ({ ...prev, title: '', purpose: '' }));
      await qc.invalidateQueries({ queryKey: ['room-reservations'] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : '예약을 등록하지 못했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'resource' | 'reservation'; id: string }) => {
      const res = await fetch(`/api/room-reservations?type=${type}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '처리하지 못했습니다.');
    },
    onSuccess: async (_, variables) => {
      setMessage(variables.type === 'resource' ? '공간이 삭제되었습니다.' : '예약이 취소되었습니다.');
      await qc.invalidateQueries({ queryKey: ['room-reservations'] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : '처리하지 못했습니다.'),
  });

  function selectDate(date: string) {
    setSelectedDate(date);
    setReservationForm((prev) => ({
      ...prev,
      startsAt: toDateTimeLocal(date, '09:00'),
      endsAt: toDateTimeLocal(date, '10:00'),
    }));
  }

  function selectResource(resource: RoomResource) {
    setReservationForm((prev) => ({ ...prev, resourceId: resource.id }));
  }

  function requestConfirm(dialog: ConfirmDialog) {
    setConfirmDialog(dialog);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">공간 예약</h1>
          <p className="mt-1 text-sm text-slate-500">공간별 예약을 시간순으로 확인하고 필요한 공간을 예약합니다.</p>
        </div>
        <div className="flex w-full sm:w-auto sm:justify-end">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => selectDate(e.target.value)}
            className={`${inputClass} sm:w-[220px]`}
          />
        </div>
      </div>

      <section className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-4 md:gap-3 md:overflow-visible md:px-0 md:pb-0">
        <Metric label="운영 공간" value={`${summary.resources}개`} icon={<Building2 className="h-4 w-4" />} />
        <Metric label="회의실" value={`${summary.meetingRooms}개`} icon={<Users className="h-4 w-4" />} />
        <Metric label="교육장" value={`${summary.trainingRooms}개`} icon={<GraduationCap className="h-4 w-4" />} />
        <Metric label="선택일 예약" value={`${summary.reservations}건`} icon={<CalendarDays className="h-4 w-4" />} />
      </section>

      <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:flex sm:flex-wrap">
        {(Object.keys(VIEW_LABEL) as ReservationView[]).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setActiveView(view)}
            className={[
               'rounded-md px-3 py-2 text-center text-sm font-medium leading-5 break-keep transition max-[480px]:text-xs',
              activeView === view
                ? 'bg-slate-900 text-white shadow-sm'
                : 'border border-slate-200 bg-slate-50/70 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900',
            ].join(' ')}
          >
            {VIEW_LABEL[view]}
          </button>
        ))}
      </div>

      {activeView === 'manage' ? (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">


          <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">공간 관리</h2>
                <p className="mt-1 text-sm text-slate-500">회의실과 교육장 등록/삭제는 HEAD 계정만 가능합니다.</p>
              </div>
            </div>
            {canManageResources ? (
              <div className="mt-4 grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_140px_96px] xl:grid-cols-[minmax(0,1fr)_140px_96px_minmax(0,1fr)_auto]">
                <input value={resourceForm.name} onChange={(e) => setResourceForm((prev) => ({ ...prev, name: e.target.value }))} className={inputClass} placeholder="공간명" />
                <RichSelect
                  value={resourceForm.type}
                  onChange={(value) => setResourceForm((prev) => ({ ...prev, type: value as RoomResourceType }))}
                  options={[
                    { value: 'MEETING_ROOM', label: '회의실' },
                    { value: 'TRAINING_ROOM', label: '교육장' },
                  ]}
                  buttonClassName={`${inputClass} max-[480px]:h-12 max-[480px]:text-base`}
                />
                <input
                  type="number"
                  min={1}
                  value={resourceForm.capacity}
                  onChange={(e) => setResourceForm((prev) => ({ ...prev, capacity: Number(e.target.value) }))}
                  className={inputClass}
                  placeholder="정원"
                />
                <input value={resourceForm.location} onChange={(e) => setResourceForm((prev) => ({ ...prev, location: e.target.value }))} className={inputClass} placeholder="위치" />
                <Button variant="saveOutline" onClick={() => createResourceMutation.mutate()} disabled={!resourceForm.name.trim() || createResourceMutation.isPending}>
                  등록
                </Button>
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">공간 목록은 조회만 가능합니다.</div>
            )}
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {data.resources.map((resource) => (
                <button
                  type="button"
                  key={resource.id}
                  onClick={() => selectResource(resource)}
                  className={[
                    'rounded-md border p-3 text-left transition',
                    reservationForm.resourceId === resource.id ? 'border-sky-200 bg-sky-50/70' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-900">{resource.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {RESOURCE_TYPE_LABEL[resource.type]} · {resource.capacity}명 · {resource.location || '위치 미지정'}
                      </div>
                    </div>
                    {canManageResources ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          requestConfirm({
                            title: '공간을 삭제할까요?',
                            description: `${resource.name}과 연결된 예약 내역이 함께 정리됩니다.`,
                            confirmLabel: '공간 삭제',
                            tone: 'danger',
                            onConfirm: () => deleteMutation.mutate({ type: 'resource', id: resource.id }),
                          });
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.stopPropagation();
                            deleteMutation.mutate({ type: 'resource', id: resource.id });
                          }
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100"
                        title="공간 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
              {data.resources.length === 0 ? <div className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 md:col-span-2">등록된 공간이 없습니다.</div> : null}
            </div>
          </div>
          <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">예약 등록</h2>
                <p className="mt-1 text-sm text-slate-500">공간과 시간을 선택하면 겹치는 예약은 자동으로 차단됩니다.</p>
              </div>
            </div>
            {!canReserve ? <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">VIEWER 권한은 예약을 조회만 할 수 있습니다.</div> : null}
            <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
              <label className="min-w-0 space-y-1 text-sm">
                <span className="text-slate-600">공간</span>
                <RichSelect
                  value={reservationForm.resourceId}
                  onChange={(value) => setReservationForm((prev) => ({ ...prev, resourceId: value }))}
                  options={data.resources.map((resource) => ({
                    value: resource.id,
                    label: resource.name,
                    description: `${RESOURCE_TYPE_LABEL[resource.type]} · ${resource.capacity}명${resource.location ? ` · ${resource.location}` : ''}`,
                  }))}
                  placeholder="공간 선택"
                  emptyText="등록된 공간이 없습니다."
                  buttonClassName={`${inputClass} max-[480px]:h-12 max-[480px]:text-base`}
                  disabled={!canReserve}
                />
              </label>
              <label className="min-w-0 space-y-1 text-sm">
                <span className="text-slate-600">제목</span>
                <input
                    value={reservationForm.title}
                    onChange={(e) => setReservationForm((prev) => ({ ...prev, title: e.target.value }))}
                    className={inputClass}
                    placeholder="예: AICC 주간 회의"
                    disabled={!canReserve}
                />
              </label>
              <label className="min-w-0 space-y-1 text-sm">
                <span className="text-slate-600">시작</span>
                <input
                    type="datetime-local"
                    value={reservationForm.startsAt}
                    onChange={(e) => setReservationForm((prev) => ({ ...prev, startsAt: e.target.value }))}
                    className={inputClass}
                    disabled={!canReserve}
                />
              </label>
              <label className="min-w-0 space-y-1 text-sm">
                <span className="text-slate-600">종료</span>
                <input
                    type="datetime-local"
                    value={reservationForm.endsAt}
                    onChange={(e) => setReservationForm((prev) => ({ ...prev, endsAt: e.target.value }))}
                    className={inputClass}
                    disabled={!canReserve}
                />
              </label>
              <label className="min-w-0 space-y-1 text-sm md:col-span-2">
                <span className="text-slate-600">목적</span>
                <input
                    value={reservationForm.purpose}
                    onChange={(e) => setReservationForm((prev) => ({ ...prev, purpose: e.target.value }))}
                    className={inputClass}
                    placeholder="회의 목적이나 참석 범위를 입력해 주세요."
                    disabled={!canReserve}
                />
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                  onClick={() => createReservationMutation.mutate()}
                  disabled={!canReserve || !reservationForm.resourceId || !reservationForm.title.trim() || createReservationMutation.isPending}
              >
                <Plus className="h-4 w-4" />
                예약 등록
              </Button>
            </div>
          </div>

        </div>
        {message ? (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {message}
            </div>
        ) : null}
      </section>
      ) : null}

      {activeView === 'board' ? (
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">공간 예약보드</h2>
        </div>
        <div className="grid gap-3 xl:grid-cols-3">
          {data.resources.map((resource) => (
            <ResourceColumn
              key={resource.id}
              resource={resource}
              reservations={reservationsByResource.get(resource.id) ?? []}
              currentUser={currentUser}
              onCancel={(id) =>
                requestConfirm({
                  title: '예약을 취소할까요?',
                  description: '취소 후에는 예약 보드에서 해당 일정이 제외됩니다.',
                  confirmLabel: '예약 취소',
                  tone: 'danger',
                  onConfirm: () => deleteMutation.mutate({ type: 'reservation', id }),
                })
              }
            />
          ))}
        </div>
      </section>
      ) : null}

      {activeView === 'weekly' ? (
        <WeeklyTimeline resources={data.resources} reservations={data.reservations} weekDays={weekDays} selectedDate={selectedDate} />
      ) : null}

      {confirmDialog ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-950/35" aria-label="확인 창 닫기" onClick={() => setConfirmDialog(null)} />
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">{confirmDialog.title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{confirmDialog.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex justify-end gap-2 bg-slate-50/70 px-5 py-4">
              <button type="button" onClick={() => setConfirmDialog(null)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  action();
                }}
                className={[
                  'rounded-md border px-3 py-2 text-sm font-semibold transition',
                  confirmDialog.tone === 'danger' ? 'border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100',
                ].join(' ')}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="min-w-[132px] flex-1 rounded-lg border border-slate-200 bg-white p-3 md:min-w-0 md:p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">{icon}{label}</div>
      <div className="mt-1.5 text-2xl font-semibold text-slate-950 md:mt-2">{value}</div>
    </div>
  );
}

function ResourceColumn({
  resource,
  reservations,
  currentUser,
  onCancel,
}: {
  resource: RoomResource;
  reservations: RoomReservation[];
  currentUser: AuthUser;
  onCancel: (id: string) => void;
}) {
  const activeReservations = reservations.filter((item) => item.status !== 'CANCELLED');

  return (
    <div className="min-h-72 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-950">{resource.name}</span>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">{RESOURCE_TYPE_LABEL[resource.type]}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">{resource.capacity}명 · {resource.location || '위치 미지정'}</div>
        </div>
        <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-white">{activeReservations.length}</span>
      </div>

      <div className="mt-3 space-y-2">
        {activeReservations.map((reservation) => {
          const canCancel = currentUser.role === 'HEAD' || currentUser.role === 'ADMIN' || reservation.requesterId === currentUser.id;
          return (
            <div key={reservation.id} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{reservation.title}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatTime(reservation.startsAt)} - {formatTime(reservation.endsAt)}
                  </div>
                </div>
                <StatusBadge status={reservation.status} />
              </div>
              <div className="mt-2 text-xs text-slate-500">예약자: {reservation.requesterName}</div>
              {reservation.purpose ? <div className="mt-2 line-clamp-2 text-xs text-slate-600">{reservation.purpose}</div> : null}
              {canCancel ? (
                <button
                  type="button"
                  onClick={() => onCancel(reservation.id)}
                  className="mt-3 rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100"
                >
                  예약 취소
                </button>
              ) : null}
            </div>
          );
        })}
        {activeReservations.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 bg-white/60 p-5 text-center text-sm text-slate-500">선택한 날짜에 예약이 없습니다.</div>
        ) : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={['inline-flex shrink-0 rounded-full border px-2 py-1 text-xs font-semibold', STATUS_BADGE_CLASS[status] ?? STATUS_BADGE_CLASS.PENDING].join(' ')}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function WeeklyTimeline({
  resources,
  reservations,
  weekDays,
  selectedDate,
}: {
  resources: RoomResource[];
  reservations: RoomReservation[];
  weekDays: Array<{ key: string; label: string; day: number }>;
  selectedDate: string;
}) {
  const activeReservations = reservations.filter((item) => item.status !== 'CANCELLED');

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">주간 타임라인</h2>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
          {weekDays[0]?.key} - {weekDays[6]?.key}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[920px] overflow-hidden rounded-lg border border-slate-200">
          <div className="grid grid-cols-[150px_repeat(7,minmax(105px,1fr))] border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
            <div className="border-r border-slate-200 px-3 py-3">공간</div>
            {weekDays.map((day) => (
              <div
                key={day.key}
                className={[
                  'border-r border-slate-200 px-3 py-3 last:border-r-0',
                  day.key === selectedDate
                    ? 'bg-sky-50 text-sky-800 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.25)]'
                    : '',
                ].join(' ')}
              >
                <div>{day.label}</div>
                <div className="mt-1 text-sm font-bold">{day.day}</div>
              </div>
            ))}
          </div>

          {resources.map((resource) => (
            <div key={resource.id} className="grid grid-cols-[150px_repeat(7,minmax(105px,1fr))] border-b border-slate-100 last:border-b-0">
              <div className="border-r border-slate-200 bg-white px-3 py-3">
                <div className="truncate text-sm font-semibold text-slate-900">{resource.name}</div>
                <div className="mt-1 text-xs text-slate-500">{RESOURCE_TYPE_LABEL[resource.type]} · {resource.capacity}명</div>
              </div>
              {weekDays.map((day) => {
                const dayReservations = activeReservations.filter(
                  (reservation) =>
                    reservation.resourceId === resource.id &&
                    (isSameDate(reservation.startsAt, day.key) || isSameDate(reservation.endsAt, day.key)),
                );

                return (
                  <div
                    key={`${resource.id}-${day.key}`}
                    className={[
                      'min-h-28 border-r border-slate-100 bg-white p-2 last:border-r-0',
                      day.key === selectedDate ? 'bg-sky-50/60' : '',
                    ].join(' ')}
                  >
                    {dayReservations.map((reservation) => (
                      <div key={reservation.id} className="mb-2 rounded-md border border-sky-100 bg-sky-50 px-2 py-1.5 text-xs text-slate-700">
                        <div className="font-semibold text-slate-900">{reservation.title}</div>
                        <div className="mt-1 text-slate-500">
                          {formatTime(reservation.startsAt)} - {formatTime(reservation.endsAt)}
                        </div>
                      </div>
                    ))}
                    {dayReservations.length === 0 ? <div className="pt-8 text-center text-xs text-slate-300">비어 있음</div> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
