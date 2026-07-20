'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ClipboardList, Code2, Save, Trash2, Upload } from 'lucide-react';

import DynNodeRunner from '../../../../components/dynnode/DynnodeRunner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Button } from '@/app/components/ui/button';
import { DetailTimestampBadge } from '@/app/components/ui/detail-timestamp-badge';
import { Input } from '@/app/components/ui/input';
import { LastEditorBadge } from '@/app/components/ui/last-editor-badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import { useToast } from '@/app/components/ui/use-toast';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import { deleteDynnode, deleteDynNodeTemplate, getDynNode, patchDynNode, uploadDynNodeTemplate } from '@/app/lib/api/dynnode';
import type { DynNodeTemplateFile } from '@/app/lib/types/dynnode';

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

  const [draft, setDraft] = useState<DynNodeDraft | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateDeleteConfirmOpen, setTemplateDeleteConfirmOpen] = useState(false);
  const [templateInputKey, setTemplateInputKey] = useState(0);

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
      toast({ title: '저장 완료', description: '변경사항이 저장되었습니다.' });
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

  const uploadTemplateM = useMutation({
    mutationFn: (file: File) => uploadDynNodeTemplate(id, file),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['dynnode', id] });
      await qc.invalidateQueries({ queryKey: ['dynnode', 'list'] });
      setTemplateInputKey((value) => value + 1);
      toast({ title: '업로드 완료', description: '소스/예시 파일 ZIP이 첨부되었습니다.' });
    },
    onError: (error: Error) =>
      toast({ title: '업로드 실패', description: error.message || '소스/예시 파일 업로드 중 오류가 발생했습니다.', variant: 'destructive' }),
  });

  const deleteTemplateM = useMutation({
    mutationFn: () => deleteDynNodeTemplate(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['dynnode', id] });
      await qc.invalidateQueries({ queryKey: ['dynnode', 'list'] });
      toast({ title: '삭제 완료', description: '첨부된 소스/예시 파일을 삭제했습니다.' });
    },
    onError: (error: Error) =>
      toast({ title: '삭제 실패', description: error.message || '소스/예시 파일 삭제 중 오류가 발생했습니다.', variant: 'destructive' }),
  });

  const busy = saveM.isPending || delM.isPending || uploadTemplateM.isPending || deleteTemplateM.isPending;
  const writeDisabled = !canWrite || busy;

  if (q.isLoading) return <DetailSkeleton />;
  if (!post) return <div className="text-sm text-slate-500">게시글을 찾을 수 없습니다.</div>;

  return (
    <div className={['space-y-4', busy ? 'pointer-events-none opacity-60' : ''].join(' ')}>
      <div className="my-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Code2 className="h-5 w-5 shrink-0 text-sky-600" />
          {canWrite ? (
            <Input
              value={values.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
              placeholder="제목을 입력해 주세요"
              className="board-detail-title-input flex-1 px-3 mr-6 placeholder:text-slate-400"
              disabled={writeDisabled}
            />
          ) : (
            <h1 className="flex min-w-0 items-center truncate text-xl font-semibold sm:text-2xl">
              <span className="min-w-0 truncate">{post.title}</span>
            </h1>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 sm:shrink-0">
          <Button
            variant="outline"
            className="h-9 w-9 p-0"
            onClick={() => router.push('/board/dynnode')}
            disabled={busy}
            aria-label="동적노드 목록"
            title="동적노드 목록"
          >
            <ClipboardList className="h-4 w-4 shrink-0" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={writeDisabled}
            className="h-9 w-9 gap-2 border-rose-100 bg-rose-50 p-0 text-rose-700 hover:border-rose-200 hover:bg-rose-100 hover:text-rose-800 sm:w-auto sm:px-3"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">삭제</span>
          </Button>
          {canWrite ? (
            <Button
              variant="outline"
              onClick={() => saveM.mutate()}
              disabled={writeDisabled || !dirty}
              className="h-9 w-9 gap-2 border-sky-100 p-0 text-sky-700 hover:border-sky-200 hover:bg-sky-50 sm:w-auto sm:px-3"
            >
              <Save className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">저장</span>
            </Button>
          ) : null}
        </div>
      </div>

      {!canWrite ? <ReadOnlyNotice /> : null}

      <TemplatePanel
        canWrite={canWrite}
        disabled={busy}
        inputKey={templateInputKey}
        postId={id}
        templateFile={post.templateFile ?? null}
        onDelete={() => setTemplateDeleteConfirmOpen(true)}
        onUpload={(file) => uploadTemplateM.mutate(file)}
      />

      <DynNodeRunner
        code={values.code}
        onChangeCode={canWrite ? (code) => updateDraft({ code }) : () => undefined}
        ctxKey={values.ctxKey}
        onChangeCtxKey={canWrite ? (ctxKey) => updateDraft({ ctxKey }) : () => undefined}
        ctxText={values.sampleCtx}
        onChangeCtxText={canWrite ? (sampleCtx) => updateDraft({ sampleCtx }) : () => undefined}
        disabled={!canWrite || busy}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => !open && setDeleteConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>동적노드를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>삭제하면 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={delM.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={delM.isPending}
              onClick={() => {
                setDeleteConfirmOpen(false);
                delM.mutate();
              }}
            >
              {delM.isPending ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={templateDeleteConfirmOpen} onOpenChange={(open) => !open && setTemplateDeleteConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>소스/예시 파일을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>삭제하면 첨부된 ZIP 파일을 다시 다운로드할 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTemplateM.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteTemplateM.isPending}
              onClick={() => {
                setTemplateDeleteConfirmOpen(false);
                deleteTemplateM.mutate();
              }}
            >
              {deleteTemplateM.isPending ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let next = value;
  let unitIndex = 0;
  while (next >= 1024 && unitIndex < units.length - 1) {
    next /= 1024;
    unitIndex += 1;
  }
  return `${next >= 10 || unitIndex === 0 ? Math.round(next) : next.toFixed(1)}${units[unitIndex]}`;
}

function TemplatePanel({
  canWrite,
  disabled,
  inputKey,
  onDelete,
  onUpload,
  postId,
  templateFile,
}: {
  canWrite: boolean;
  disabled: boolean;
  inputKey: number;
  onDelete: () => void;
  onUpload: (file: File) => void;
  postId: string;
  templateFile: DynNodeTemplateFile | null;
}) {
  return (
    <section className="flex justify-end">
      <div className="flex w-full items-center justify-end gap-2 rounded-lg bg-slate-50 px-3 py-2 sm:w-auto sm:max-w-full">
        <div className="min-w-0 text-right">
          <div className="flex min-w-0 items-center justify-end gap-2 text-sm font-semibold text-slate-950 [&>span:last-child]:hidden">
            <Archive className="h-4 w-4 shrink-0 text-sky-600" />
            <span>소스/예시 파일 ZIP</span>
            <span>소스/예시 파일 ZIP</span>
          </div>
          {templateFile ? (
            <div className="mt-1 truncate text-xs text-slate-500">
              <a
                href={`/api/dynnode/${encodeURIComponent(postId)}/template/download`}
                className="font-medium text-sky-700 hover:underline"
                title={`${templateFile.originalName} 다운로드`}
              >
                {templateFile.originalName}
              </a>
              <span className="mx-1 text-slate-300">·</span>
              <span>{templateFile.fileCount} files</span>
              <span className="mx-1 text-slate-300">·</span>
              <span>{formatBytes(templateFile.fileSize)}</span>
            </div>
          ) : (
            <div className="mt-1 text-xs text-slate-500">프로젝트 단위 소스/예시 파일 ZIP을 첨부할 수 있습니다.</div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1">
          {canWrite ? (
            <>
              <label
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-sky-700 aria-disabled:pointer-events-none aria-disabled:opacity-45"
                aria-disabled={disabled}
                title={templateFile ? '소스/예시 파일 교체' : '소스/예시 파일 업로드'}
              >
                <input
                  key={inputKey}
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  className="sr-only"
                  disabled={disabled}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUpload(file);
                  }}
                />
                <Upload className="h-4 w-4 shrink-0" />
              </label>
              {templateFile ? (
                <Button
                  type="button"
                  variant="hoverGhost"
                  size="icon"
                  className="h-8 w-8 shrink-0 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  disabled={disabled}
                  onClick={onDelete}
                  aria-label="소스/예시 파일 삭제"
                  title="소스/예시 파일 삭제"
                >
                  <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </section>
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
