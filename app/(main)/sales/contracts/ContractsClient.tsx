'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ContractDeal, ContractLineItem, ContractStatus } from '../../../lib/types/contracts';
import { CONTRACT_STATUS_META } from '../../../lib/types/contracts';

import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { RichSelect } from '@/app/components/ui/select';
import { Trash2, Plus, Inbox } from 'lucide-react';
import { useToast } from '@/app/components/ui/use-toast';
import { Skeleton } from '@/app/components/ui/skeleton';

import KanbanColumn from '../../../components/ui/KanbanColumn';
import DealCard from '../../../components/ui/DealCard';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteContractDeal, getContractDeals, saveContractDeal, updateContractDealStatus } from '@/app/lib/api/contracts';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';

const ui = {
  border: 'border-stone-200/60',
  borderStrong: 'border-stone-200/80',
  surface: 'bg-stone-50/60 border-stone-200/60',
  surfaceHover: 'hover:bg-amber-50/40 hover:border-amber-200/50',
  cardHover: 'hover:shadow-sm hover:-translate-y-[1px] transition duration-150 ease-out will-change-transform',
  focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 focus-visible:ring-offset-2',
  input:
    'h-10 w-full rounded-md border border-stone-200/60 bg-white/70 px-3 text-sm ' +
    'placeholder:text-slate-400 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 focus-visible:ring-offset-2',
  btnSoft:
    'rounded-md border border-stone-200/60 bg-white/60 px-3 py-2 text-sm text-slate-700 ' +
    'hover:bg-amber-50/40 hover:border-amber-200/50 transition active:scale-[0.99]',
} as const;

const uid = () => Math.random().toString(36).slice(2, 10);
const MONEY_STEP = 10_000;
type PendingAction = 'move' | 'save' | 'delete' | null;

function clampNumber(v: number, min = 0) {
  if (Number.isNaN(v)) return min;
  return Math.max(min, v);
}

function normalizeContractMoney(v: number, min = MONEY_STEP) {
  const value = clampNumber(v, min);
  return Math.max(min, Math.round(value / MONEY_STEP) * MONEY_STEP);
}

function fmt(n: number) {
  return `${n.toLocaleString()}원`;
}

function calc(deal: ContractDeal) {
  const subtotal = deal.items.reduce((acc, it) => acc + clampNumber(it.qty, 0) * normalizeContractMoney(it.unitPrice), 0);
  const discount = deal.discount > 0 ? normalizeContractMoney(deal.discount, 0) : 0;
  const supply = Math.max(0, subtotal - discount);
  const vat = Math.round(supply * 0.1);
  const total = supply + vat;

  const commissionRate = clampNumber(deal.commissionRate, 0);
  const commission = Math.round((total * commissionRate) / 100);

  return { subtotal, discount, supply, vat, total, commissionRate, commission };
}

/** ✅ Skeletons */
function ContractsBoardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-[420px] max-w-[70vw]" />
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-[220px]" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, colIdx) => (
          <KanbanColumnSkeleton key={colIdx} />
        ))}
      </div>
    </div>
  );
}

function KanbanColumnSkeleton() {
  return (
    <div className="rounded-2xl border border-stone-200/60 bg-stone-50/60 p-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-10 rounded-full" />
      </div>

      <div className="mt-3 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <DealCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function DealCardSkeleton() {
  return (
    <div className="rounded-xl border border-stone-200/60 bg-white/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20 justify-self-end" />
      </div>
    </div>
  );
}

/** ✅ Error UI (캠페인 패턴과 유사) */
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{message}</div>
      <Button variant="outline" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}

/** ✅ Empty UI */
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-200/60 p-6 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <Inbox className="h-4 w-4" />
        <span>표시할 계약이 없습니다.</span>
      </div>
      <div className="mt-3">
        <Button variant="outline" onClick={onCreate}>
          + 신규 계약
        </Button>
      </div>
    </div>
  );
}

/**
 * ✅ React Query 버전
 * - initialDeals는 SSR/프리패치 값이 있으면 initialData로 사용
 * - q.data -> deals 로컬 상태로 동기화
 */
export default function ContractsClient({ initialDeals }: { initialDeals: ContractDeal[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { canWrite } = useCurrentUser();
  const [qText, setQText] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContractDeal | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  // 훅은 항상 최상단에서 호출
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const q = useQuery<ContractDeal[]>({
    queryKey: ['contracts-deals'],
    queryFn: () => getContractDeals(),
    initialData: initialDeals, // ✅ 서버에서 받은 초기값
    staleTime: 15_000,
    retry: 1,
  });

  // ✅ 서버 데이터 -> 로컬 보드 상태
  const [deals, setDeals] = useState<ContractDeal[]>(q.data ?? []);
  useEffect(() => {
    if (q.data) setDeals(q.data);
  }, [q.data]);

  const onDragEnd = async ({ active, over }: any) => {
    if (!over) return;
    if (pendingAction) return;
    if (!canWrite) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (!overId.startsWith('col:')) return;

    const nextStatus = overId.replace('col:', '') as ContractStatus;
    if (!CONTRACT_STATUS_META.some((s) => s.key === nextStatus)) return;

    // ✅ 로컬 UI 반영
    const previousDeals = deals;
    setDeals((prev) => prev.map((d) => (d.id === activeId ? { ...d, status: nextStatus } : d)));

    try {
      setPendingAction('move');
      await updateContractDealStatus(activeId, nextStatus);
      await qc.invalidateQueries({ queryKey: ['contracts-deals'] });
    } catch (error) {
      setDeals(previousDeals);
      toast({
        title: '저장 실패',
        description: error instanceof Error ? error.message : '계약 상태를 저장하지 못했습니다.',
        variant: 'destructive',
      });
    } finally {
      setPendingAction(null);
    }
  };

  // 검색
  const filteredDeals = useMemo(() => {
    const keyword = qText.trim().toLowerCase();
    if (!keyword) return deals;
    return deals.filter((d) => (d.title + d.customer + d.owner).toLowerCase().includes(keyword));
  }, [deals, qText]);

  // 상태별 그룹
  const grouped = useMemo(() => {
    const map = new Map<ContractStatus, ContractDeal[]>();
    for (const s of CONTRACT_STATUS_META) map.set(s.key, []);

    for (const d of filteredDeals) {
      const raw = String(d.status ?? '');
      const key = (raw.startsWith('col:') ? raw.replace('col:', '') : raw) as ContractStatus;

      const bucket = map.get(key);
      if (!bucket) {
        map.get('LEAD')!.push({ ...d, status: 'LEAD' });
        continue;
      }
      bucket.push(d);
    }
    return map;
  }, [filteredDeals]);

  const openNew = () => {
    if (!canWrite) return;
    const blank: ContractDeal = {
      id: uid(),
      status: 'LEAD',
      title: '',
      customer: '',
      owner: '봉춘',
      closeDate: '',
      notes: '',
      discount: 0,
      commissionRate: 0,
      items: [{ id: uid(), name: '기본 항목', qty: 1, unitPrice: MONEY_STEP }],
    };
    setEditing(blank);
    setOpen(true);
  };

  const openEdit = (d: ContractDeal) => {
    setEditing(JSON.parse(JSON.stringify(d)));
    setOpen(true);
  };

  const closeModal = () => {
    if (pendingAction) return;
    setOpen(false);
    setEditing(null);
  };

  const saveDeal = async () => {
    if (!editing) return;
    if (pendingAction) return;
    if (!canWrite) return;

    const title = editing.title.trim();
    const customer = editing.customer.trim();

    if (!title || !customer) {
      toast({
        title: '입력값 확인',
        description: '계약명/고객사는 필수입니다.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setPendingAction('save');
      const saved = await saveContractDeal(editing);
      setDeals((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx === -1) return [saved, ...prev];
        const next = [...prev];
        next[idx] = saved;
        return next;
      });

      await qc.invalidateQueries({ queryKey: ['contracts-deals'] });
      toast({ title: '저장 완료', description: '계약 정보가 저장되었습니다.' });
      closeModal();
    } catch (error) {
      toast({
        title: '저장 실패',
        description: error instanceof Error ? error.message : '계약 정보를 저장하지 못했습니다.',
        variant: 'destructive',
      });
    } finally {
      setPendingAction(null);
    }
  };

  const deleteDeal = async () => {
    if (!editing) return;
    if (pendingAction) return;
    if (!canWrite) return;
    if (!confirm('삭제하시겠습니까?')) return;

    try {
      setPendingAction('delete');
      await deleteContractDeal(editing.id);
      setDeals((prev) => prev.filter((p) => p.id !== editing.id));
      await qc.invalidateQueries({ queryKey: ['contracts-deals'] });
      closeModal();
    } catch (error) {
      toast({
        title: '삭제 실패',
        description: error instanceof Error ? error.message : '계약 정보를 삭제하지 못했습니다.',
        variant: 'destructive',
      });
    } finally {
      setPendingAction(null);
    }
  };

  // ✅ 데이터는 있는데 필터 결과가 비면 empty state를 보여줄지 결정(여기서는 "전체 데이터 없을 때만" empty)
  const hasAnyDeals = deals.length > 0;
  const pendingLabel =
    pendingAction === 'move' ? '상태 저장 중...' : pendingAction === 'save' ? '계약 저장 중...' : pendingAction === 'delete' ? '계약 삭제 중...' : '';

  if (q.isLoading) return <ContractsBoardSkeleton />;
  if (q.isError) {
    return <ErrorState message={q.error instanceof Error ? q.error.message : 'Unknown Error'} onRetry={() => q.refetch()} />;
  }
  if (!q.data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">영업현황관리</h1>
          <p className="text-sm text-muted-foreground">상태별 칸반으로 계약을 관리하고, 카드 클릭 시 상세/가격책정을 편집합니다.</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="검색: 계약명/고객사/담당자"
            className={['w-[220px]', ui.input].join(' ')}
            disabled={Boolean(pendingAction)}
          />
          <Button
            variant="outline"
            className="border-stone-200 bg-white/60 hover:bg-amber-50/60 hover:border-amber-200/60"
            onClick={openNew}
            type="button"
            disabled={!canWrite || Boolean(pendingAction)}
          >
            + 신규 계약
          </Button>

        </div>
      </div>

      {pendingLabel && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status" aria-live="polite">
          {pendingLabel}
        </div>
      )}

      {!canWrite ? <ReadOnlyNotice /> : null}

      {!hasAnyDeals ? (
        <EmptyState onCreate={openNew} />
      ) : (
        <DndContext id="contracts-board" sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid gap-3 lg:grid-cols-5">
            {CONTRACT_STATUS_META.map((col) => {
              const list = grouped.get(col.key) ?? [];

              return (
                <KanbanColumn key={col.key} status={col.key} label={col.label} count={list.length} ui={{ surface: ui.surface }}>
                  {list.map((d) => (
                    <DealCard key={d.id} deal={d} ui={ui} onClick={() => openEdit(d)} calc={calc} fmt={fmt} />
                  ))}

                  {list.length === 0 && (
                    <div className="rounded-xl border border-dashed border-stone-200/60 p-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Inbox className="h-4 w-4" />
                        <span>비어있음</span>
                      </div>
                    </div>
                  )}
                </KanbanColumn>
              );
            })}
          </div>
        </DndContext>
      )}

      {/* Modal */}
      {open && editing && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 z-0 bg-black/45" onClick={closeModal} />
          <div className="absolute left-1/2 top-1/2 z-10 w-[95vw] max-w-4xl -translate-x-1/2 -translate-y-1/2">
            <Card className="rounded-2xl border border-stone-200 bg-white shadow-xl">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{editing.title?.trim() ? '계약 편집' : '신규 계약'}</CardTitle>
                    <p className="text-xs text-muted-foreground">계약 정보 + 가격책정 + 자동 합계</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid gap-4 lg:grid-cols-12">
                {/* Left */}
                <div className="space-y-3 lg:col-span-4">
                  <SectionTitle title="기본 정보" />

                  <Field label="상태">
                    <RichSelect
                      value={editing.status}
                      onChange={(value) => setEditing({ ...editing, status: value as ContractStatus })}
                      options={CONTRACT_STATUS_META.map((s) => ({ value: s.key, label: s.label }))}
                      buttonClassName={ui.input}
                      disabled={!canWrite || Boolean(pendingAction)}
                    />
                  </Field>

                  <Field label="계약명">
                    <input
                      value={editing.title}
                      onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                      className={ui.input}
                      placeholder="예: 아웃바운드 캠페인 모듈"
                      disabled={!canWrite || Boolean(pendingAction)}
                    />
                  </Field>

                  <Field label="고객사">
                    <input
                      value={editing.customer}
                      onChange={(e) => setEditing({ ...editing, customer: e.target.value })}
                      className={ui.input}
                      placeholder="예: 통계청"
                      disabled={!canWrite || Boolean(pendingAction)}
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="담당자">
                      <input
                        value={editing.owner}
                        onChange={(e) => setEditing({ ...editing, owner: e.target.value })}
                        className={ui.input}
                        placeholder="예: 봉춘"
                        disabled={!canWrite || Boolean(pendingAction)}
                      />
                    </Field>

                    <Field label="마감일">
                      <input
                        value={editing.closeDate}
                        onChange={(e) => setEditing({ ...editing, closeDate: e.target.value })}
                        className={ui.input}
                        placeholder="YYYY-MM-DD"
                        disabled={!canWrite || Boolean(pendingAction)}
                      />
                    </Field>
                  </div>

                  <Field label="메모">
                    <textarea
                      value={editing.notes ?? ''}
                      onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                      className={['min-h-[84px] py-2', ui.input].join(' ')}
                      placeholder="협상 포인트, 특이사항 등"
                      disabled={!canWrite || Boolean(pendingAction)}
                    />
                  </Field>

                  <div className="flex items-center justify-between pt-2">
                    <Button variant="dlOutline" type="button" onClick={deleteDeal} disabled={!canWrite || Boolean(pendingAction)}>
                      {pendingAction === 'delete' ? '삭제 중...' : '삭제'}
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button variant="closeOutline" type="button" onClick={closeModal} disabled={Boolean(pendingAction)}>
                        닫기
                      </Button>
                      <Button variant="saveOutlineGreen" type="button" onClick={saveDeal} disabled={!canWrite || Boolean(pendingAction)}>
                        {pendingAction === 'save' ? '저장 중...' : '저장'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right */}
                <div className="space-y-3 lg:col-span-8">
                  <div className="flex items-center justify-between gap-2">
                    <SectionTitle title="가격 책정" />
                    <Button
                      variant="saveOutline"
                      size="icon"
                      type="button"
                      aria-label="항목 추가"
                      onClick={() => {
                        const next: ContractLineItem = { id: uid(), name: '', qty: 1, unitPrice: MONEY_STEP };
                        setEditing({ ...editing, items: [next, ...editing.items] });
                      }}
                      disabled={!canWrite || Boolean(pendingAction)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className={['w-full overflow-auto rounded-xl border', ui.border].join(' ')}>
                      <table className="w-full text-sm bg-white/80">
                        <thead className="text-muted-foreground">
                          <tr className="border-b last:border-b-0 hover:bg-amber-50/40 transition">
                            <th className="py-2 px-3 text-left font-medium min-w-[180px]">품목명</th>
                            <th className="py-2 px-3 text-right font-medium w-[90px]">수량</th>
                            <th className="py-2 px-3 text-right font-medium w-[160px]">단가</th>
                            <th className="py-2 px-3 text-right font-medium w-[140px]">금액</th>
                            <th className="py-2 px-3 text-center font-medium w-[70px]">삭제</th>
                          </tr>
                        </thead>

                        <tbody>
                          {editing.items.map((it) => (
                            <tr key={it.id} className="border-b border-stone-200/80 last:border-b-0 hover:bg-amber-50/30 transition">
                              <td className="py-2 px-3">
                                <input
                                  value={it.name}
                                  onChange={(e) => {
                                    const items = editing.items.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x));
                                    setEditing({ ...editing, items });
                                  }}
                                  className={['w-[220px]', ui.input].join(' ')}
                                  placeholder="예: 기본 구축"
                                  disabled={!canWrite || Boolean(pendingAction)}
                                />
                              </td>

                              <td className="py-2 px-3 text-right">
                                <input
                                  inputMode="numeric"
                                  min={1}
                                  value={String(it.qty)}
                                  onChange={(e) => {
                                    const v = clampNumber(Number(e.target.value), 0);
                                    const items = editing.items.map((x) => (x.id === it.id ? { ...x, qty: v } : x));
                                    setEditing({ ...editing, items });
                                  }}
                                  className={['w-[120px]', ui.input].join(' ')}
                                  disabled={!canWrite || Boolean(pendingAction)}
                                />
                              </td>

                              <td className="py-2 px-3 text-right">
                                <input
                                  inputMode="numeric"
                                  min={MONEY_STEP}
                                  step={MONEY_STEP}
                                  value={String(it.unitPrice)}
                                  onChange={(e) => {
                                    const v = clampNumber(Number(e.target.value), 0);
                                    const items = editing.items.map((x) => (x.id === it.id ? { ...x, unitPrice: v } : x));
                                    setEditing({ ...editing, items });
                                  }}
                                  onBlur={() => {
                                    const items = editing.items.map((x) =>
                                      x.id === it.id ? { ...x, unitPrice: normalizeContractMoney(x.unitPrice) } : x,
                                    );
                                    setEditing({ ...editing, items });
                                  }}
                                  className={['w-[140px]', ui.input].join(' ')}
                                  disabled={!canWrite || Boolean(pendingAction)}
                                />
                              </td>

                              <td className="py-2 px-3 text-right font-medium">{fmt(clampNumber(it.qty, 0) * normalizeContractMoney(it.unitPrice))}</td>

                              <td className="py-2 px-3 text-right">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  aria-label="항목 삭제"
                                  onClick={() => {
                                    const items = editing.items.filter((x) => x.id !== it.id);
                                    setEditing({
                                      ...editing,
                                      items: items.length ? items : [{ id: uid(), name: '', qty: 1, unitPrice: MONEY_STEP }],
                                    });
                                  }}
                                  className="h-9 w-9 text-slate-500 hover:bg-rose-50/60 hover:text-rose-600"
                                  disabled={!canWrite || Boolean(pendingAction)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="할인(정액)">
                        <input
                          inputMode="numeric"
                          min={0}
                          step={MONEY_STEP}
                          value={String(editing.discount)}
                          onChange={(e) => setEditing({ ...editing, discount: clampNumber(Number(e.target.value), 0) })}
                          onBlur={() =>
                            setEditing({
                              ...editing,
                              discount: editing.discount > 0 ? normalizeContractMoney(editing.discount, 0) : 0,
                            })
                          }
                          className={ui.input}
                          disabled={!canWrite || Boolean(pendingAction)}
                        />
                      </Field>
                      <Field label="수수료율(%)">
                        <input
                          inputMode="numeric"
                          value={String(editing.commissionRate)}
                          onChange={(e) => setEditing({ ...editing, commissionRate: clampNumber(Number(e.target.value), 0) })}
                          className={ui.input}
                          disabled={!canWrite || Boolean(pendingAction)}
                        />
                      </Field>
                    </div>

                    <PricingSummary deal={editing} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <div className="text-sm font-semibold">{title}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function PricingSummary({ deal }: { deal: ContractDeal }) {
  const c = calc(deal);

  return (
    <Card className="rounded-2xl border border-stone-200/60 bg-white/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">자동 합계</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row label="소계" value={fmt(c.subtotal)} />
        <Row label="할인" value={`- ${fmt(c.discount)}`} />
        <div className="h-px bg-slate-200 my-1" />
        <Row label="공급가" value={fmt(c.supply)} />
        <Row label="부가세(10%)" value={fmt(c.vat)} />
        <div className="h-px bg-slate-200 my-1" />
        <Row label="총액" value={fmt(c.total)} strong />
        <div className="h-px bg-slate-200 my-1" />
        <Row label={`수수료(${c.commissionRate}%)`} value={fmt(c.commission)} />
      </CardContent>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-semibold' : 'font-medium'}>{value}</span>
    </div>
  );
}
