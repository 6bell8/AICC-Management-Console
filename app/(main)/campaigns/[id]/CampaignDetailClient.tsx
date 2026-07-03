'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Save, Trash2 } from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../../components/ui/alert-dialog';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Separator } from '../../../components/ui/separator';
import { SimpleSelect } from '../../../components/ui/select';
import { Skeleton } from '../../../components/ui/skeleton';
import { Textarea } from '../../../components/ui/textarea';
import { useToast } from '../../../components/ui/use-toast';
import { ReadOnlyNotice, useCurrentUser } from '../../../lib/auth/useCurrentUser';
import { deleteCampaign, getCampaign, patchCampaign } from '../../../lib/api/campaigns';
import { campaignUpdateSchema, type CampaignUpdateFormValues } from '../../../lib/schemas/campaigns';
import type { Campaign, CampaignStatus } from '../../../lib/types/campaign';

const fieldClass = 'border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0';
const cardClass = 'border-slate-200 transition duration-300 ease-out hover:border-slate-300 hover:shadow-md';

function statusLabel(status: CampaignStatus) {
  switch (status) {
    case 'DRAFT':
      return '초안';
    case 'RUNNING':
      return '운영중';
    case 'PAUSED':
      return '일시중지';
    case 'ARCHIVED':
      return '보관';
  }
}

function statusBadgeVariant(status: CampaignStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'RUNNING':
      return 'default';
    case 'PAUSED':
    case 'DRAFT':
      return 'secondary';
    case 'ARCHIVED':
      return 'outline';
  }
}

function toInputDateTime(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromInputDateTime(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatKST(iso: string) {
  return new Date(iso).toLocaleString();
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ErrorState({ message, onBack, onRetry }: { message: string; onBack: () => void; onRetry: () => void }) {
  return (
    <div className="space-y-4 p-6">
      <Card className="transition duration-300 ease-out">
        <CardHeader>
          <CardTitle>불러오기 실패</CardTitle>
          <CardDescription className="break-words">{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRetry}>
            다시 시도
          </Button>
          <Button variant="outline" onClick={onBack}>
            목록으로
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4 p-6">
      <Card className="transition duration-300 ease-out">
        <CardHeader>
          <CardTitle>캠페인을 찾을 수 없습니다</CardTitle>
          <CardDescription>존재하지 않거나 접근 권한이 없을 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={onBack}>
            목록으로
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CampaignDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { canWrite } = useCurrentUser();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [forceStopThenDelete, setForceStopThenDelete] = useState(true);

  const q = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => getCampaign(id),
    retry: 1,
  });

  const form = useForm<CampaignUpdateFormValues>({
    resolver: zodResolver(campaignUpdateSchema),
    defaultValues: { name: '', description: '', status: 'DRAFT', startAt: null, endAt: null },
    mode: 'onChange',
  });

  useEffect(() => {
    if (!q.data) return;
    form.reset({
      name: q.data.name,
      description: q.data.description ?? '',
      status: q.data.status,
      startAt: q.data.startAt ?? null,
      endAt: q.data.endAt ?? null,
    });
  }, [form, q.data]);

  const saveMutation = useMutation({
    mutationFn: (values: CampaignUpdateFormValues) =>
      patchCampaign(id, {
        ...values,
        startAt: values.startAt ?? null,
        endAt: values.endAt ?? null,
      }),
    onSuccess: (updated) => {
      qc.setQueryData(['campaign', id], updated);
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: '저장 완료', description: '캠페인 정보가 업데이트되었습니다.' });
      router.replace('/campaigns');
    },
    onError: (error) => {
      toast({
        title: '저장 실패',
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (payload: { campaign: Campaign; confirmName: string; forceStopThenDelete: boolean }) => {
      const { campaign, confirmName: nameToConfirm, forceStopThenDelete: shouldStopFirst } = payload;

      if (nameToConfirm.trim() !== campaign.name) {
        throw new Error('캠페인명이 일치하지 않습니다.');
      }

      if (campaign.status === 'RUNNING') {
        if (!shouldStopFirst) {
          throw new Error('운영 중 캠페인은 바로 삭제할 수 없습니다. 중지 후 삭제를 선택해 주세요.');
        }

        await patchCampaign(campaign.id, {
          name: campaign.name,
          description: campaign.description ?? '',
          status: 'PAUSED',
          startAt: campaign.startAt ?? null,
          endAt: campaign.endAt ?? null,
        });
      }

      await deleteCampaign(campaign.id);
    },
    onSuccess: () => {
      toast({ title: '삭제 완료', description: '캠페인이 영구 삭제되었습니다.', variant: 'destructive' });
      setDeleteOpen(false);
      router.replace('/campaigns');
    },
    onError: (error) => {
      toast({
        title: '삭제 실패',
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!canWrite) return;
    saveMutation.mutate(values);
  });

  if (q.isLoading) return <LoadingSkeleton />;
  if (q.isError) {
    return (
      <ErrorState
        message={q.error instanceof Error ? q.error.message : '알 수 없는 오류가 발생했습니다.'}
        onBack={() => router.replace('/campaigns')}
        onRetry={() => q.refetch()}
      />
    );
  }
  if (!q.data) return <NotFoundState onBack={() => router.replace('/campaigns')} />;

  const campaign: Campaign = q.data;
  const isDirty = form.formState.isDirty;
  const isValid = form.formState.isValid;
  const saving = saveMutation.isPending;
  const formDisabled = !canWrite || saving;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <button type="button" className="transition duration-200 hover:text-slate-900" onClick={() => router.replace('/campaigns')}>
          캠페인
        </button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-900">{campaign.id}</span>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight">{campaign.name}</h1>
            <Badge variant={statusBadgeVariant(campaign.status)}>{statusLabel(campaign.status)}</Badge>
          </div>
          <div className="text-xs text-slate-500">
            생성: {formatKST(campaign.createdAt)} · 수정: {formatKST(campaign.updatedAt)}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button variant="outline" onClick={() => router.replace('/campaigns')} disabled={saving} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            목록
          </Button>
          <Button variant="dlOutline" disabled={!canWrite || saving || deleteMutation.isPending} onClick={() => setDeleteOpen(true)} className="gap-2">
            <Trash2 className="h-4 w-4" />
            캠페인 삭제
          </Button>
          <Button onClick={onSubmit} disabled={!canWrite || !isDirty || !isValid || saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>

      {!canWrite ? <ReadOnlyNotice /> : null}

      <Separator />

      <div className="space-y-5">
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
            <CardDescription>캠페인 이름, 상태, 설명을 수정할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium">캠페인 이름</label>
                <Input {...form.register('name')} placeholder="예) 2026 Q1 아웃바운드 캠페인" disabled={formDisabled} className={fieldClass} />
                {form.formState.errors.name?.message ? <p className="text-xs text-rose-600">{form.formState.errors.name.message}</p> : null}
              </div>

              <div className="space-y-2 sm:max-w-xs">
                <label className="text-sm font-medium">상태</label>
                <SimpleSelect
                  value={form.watch('status')}
                  onChange={(event) =>
                    form.setValue('status', event.target.value as CampaignStatus, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  disabled={formDisabled}
                  className={`w-full ${fieldClass}`}
                >
                  <option value="DRAFT">초안</option>
                  <option value="RUNNING">운영중</option>
                  <option value="PAUSED">일시중지</option>
                  <option value="ARCHIVED">보관</option>
                </SimpleSelect>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">설명</label>
                <Textarea
                  {...form.register('description')}
                  placeholder="캠페인 목적, 대상, 유의사항 등을 적어두세요."
                  className={`max-h-[50vh] min-h-[20vh] resize-y md:min-h-[24vh] lg:min-h-[28vh] ${fieldClass}`}
                  rows={5}
                  disabled={formDisabled}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit" disabled={!canWrite || !isDirty || !isValid || saving}>
                  {saving ? '저장 중...' : '저장'}
                </Button>
                <Button type="button" variant="outline" onClick={() => form.reset()} disabled={formDisabled}>
                  변경 취소
                </Button>
              </div>

              <div className="text-xs text-slate-500">
                상태: {isDirty ? '변경됨' : '변경 없음'} · 폼검증: {isValid ? '통과' : '미통과'}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          <Card className={`${cardClass} min-w-0`}>
            <CardHeader>
              <CardTitle>운영 기간</CardTitle>
              <CardDescription>시작/종료 일시를 설정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">시작일시</label>
                <Input
                  type="datetime-local"
                  value={toInputDateTime(form.watch('startAt'))}
                  onChange={(event) =>
                    form.setValue('startAt', fromInputDateTime(event.target.value), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  disabled={formDisabled}
                  className={fieldClass}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">종료일시</label>
                <Input
                  type="datetime-local"
                  value={toInputDateTime(form.watch('endAt'))}
                  onChange={(event) =>
                    form.setValue('endAt', fromInputDateTime(event.target.value), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  disabled={formDisabled}
                  className={fieldClass}
                />
              </div>

              <div className="text-xs leading-5 text-slate-500">* 운영 기간은 런타임/스케줄러와 연결되면 실제 송출 및 콜링 조건으로 사용할 수 있습니다.</div>
            </CardContent>
          </Card>

          <Card className={`${cardClass} min-w-0`}>
            <CardHeader>
              <CardTitle>메타 정보</CardTitle>
              <CardDescription>참고용 읽기 전용 정보입니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">ID</span>
                <span className="min-w-0 break-all text-right font-mono">{campaign.id}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">상태</span>
                <span>{statusLabel(campaign.status)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">생성</span>
                <span className="text-right">{formatKST(campaign.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">수정</span>
                <span className="text-right">{formatKST(campaign.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>

        </div>

        <AlertDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            setDeleteOpen(open);
            if (open) {
              setConfirmName('');
              setForceStopThenDelete(true);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>캠페인을 삭제할까요?</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="space-y-2">
              <span className="block pb-3 pt-2 text-sm text-slate-500">
                삭제하면 <b>복구할 수 없습니다.</b>
                <br />
                삭제하려면 아래 입력칸에 캠페인명을 정확히 입력해 주세요.
              </span>

              {campaign.status === 'RUNNING' ? (
                <span className="my-2 block text-sm">
                  <span className="block font-medium text-rose-600">운영 중인 캠페인은 바로 삭제할 수 없습니다.</span>
                  <label className="mt-2 flex items-center gap-2">
                    <input type="checkbox" checked={forceStopThenDelete} onChange={(event) => setForceStopThenDelete(event.target.checked)} />
                    <span>중지(PAUSED)로 변경 후 삭제 진행</span>
                  </label>
                </span>
              ) : null}
            </AlertDialogDescription>

            <div className="space-y-2 pt-3">
              <label className="text-sm font-medium">캠페인명 입력</label>
              <Input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} placeholder={campaign.name} className={fieldClass} autoFocus />
              <p className="text-xs text-slate-500">입력값이 캠페인명과 일치해야 삭제 버튼이 활성화됩니다.</p>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>취소</AlertDialogCancel>
              <AlertDialogAction
                disabled={!canWrite || deleteMutation.isPending || confirmName.trim() !== campaign.name || (campaign.status === 'RUNNING' && !forceStopThenDelete)}
                onClick={() => {
                  deleteMutation.mutate({ campaign, confirmName, forceStopThenDelete });
                }}
              >
                {deleteMutation.isPending ? '처리 중...' : campaign.status === 'RUNNING' ? '중지 후 삭제' : '삭제'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
