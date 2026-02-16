'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCampaign, patchCampaign, deleteCampaign } from '../../../lib/api/campaigns';
import { campaignUpdateSchema, type CampaignUpdateFormValues } from '../../../lib/schemas/campaigns';
import type { Campaign, CampaignStatus } from '../../../lib/types/campaign';

import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Skeleton } from '../../../components/ui/skeleton';
import { Separator } from '../../../components/ui/separator';
import { SimpleSelect } from '../../../components/ui/select';
import { useToast } from '../../../components/ui/use-toast';
import { ChevronRight, ArrowLeft, Save } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '../../../components/ui/alert-dialog';
import { VisuallyHidden } from '../../../components/ui/visually-hidden';

function statusLabel(s: CampaignStatus) {
  switch (s) {
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

function statusBadgeVariant(s: CampaignStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (s) {
    case 'RUNNING':
      return 'default';
    case 'PAUSED':
      return 'secondary';
    case 'ARCHIVED':
      return 'outline';
    case 'DRAFT':
      return 'secondary';
  }
}

function toInputDateTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromInputDateTime(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function formatKST(iso: string) {
  return new Date(iso).toLocaleString();
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

function ErrorState({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack: () => void }) {
  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>불러오기 실패</CardTitle>
          <CardDescription className="break-words">{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
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
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>캠페인을 찾을 수 없습니다</CardTitle>
          <CardDescription>존재하지 않거나 권한이 없을 수 있습니다.</CardDescription>
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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [forceStopThenDelete, setForceStopThenDelete] = useState(true); // RUNNING일 때 기본 체크

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
    const c = q.data;
    form.reset({
      name: c.name,
      description: c.description ?? '',
      status: c.status,
      startAt: c.startAt ?? null,
      endAt: c.endAt ?? null,
    });
  }, [q.data, form]);

  const m = useMutation({
    mutationFn: (values: CampaignUpdateFormValues) => {
      const sanitizedValues: CampaignUpdateFormValues = {
        ...values,
        startAt: values.startAt ?? null,
        endAt: values.endAt ?? null,
      };
      return patchCampaign(id, sanitizedValues);
    },
    onSuccess: (updated) => {
      qc.setQueryData(['campaign', id], updated);
      qc.invalidateQueries({ queryKey: ['campaigns'] });

      toast({ title: '저장 완료', description: '캠페인 정보가 업데이트되었습니다.' });

      // ✅ 저장 완료 후 목록으로 이동
      router.replace('/campaigns');
    },
    onError: (err) => {
      toast({
        title: '저장 실패',
        description: err instanceof Error ? err.message : '알 수 없는 오류',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (payload: { campaign: Campaign; confirmName: string; forceStopThenDelete: boolean }) => {
      const { campaign, confirmName, forceStopThenDelete } = payload;

      // 1) 캠페인명 입력 확인(클라 1차)
      if (confirmName.trim() !== campaign.name) {
        throw new Error('캠페인명이 일치하지 않습니다.');
      }

      // 2) RUNNING이면 바로 삭제 불가 → 체크되어 있으면 PAUSED로 변경 후 삭제
      if (campaign.status === 'RUNNING') {
        if (!forceStopThenDelete) {
          throw new Error('운영 중 캠페인은 삭제할 수 없습니다. “중지 후 삭제”를 선택해 주세요.');
        }

        // ✅ 저장 버튼 방식 유지: 여기서만 예외적으로 PATCH(상태만 변경)
        // 주의: “현재 저장된 캠페인 값” 기준으로 PATCH합니다(폼의 미저장 변경사항은 반영 안 함).
        await patchCampaign(campaign.id, {
          name: campaign.name,
          description: campaign.description ?? '',
          status: 'PAUSED',
          startAt: campaign.startAt ?? null,
          endAt: campaign.endAt ?? null,
        });
      }

      // 3) 하드 삭제
      await deleteCampaign(campaign.id);
    },
    onSuccess: () => {
      toast({
        title: '삭제 완료',
        description: '캠페인이 영구 삭제되었습니다.',
        variant: 'destructive', // (빨간 강조는 나중에 커스터마이징 예정)
      });
      setDeleteOpen(false);
      router.replace('/campaigns');
    },
    onError: (err) => {
      toast({
        title: '삭제 실패',
        description: err instanceof Error ? err.message : '알 수 없는 오류',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = form.handleSubmit((values) => m.mutate(values));

  if (q.isLoading) return <LoadingSkeleton />;
  if (q.isError) {
    return (
      <ErrorState
        message={q.error instanceof Error ? q.error.message : 'Unknown Error'}
        onRetry={() => q.refetch()}
        onBack={() => router.replace('/campaigns')}
      />
    );
  }
  if (!q.data) return <NotFoundState onBack={() => router.replace('/campaigns')} />;

  const c: Campaign = q.data;
  const isDirty = form.formState.isDirty;
  const isValid = form.formState.isValid;
  const saving = m.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl p-6 space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button type="button" className="hover:text-foreground transition" onClick={() => router.replace('/campaigns')}>
          캠페인
        </button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{c.id}</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <Badge variant={statusBadgeVariant(c.status)}>{statusLabel(c.status)}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            created: {formatKST(c.createdAt)} · updated: {formatKST(c.updatedAt)}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.replace('/campaigns')} disabled={saving}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            목록
          </Button>
          <Button onClick={onSubmit} disabled={!isDirty || !isValid || saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
            <CardDescription>캠페인 이름/상태/설명을 수정할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium">캠페인 이름</label>
                <Input {...form.register('name')} placeholder="예) 2026 Q1 아웃바운드 캠페인" />
                {form.formState.errors.name?.message ? <p className="text-xs text-red-500">{form.formState.errors.name.message}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium mr-3">상태</label>
                <SimpleSelect
                  value={form.watch('status')}
                  onChange={(e) =>
                    form.setValue('status', e.target.value as CampaignStatus, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
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
                  className="resize-y min-h-[20vh] md:min-h-[24vh] lg:min-h-[28vh] max-h-[50vh]"
                  rows={5}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={!isDirty || !isValid || saving}>
                  {saving ? '저장 중…' : '저장'}
                </Button>
                <Button type="button" variant="outline" onClick={() => form.reset()} disabled={saving}>
                  변경 취소
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                상태: {isDirty ? '변경됨' : '변경 없음'} · 폼검증: {isValid ? '통과' : '미통과'}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex h-full flex-col justify-between">
          <Card>
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
                  onChange={(e) =>
                    form.setValue('startAt', fromInputDateTime(e.target.value), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">종료일시</label>
                <Input
                  type="datetime-local"
                  value={toInputDateTime(form.watch('endAt'))}
                  onChange={(e) =>
                    form.setValue('endAt', fromInputDateTime(e.target.value), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </div>

              <div className="text-xs text-muted-foreground">* 운영 기간은 “런타임/스케줄러”와 연결되면 실제 송출/콜링 조건으로 사용됩니다.</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>메타 정보</CardTitle>
              <CardDescription>참고용(읽기 전용)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono">{c.id}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">상태</span>
                <span>{statusLabel(c.status)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">생성</span>
                <span>{formatKST(c.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">수정</span>
                <span>{formatKST(c.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive"> 캠페인 삭제</CardTitle>
              <CardDescription className="block mt-1 text-red-500">
                삭제 시 복구할 수 없습니다.{''}
                {form.formState.isDirty ? (
                  <span className="block mt-1 text-destructive">* 저장되지 않은 변경사항이 있습니다. 삭제하면 반영되지 않습니다.</span>
                ) : null}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
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
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={saving || deleteMutation.isPending} onClick={() => setDeleteOpen(true)}>
                    캠페인 삭제
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>캠페인을 삭제하시겠습니까?</AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription className="space-y-2">
                    <span className="block text-sm text-muted-foreground pt-2 pb-3">
                      삭제하면 <b>복구할 수 없습니다.</b>
                      <br />
                      삭제하려면 아래 입력칸에 캠페인명을 정확히 입력해 주세요.
                    </span>

                    {c.status === 'RUNNING' ? (
                      <span className="block my-2 text-sm">
                        <span className="block text-destructive font-medium text-red-500">운영 중(RUNNING) 캠페인은 바로 삭제할 수 없습니다.</span>

                        <label className="mt-2 flex items-center gap-2">
                          <input type="checkbox" checked={forceStopThenDelete} onChange={(e) => setForceStopThenDelete(e.target.checked)} />
                          <span>중지(PAUSED)로 변경 후 삭제 진행</span>
                        </label>
                      </span>
                    ) : null}
                  </AlertDialogDescription>

                  <div className="space-y-2 pt-3">
                    <label className="text-sm font-medium ">캠페인명 입력</label>
                    <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={c.name} autoFocus />
                    <p className="text-xs text-muted-foreground">입력값이 캠페인명과 일치해야 삭제 버튼이 활성화됩니다.</p>
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteMutation.isPending}>취소</AlertDialogCancel>

                    <AlertDialogAction
                      disabled={deleteMutation.isPending || confirmName.trim() !== c.name || (c.status === 'RUNNING' && !forceStopThenDelete)}
                      onClick={() => {
                        deleteMutation.mutate({ campaign: c, confirmName, forceStopThenDelete });
                      }}
                    >
                      {deleteMutation.isPending ? '처리 중…' : c.status === 'RUNNING' ? '중지 후 삭제' : '삭제'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
