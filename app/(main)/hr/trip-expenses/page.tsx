'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, FileText, Upload, X } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { RichSelect } from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import type { EligibleBusinessTrip, TransportType, TripExpenseRequest, TripExpenseStatus, TripScope } from '@/app/lib/types/tripExpense';

type TripExpenseResponse = {
  eligibleTrips: EligibleBusinessTrip[];
  items: TripExpenseRequest[];
};

const TRANSPORT_LABEL: Record<TransportType, string> = {
  TRAIN: '기차',
  CAR: '자가용',
  BUS: '버스',
  TAXI: '택시',
  OTHER: '기타',
};

const SCOPE_LABEL: Record<TripScope, string> = {
  IN_CITY: '시내 출장',
  OUT_CITY: '시외 출장',
};

const STATUS_LABEL: Record<TripExpenseStatus, string> = {
  PENDING: '결재 대기',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
};

const STATUS_BADGE_CLASS: Record<TripExpenseStatus, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-800',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  CANCELLED: 'border-slate-200 bg-slate-50 text-slate-600',
};

const DAILY_ALLOWANCE: Record<TripScope, number> = {
  IN_CITY: 30_000,
  OUT_CITY: 50_000,
};

const LODGING_AMOUNT_PER_NIGHT = 150_000;
const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const PAGE_SIZE_OPTIONS = [10, 20, 40] as const;
const fieldClass =
  'border-slate-100 bg-white/90 text-slate-700 shadow-sm transition hover:border-slate-200 focus-visible:border-sky-200 focus-visible:ring-sky-100';
const selectClass =
  'h-10 rounded-md border border-slate-100 bg-white/90 px-3 text-sm text-slate-700 shadow-sm transition hover:border-slate-200 focus:border-sky-200 focus:ring-2 focus:ring-sky-100 max-[480px]:h-11 max-[480px]:text-sm';

function amount(value: string) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function won(value: number) {
  return value.toLocaleString() + '원';
}

function StatusBadge({ status }: { status: TripExpenseStatus }) {
  return (
    <span className={['inline-flex min-w-16 justify-center rounded-full border px-2.5 py-1 text-xs font-medium', STATUS_BADGE_CLASS[status]].join(' ')}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function formatTripOption(trip: EligibleBusinessTrip) {
  const date = trip.startDate === trip.endDate ? trip.startDate : [trip.startDate, trip.endDate].join(' ~ ');
  return `${date} / ${trip.requesterName}`;
}

function getCompactPages(page: number, totalPages: number): Array<number | 'dots'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= totalPages));
  const result: Array<number | 'dots'> = [];
  let previous = 0;
  for (const current of Array.from(pages).sort((a, b) => a - b)) {
    if (previous && current - previous > 1) result.push('dots');
    result.push(current);
    previous = current;
  }
  return result;
}

function PageButton({
  children,
  active = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
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

function fileKey(file: File) {
  return [file.name, file.size, file.lastModified].join(':');
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
  if (size >= 1024) return `${Math.ceil(size / 1024)}KB`;
  return `${size}B`;
}

export default function TripExpensesPage() {
  const qc = useQueryClient();
  const [selectedTripId, setSelectedTripId] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [tripScope, setTripScope] = useState<TripScope>('IN_CITY');
  const [transportType, setTransportType] = useState<TransportType>('TRAIN');
  const [trainFareAmount, setTrainFareAmount] = useState('0');
  const [carDepreciationAmount, setCarDepreciationAmount] = useState('0');
  const [otherAmount, setOtherAmount] = useState('0');
  const [lodgingNights, setLodgingNights] = useState('0');
  const [memo, setMemo] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [fileNotice, setFileNotice] = useState('');
  const [settlementTarget, setSettlementTarget] = useState<TripExpenseRequest | null>(null);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentAccount, setPaymentAccount] = useState('');
  const [settlementMemo, setSettlementMemo] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

  const query = useQuery<TripExpenseResponse>({
    queryKey: ['hr', 'trip-expenses'],
    queryFn: async () => {
      const res = await fetch('/api/hr/trip-expenses', { cache: 'no-store' });
      if (!res.ok) throw new Error('출장여비 정보를 불러오지 못했습니다.');
      return res.json();
    },
  });

  const selectedTrip = useMemo(() => query.data?.eligibleTrips.find((trip) => trip.id === selectedTripId) ?? null, [query.data?.eligibleTrips, selectedTripId]);
  const lodgingNightsValue = Math.max(0, Math.floor(amount(lodgingNights)));
  const dailyAllowanceAmount = DAILY_ALLOWANCE[tripScope];
  const lodgingAmount = lodgingNightsValue * LODGING_AMOUNT_PER_NIGHT;
  const transportAmount = amount(trainFareAmount) + amount(carDepreciationAmount) + amount(otherAmount);
  const totalAmount = transportAmount + dailyAllowanceAmount + lodgingAmount;

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/trip-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessTripRequestId: selectedTripId,
          origin,
          destination,
          tripScope,
          transportType,
          trainFareAmount,
          carDepreciationAmount,
          otherAmount,
          lodgingNights: lodgingNightsValue,
          memo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '출장여비 신청을 저장하지 못했습니다.');
      if (files.length) {
        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));
        const uploadRes = await fetch(`/api/hr/trip-expenses/${data.id}/attachments`, {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) throw new Error(uploadData.message || '증빙 자료를 업로드하지 못했습니다.');
      }
      return data;
    },
    onSuccess: async () => {
      setSelectedTripId('');
      setOrigin('');
      setDestination('');
      setTripScope('IN_CITY');
      setTransportType('TRAIN');
      setTrainFareAmount('0');
      setCarDepreciationAmount('0');
      setOtherAmount('0');
      setLodgingNights('0');
      setMemo('');
      setFiles([]);
      setFileNotice('');
      setFileInputKey((value) => value + 1);
      await qc.invalidateQueries({ queryKey: ['hr', 'trip-expenses'] });
      await qc.invalidateQueries({ queryKey: ['notifications', 'counts'] });
    },
  });

  const settleMutation = useMutation({
    mutationFn: async (input: { id: string; paymentDate: string; paymentAccount: string; settlementMemo: string }) => {
      const res = await fetch('/api/hr/trip-expenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, action: 'SETTLE' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '출장여비 정산 처리에 실패했습니다.');
      return data;
    },
    onSuccess: async () => {
      setSettlementTarget(null);
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentAccount('');
      setSettlementMemo('');
      await qc.invalidateQueries({ queryKey: ['hr', 'trip-expenses'] });
      await qc.invalidateQueries({ queryKey: ['notifications', 'counts'] });
    },
  });

  const items = query.data?.items ?? [];
  const historyTotalPages = Math.max(1, Math.ceil(items.length / historyPageSize));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const historyStart = items.length === 0 ? 0 : (safeHistoryPage - 1) * historyPageSize + 1;
  const historyEnd = Math.min(safeHistoryPage * historyPageSize, items.length);
  const pagedItems = useMemo(() => {
    const start = (safeHistoryPage - 1) * historyPageSize;
    return items.slice(start, start + historyPageSize);
  }, [historyPageSize, items, safeHistoryPage]);

  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

  function addFiles(nextFiles: FileList | null) {
    if (!nextFiles?.length) return;

    const currentKeys = new Set(files.map(fileKey));
    const accepted: File[] = [];
    let duplicateCount = 0;
    let overflowCount = 0;
    let oversizeCount = 0;

    for (const file of Array.from(nextFiles)) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        oversizeCount += 1;
        continue;
      }
      const key = fileKey(file);
      if (currentKeys.has(key) || accepted.some((acceptedFile) => fileKey(acceptedFile) === key)) {
        duplicateCount += 1;
        continue;
      }
      if (files.length + accepted.length >= MAX_ATTACHMENT_COUNT) {
        overflowCount += 1;
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length) setFiles((current) => [...current, ...accepted]);

    const notices = [
      accepted.length ? `${accepted.length}개 파일을 첨부 대기 목록에 추가했습니다.` : '',
      duplicateCount ? `중복 파일 ${duplicateCount}개는 제외했습니다.` : '',
      overflowCount ? `최대 ${MAX_ATTACHMENT_COUNT}개까지만 첨부할 수 있어 ${overflowCount}개는 제외했습니다.` : '',
      oversizeCount ? `10MB 초과 파일 ${oversizeCount}개는 제외했습니다.` : '',
    ].filter(Boolean);

    setFileNotice(notices.join(' '));
    setFileInputKey((value) => value + 1);
  }

  function removeFile(key: string) {
    setFiles((current) => current.filter((file) => fileKey(file) !== key));
    setFileNotice('선택한 파일을 첨부 대기 목록에서 제거했습니다.');
  }

  function openSettlement(item: TripExpenseRequest) {
    setSettlementTarget(item);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentAccount(item.paymentAccount ?? '');
    setSettlementMemo(item.settlementMemo ?? '');
  }

  function submitSettlement() {
    if (!settlementTarget) return;
    settleMutation.mutate({
      id: settlementTarget.id,
      paymentDate,
      paymentAccount,
      settlementMemo,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">출장여비 신청</h1>
        <p className="text-sm text-muted-foreground">승인 완료된 출장 중 종료일이 지난 건에 대해서만 여비를 신청할 수 있습니다.</p>
      </div>

      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">신청 가능한 출장</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RichSelect
            value={selectedTripId}
            onChange={setSelectedTripId}
            placeholder="승인 완료된 출장 선택"
            emptyText="신청 가능한 출장이 없습니다."
            options={[
              { value: '', label: '승인 완료된 출장 선택' },
              ...(query.data?.eligibleTrips ?? []).map((trip) => ({
                value: trip.id,
                label: formatTripOption(trip),
                description: trip.reason ?? '출장 사유 정보 없음',
              })),
            ]}
          />

          {selectedTrip ? (
            <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-3 text-sm text-sky-900">
              <div className="font-semibold">선택된 출장</div>
              <div className="mt-1 whitespace-pre-line text-sky-800">{selectedTrip.reason ?? '출장 사유 정보가 없습니다.'}</div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">출발지</label>
              <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="예: 서울역" className={fieldClass} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">목적지</label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="예: 부산역" className={fieldClass} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">출장 구분</label>
              <RichSelect
                value={tripScope}
                onChange={(value) => setTripScope(value as TripScope)}
                options={Object.entries(SCOPE_LABEL).map(([value, label]) => ({
                  value,
                  label: `${label} / ${won(DAILY_ALLOWANCE[value as TripScope])}`,
                }))}
                buttonClassName={selectClass}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">숙박 박수</label>
              <Input type="number" min="0" step="1" value={lodgingNights} onChange={(e) => setLodgingNights(e.target.value)} className={fieldClass} />
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-900">
              <div className="font-semibold">정액 지급</div>
              <div className="mt-1">출장 구분 {won(dailyAllowanceAmount)}</div>
              <div>숙박 {lodgingNightsValue}박 x {won(LODGING_AMOUNT_PER_NIGHT)}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">교통수단</label>
              <RichSelect
                value={transportType}
                onChange={(value) => setTransportType(value as TransportType)}
                options={Object.entries(TRANSPORT_LABEL).map(([value, label]) => ({ value, label }))}
                buttonClassName={selectClass}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">기차표 금액</label>
              <Input type="number" min="0" value={trainFareAmount} onChange={(e) => setTrainFareAmount(e.target.value)} className={fieldClass} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">자가용 감가상각비</label>
              <Input type="number" min="0" value={carDepreciationAmount} onChange={(e) => setCarDepreciationAmount(e.target.value)} className={fieldClass} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">기타 금액</label>
              <Input type="number" min="0" value={otherAmount} onChange={(e) => setOtherAmount(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">증빙 자료</label>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-700">첨부 대기 {files.length}/{MAX_ATTACHMENT_COUNT}</div>
                  <p className="mt-1 text-xs text-slate-500">이미지 또는 PDF를 등록해 주세요.</p>
                </div>
                <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-100 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-700">
                  <Upload className="h-4 w-4" />
                  파일 선택
                  <Input
                    key={fileInputKey}
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={(e) => addFiles(e.target.files)}
                    className="sr-only"
                    disabled={files.length >= MAX_ATTACHMENT_COUNT}
                  />
                </label>
              </div>

              {fileNotice ? (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-sky-100 bg-sky-50/70 px-3 py-2 text-xs text-sky-800">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{fileNotice}</span>
                </div>
              ) : null}

              {files.length ? (
                <div className="mt-3 grid gap-2">
                  {files.map((file) => (
                    <div key={fileKey(file)} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-white px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-sky-600" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-700">{file.name}</div>
                          <div className="text-xs text-slate-500">{formatFileSize(file.size)} · 신청 시 업로드 대기</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(fileKey(file))}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`${file.name} 제거`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-md border border-dashed border-slate-200 bg-white/70 px-3 py-5 text-center text-xs text-slate-500">
                  아직 첨부 대기 중인 파일이 없습니다.
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">메모</label>
            <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="추가 설명이 있으면 입력해 주세요." className={`min-h-[84px] ${fieldClass}`} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <div>교통/기타 실비: {won(transportAmount)}</div>
              <div>출장 구분 지급: {won(dailyAllowanceAmount)}</div>
              <div>숙박 지급: {won(lodgingAmount)}</div>
              <div className="font-semibold text-slate-900">지급받을 금액: {won(totalAmount)}</div>
            </div>
          </div>

          {createMutation.isError ? <div className="text-sm text-rose-600">{(createMutation.error as Error).message}</div> : null}
          <div className="flex justify-end">
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !selectedTripId}>
              {createMutation.isPending ? '신청 중...' : '출장여비 신청'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-base">출장여비 신청 내역</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                총 {items.length.toLocaleString()}건 중 {historyStart.toLocaleString()}-{historyEnd.toLocaleString()}건
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setHistoryPageSize(size);
                    setHistoryPage(1);
                  }}
                  className={[
                    'soft-interactive rounded-md border px-3 py-1.5 text-xs font-semibold',
                    historyPageSize === size ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-500',
                  ].join(' ')}
                >
                  {size}개
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:hidden">
            {pagedItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-100 bg-white px-3 py-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500">신청자</div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-950">{item.requesterName}</div>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <span
                    className={[
                      'rounded-full border px-2.5 py-1 text-xs font-medium',
                      item.settlementStatus === 'PAID'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600',
                    ].join(' ')}
                  >
                    {item.settlementStatus === 'PAID' ? '정산 완료' : '정산 대기'}
                  </span>
                  {item.status === 'APPROVED' && item.settlementStatus !== 'PAID' ? (
                    <Button
                      size="sm"
                      variant="saveOutlineGreen"
                      disabled={settleMutation.isPending}
                      onClick={() => openSettlement(item)}
                    >
                      완료
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-8 text-center text-sm text-slate-500">
                출장여비 신청 내역이 없습니다.
              </div>
            ) : null}
          </div>

          <div className="hidden overflow-auto rounded-lg border border-slate-100 sm:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">신청자</th>
                  <th className="px-3 py-2 text-left font-medium">구간</th>
                  <th className="px-3 py-2 text-left font-medium">구분</th>
                  <th className="px-3 py-2 text-left font-medium">숙박</th>
                  <th className="px-3 py-2 text-right font-medium">지급액</th>
                  <th className="px-3 py-2 text-left font-medium">증빙</th>
                  <th className="px-3 py-2 text-left font-medium">상태</th>
                  <th className="px-3 py-2 text-left font-medium">정산</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{item.requesterName}</td>
                    <td className="px-3 py-2">
                      {[item.origin, item.destination].join(' - ')}
                    </td>
                    <td className="px-3 py-2">{SCOPE_LABEL[item.tripScope]}</td>
                    <td className="px-3 py-2">{item.lodgingNights}박</td>
                    <td className="px-3 py-2 text-right">{won(item.totalAmount)}</td>
                    <td className="px-3 py-2">
                      {item.attachments.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={`/api/hr/trip-expenses/attachments/${attachment.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border border-slate-100 bg-white px-2 py-1 text-xs text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
                            >
                              {attachment.originalFilename}
                            </a>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            'rounded-full border px-2 py-1 text-xs font-medium',
                            item.settlementStatus === 'PAID'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600',
                          ].join(' ')}
                        >
                          {item.settlementStatus === 'PAID' ? '정산 완료' : '정산 대기'}
                        </span>
                        {item.status === 'APPROVED' && item.settlementStatus !== 'PAID' ? (
                          <Button
                            size="sm"
                            variant="saveOutlineGreen"
                            disabled={settleMutation.isPending}
                            onClick={() => openSettlement(item)}
                          >
                            완료
                          </Button>
                        ) : null}
                      </div>
                      {item.settlementStatus === 'PAID' ? (
                        <div className="mt-1 text-xs text-slate-500">
                          {item.paymentDate ?? '-'} · {item.settledByName ?? '담당자 미기록'}
                        </div>
                      ) : null}
                      {item.settlementMemo ? <div className="mt-1 max-w-[220px] truncate text-xs text-slate-500">정산 메모: {item.settlementMemo}</div> : null}
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={8}>
                      출장여비 신청 내역이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {items.length > historyPageSize ? (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">
                {safeHistoryPage} / {historyTotalPages} 페이지
              </div>
              <div className="flex flex-wrap gap-1.5">
                <PageButton disabled={safeHistoryPage <= 1} onClick={() => setHistoryPage(1)}>
                  First
                </PageButton>
                <PageButton disabled={safeHistoryPage <= 1} onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}>
                  이전
                </PageButton>
                {getCompactPages(safeHistoryPage, historyTotalPages).map((page, index) =>
                  page === 'dots' ? (
                    <span key={`dots-${index}`} className="px-2 py-1 text-sm text-slate-400">...</span>
                  ) : (
                    <PageButton key={page} active={page === safeHistoryPage} onClick={() => setHistoryPage(page)}>
                      {page}
                    </PageButton>
                  ),
                )}
                <PageButton disabled={safeHistoryPage >= historyTotalPages} onClick={() => setHistoryPage((page) => Math.min(historyTotalPages, page + 1))}>
                  다음
                </PageButton>
                <PageButton disabled={safeHistoryPage >= historyTotalPages} onClick={() => setHistoryPage(historyTotalPages)}>
                  Last
                </PageButton>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {settlementTarget ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/35" onClick={() => setSettlementTarget(null)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2">
            <Card className="border-slate-200 bg-white shadow-xl">
              <CardHeader>
                <CardTitle className="text-base">출장여비 정산 처리</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-900">
                  <div className="font-semibold">{settlementTarget.requesterName} · {won(settlementTarget.totalAmount)}</div>
                  <div className="mt-1 text-emerald-800">{settlementTarget.origin} - {settlementTarget.destination}</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">지급일</span>
                    <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={fieldClass} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">지급 계좌/메모</span>
                    <Input value={paymentAccount} onChange={(e) => setPaymentAccount(e.target.value)} placeholder="예: 국민 000-00-0000" className={fieldClass} />
                  </label>
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">정산 메모</span>
                  <Textarea value={settlementMemo} onChange={(e) => setSettlementMemo(e.target.value)} placeholder="정산 특이사항이 있으면 입력해 주세요." className={`min-h-[92px] ${fieldClass}`} />
                </label>
                {settleMutation.isError ? <div className="text-sm text-rose-600">{(settleMutation.error as Error).message}</div> : null}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSettlementTarget(null)} disabled={settleMutation.isPending}>취소</Button>
                  <Button variant="saveOutlineGreen" onClick={submitSettlement} disabled={settleMutation.isPending || !paymentDate}>
                    {settleMutation.isPending ? '처리 중...' : '정산 완료'}
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
