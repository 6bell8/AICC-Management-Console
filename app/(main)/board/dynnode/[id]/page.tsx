'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Code2, Pencil, Save, Trash2, X } from 'lucide-react';

import DynNodeRunner from '../../../../components/dynnode/DynnodeRunner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Skeleton } from '@/app/components/ui/skeleton';
import { useToast } from '@/app/components/ui/use-toast';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import { deleteDynnode, getDynNode, patchDynNode } from '@/app/lib/api/dynnode';

type DynNodeDraft = {
  title: string;
  summary: string;
  code: string;
  sampleCtx: string;
  ctxKey: string;
};

export default function DynNodeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { canWrite } = useCurrentUser();

  const q = useQuery({ queryKey: ['dynnode', id], queryFn: () => getDynNode(id) });
  const post = q.data?.post;

  const [isEdit, setIsEdit] = useState(false);
  const [draft, setDraft] = useState<DynNodeDraft | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const values = draft ?? {
    title: post?.title ?? '',
    summary: post?.summary ?? '',
    code: post?.code ?? '',
    sampleCtx: post?.sampleCtx ?? '',
    ctxKey: post?.ctxKey ?? 'api:API01',
  };

  const dirty = useMemo(() => {
    if (!post) return false;
    return (
      values.title !== post.title ||
      values.summary !== (post.summary ?? '') ||
      values.code !== post.code ||
      values.sampleCtx !== post.sampleCtx ||
      values.ctxKey !== post.ctxKey
    );
  }, [post, values.code, values.ctxKey, values.sampleCtx, values.summary, values.title]);

  const updateDraft = (patch: Partial<DynNodeDraft>) => {
    setDraft((current) => ({ ...values, ...current, ...patch }));
  };

  const saveM = useMutation({
    mutationFn: () =>
      patchDynNode(id, {
        title: values.title.trim() || '제목 없음',
        summary: values.summary.trim() || null,
        code: values.code,
        sampleCtx: values.sampleCtx,
        ctxKey: values.ctxKey.trim() || 'api:API01',
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['dynnode', id] });
      await qc.invalidateQueries({ queryKey: ['dynnode', 'list'] });
      setDraft(null);
      setIsEdit(false);
      toast({ title: '저장 완료', description: '변경사항이 저장되었습니다.' });
      router.push('/board/dynnode');
    },
    onError: (error: Error) => toast({ title: '저장 실패', description: error.message || '저장 중 오류가 발생했습니다.', variant: 'destructive' }),
  });

  const delM = useMutation({
    mutationFn: () => deleteDynnode(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['dynnode', 'list'] });
      await qc.removeQueries({ queryKey: ['dynnode', id] });
      toast({ title: '삭제 완료', description: '게시글을 삭제했습니다.' });
      router.push('/board/dynnode');
    },
    onError: (error: Error) => toast({ title: '삭제 실패', description: error.message || '삭제 중 오류가 발생했습니다.', variant: 'destructive' }),
  });

  const onCancel = () => {
    setDraft(null);
    setIsEdit(false);
  };

  const busy = saveM.isPending || delM.isPending;
  const writeDisabled = !canWrite || busy;

  if (q.isLoading) return <DetailSkeleton />;
  if (!post) return <div className="text-sm text-slate-500">게시글을 찾을 수 없습니다.</div>;

  return (
    <div className={['space-y-4', busy ? 'pointer-events-none opacity-60' : ''].join(' ')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {isEdit ? (
            <Input
              value={values.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
              placeholder="제목을 입력해 주세요"
              className="h-12 border-slate-200 bg-white text-xl font-semibold shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0"
              disabled={writeDisabled}
            />
          ) : (
            <h1 className="flex min-w-0 items-center gap-2 truncate text-xl font-semibold sm:text-2xl">
              <Code2 className="h-5 w-5 shrink-0 text-sky-600" />
              {post.title}
            </h1>
          )}
          <div className="text-xs text-slate-500">updated: {new Date(post.updatedAt).toLocaleString()}</div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 sm:shrink-0">
          <Button variant="outline" className="h-9 w-9 p-0" onClick={() => router.push('/board/dynnode')} disabled={busy} aria-label="동적노드 목록" title="동적노드 목록">
            <ClipboardList className="h-4 w-4 shrink-0" />
          </Button>
          {!isEdit ? (
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(true)} disabled={writeDisabled} className="h-9 w-9 gap-2 border-rose-100 bg-rose-50 p-0 text-rose-700 hover:border-rose-200 hover:bg-rose-100 hover:text-rose-800 sm:w-auto sm:px-3">
              <Trash2 className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">삭제</span>
            </Button>
          ) : null}
          {isEdit ? (
            <>
              <Button variant="outline" onClick={onCancel} disabled={busy} className="h-9 w-9 gap-2 p-0 sm:w-auto sm:px-3">
                <X className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">취소</span>
              </Button>
              <Button variant="outline" onClick={() => saveM.mutate()} disabled={writeDisabled || !dirty} className="h-9 w-9 gap-2 border-sky-100 p-0 text-sky-700 hover:border-sky-200 hover:bg-sky-50 sm:w-auto sm:px-3">
                <Save className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">저장</span>
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => { setDraft(values); setIsEdit(true); }} disabled={writeDisabled} className="h-9 w-9 gap-2 p-0 sm:w-auto sm:px-3">
              <Pencil className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">수정</span>
            </Button>
          )}
        </div>
      </div>

      {!canWrite ? <ReadOnlyNotice /> : null}
      <DynNodeRunner
        code={values.code}
        onChangeCode={canWrite ? (code) => updateDraft({ code }) : () => undefined}
        ctxKey={values.ctxKey}
        onChangeCtxKey={canWrite ? (ctxKey) => updateDraft({ ctxKey }) : () => undefined}
        ctxText={values.sampleCtx}
        onChangeCtxText={canWrite ? (sampleCtx) => updateDraft({ sampleCtx }) : () => undefined}
        disabled={!canWrite || busy}
      />
      {deleteConfirmOpen ? (
        <ConfirmDeleteModal
          title="동적노드를 삭제할까요?"
          description="삭제하면 되돌릴 수 없습니다."
          pending={delM.isPending}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={() => {
            setDeleteConfirmOpen(false);
            delM.mutate();
          }}
        />
      ) : null}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="flex shrink-0 gap-2">
          <Skeleton className="h-9 w-9 sm:w-16" />
          <Skeleton className="h-9 w-9 sm:w-16" />
          <Skeleton className="h-9 w-9 sm:w-16" />
        </div>
      </div>
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-60 max-w-full" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-[260px] w-full" />
          <Skeleton className="h-[260px] w-full" />
          <Skeleton className="h-[260px] w-full" />
          <Skeleton className="h-[260px] w-full" />
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ description, onClose, onConfirm, pending, title }: { description: string; onClose: () => void; onConfirm: () => void; pending: boolean; title: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-950/35" aria-label="삭제 확인 닫기" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="text-base font-semibold text-slate-950">{title}</div>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-45">
            닫기
          </button>
          <button type="button" onClick={onConfirm} disabled={pending} className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:pointer-events-none disabled:opacity-45">
            {pending ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}
