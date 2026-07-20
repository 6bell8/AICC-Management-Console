'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Link2, Megaphone, Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { useToast } from '@/app/components/ui/use-toast';

import { deleteNotice, getNotice, patchNotice } from '@/app/lib/api/notice';
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
import { CommentPanel } from '@/app/components/comments/CommentPanel';
import { Input } from '@/app/components/ui/input';
import { LastEditorBadge } from '@/app/components/ui/last-editor-badge';
import { PinnedToggle } from '@/app/components/ui/pinned-toggle';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import { Separator } from '@/app/components/ui/separator';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Textarea } from '@/app/components/ui/textarea';
import { formatKstDate } from '@/app/lib/format/kst';
import type { NoticeAttachment } from '@/app/lib/types/notice';

export default function NoticeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { canWrite } = useCurrentUser();
  const id = params?.id;

  const q = useQuery({ queryKey: ['notice', 'detail', id], queryFn: () => getNotice(String(id)), enabled: !!id });

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [status, setStatus] = useState<'PUBLISHED' | 'DRAFT'>('PUBLISHED');
  const [attachments, setAttachments] = useState<NoticeAttachment[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    const notice = q.data?.notice;
    if (!notice) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(notice.title ?? '');
    setContent(notice.content ?? '');
    setPinned(!!notice.pinned);
    setStatus(notice.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED');
    setAttachments(notice.attachments ?? []);
  }, [q.data?.notice]);

  const normalizedAttachments = attachments
    .map((item) => ({ name: item.name.trim(), url: item.url.trim() }))
    .filter((item) => item.name.length > 0 && item.url.length > 0);

  const dirty = useMemo(() => {
    const notice = q.data?.notice;
    if (!notice) return false;
    return (
      title !== (notice.title ?? '') ||
      content !== (notice.content ?? '') ||
      pinned !== Boolean(notice.pinned) ||
      status !== (notice.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED') ||
      JSON.stringify(normalizedAttachments) !== JSON.stringify(notice.attachments ?? [])
    );
  }, [content, normalizedAttachments, pinned, q.data?.notice, status, title]);

  const mSave = useMutation({
    mutationFn: () => patchNotice(String(id), { title, content, pinned, status, attachments: normalizedAttachments }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notice', 'detail', id] });
      await qc.invalidateQueries({ queryKey: ['notice', 'list'] });
      await qc.invalidateQueries({ queryKey: ['notice', 'banner'] });
      toast({ title: '????꾨즺', description: '怨듭??ы빆????λ릺?덉뒿?덈떎.' });
      router.push('/board/notice');
    },
    onError: (err: Error) => toast({ title: '????ㅽ뙣', description: err.message || '?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.', variant: 'destructive' }),
  });

  const mDel = useMutation({
    mutationFn: () => deleteNotice(String(id)),
    onSuccess: async () => {
      qc.removeQueries({ queryKey: ['notice', 'detail', id] });
      await qc.invalidateQueries({ queryKey: ['notice', 'list'] });
      await qc.invalidateQueries({ queryKey: ['notice', 'banner'] });
      toast({ title: '??젣 ?꾨즺', description: '怨듭??ы빆????젣?덉뒿?덈떎.' });
      router.push('/board/notice');
    },
    onError: (err: Error) => toast({ title: '??젣 ?ㅽ뙣', description: err.message || '?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.', variant: 'destructive' }),
  });

  if (q.isPending) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-3">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  if (q.isError || !q.data?.notice) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-3">
        <div className="text-sm text-red-600">遺덈윭?ㅺ린 ?ㅽ뙣</div>
        <Button
          variant="outline"
          className="h-9 w-9 p-0"
          onClick={() => router.push('/board/notice')}
          aria-label="怨듭??ы빆 紐⑸줉"
          title="怨듭??ы빆 紐⑸줉"
        >
          <ClipboardList className="h-4 w-4 shrink-0" />
        </Button>
      </div>
    );
  }

  const notice = q.data.notice;
  const canSave = canWrite && dirty && title.trim().length > 0 && content.trim().length > 0 && !mSave.isPending;
  const writeDisabled = !canWrite || mSave.isPending || mDel.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="my-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Megaphone className="h-5 w-5 shrink-0 text-sky-600" />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={writeDisabled}
            placeholder="제목을 입력해 주세요"
            className="board-detail-title-input flex-1 px-3 placeholder:text-slate-400"
          />
          <span className="hidden shrink-0 items-center gap-2 sm:flex">
            <LastEditorBadge name={notice.lastEditorName} />
            <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              최근 반영일: {formatKstDate(notice.updatedAt)}
            </span>
          </span>
        </div>
        <div className="flex gap-2 sm:justify-end">
          <Button
            variant="outline"
            className="h-9 w-9 p-0"
            onClick={() => router.push('/board/notice')}
            aria-label="怨듭??ы빆 紐⑸줉"
            title="怨듭??ы빆 紐⑸줉"
          >
            <ClipboardList className="h-4 w-4 shrink-0" />
          </Button>
          <Button variant="outline" className="h-9 w-9 p-0" onClick={() => router.back()} aria-label="뒤로가기" title="뒤로가기">
            <Undo2 className="h-4 w-4 shrink-0" />
          </Button>
        </div>
      </div>

      <Separator className="bg-slate-200" />
      {!canWrite ? <ReadOnlyNotice /> : null}

      <div className="space-y-2">
        <div className="text-sm text-slate-600">?댁슜</div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[320px] border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0 sm:min-h-[360px]"
          disabled={writeDisabled}
        />
      </div>
      <AttachmentFields
        attachments={attachments}
        disabled={writeDisabled}
        onAdd={() => setAttachments((prev) => [...prev, { name: '', url: '' }])}
        onRemove={(index) => setAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
        onChange={(index, patch) => setAttachments((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))}
      />
      <div className="flex justify-end">
        <div className="flex flex-wrap items-center gap-2">
          <PinnedToggle checked={pinned} onCheckedChange={setPinned} disabled={writeDisabled} />
          <Button variant="dlOutline" className="h-9 gap-1.5 px-3" disabled={!canWrite || mDel.isPending} onClick={() => setDeleteConfirmOpen(true)}>
            <Trash2 className="h-4 w-4" />
            <span>{mDel.isPending ? '삭제 중...' : '삭제'}</span>
          </Button>
          <Button variant="oHGhost" className="h-9 gap-1.5 px-3" disabled={!canSave} onClick={() => mSave.mutate()}>
            <Save className="h-4 w-4" />
            <span>{mSave.isPending ? '저장 중...' : '저장'}</span>
          </Button>
        </div>
      </div>

      <div className="pt-6">
        <CommentPanel targetType="NOTICE" targetId={notice.id} />
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => !open && setDeleteConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>怨듭??ы빆????젣?좉퉴??</AlertDialogTitle>
            <AlertDialogDescription>??젣??怨듭??ы빆? 紐⑸줉?먯꽌 ?쒓굅?섎ŉ ?섎룎由????놁뒿?덈떎.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mDel.isPending}>痍⑥냼</AlertDialogCancel>
            <AlertDialogAction
              disabled={mDel.isPending}
              onClick={() => {
                setDeleteConfirmOpen(false);
                mDel.mutate();
              }}
            >
              {mDel.isPending ? '??젣 以?..' : '??젣'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
function AttachmentFields({
  attachments,
  disabled,
  onAdd,
  onChange,
  onRemove,
}: {
  attachments: NoticeAttachment[];
  disabled: boolean;
  onAdd: () => void;
  onChange: (index: number, patch: Partial<NoticeAttachment>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex justify-end">
      <div className="w-full rounded-lg bg-slate-50 p-3 sm:w-auto sm:min-w-[360px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Link2 className="h-4 w-4 text-sky-600" />
              泥⑤? 臾몄꽌
            </div>
            <p className="mt-1 text-xs text-slate-500">?뚯씪 ??μ냼??臾몄꽌 留곹겕瑜??곌껐??怨듭??먯꽌 諛붾줈 ?대엺?????덉뒿?덈떎.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 shrink-0 border-transparent bg-white px-3 text-sky-700 shadow-none hover:border-transparent hover:bg-sky-50 hover:text-sky-800"
            disabled={disabled}
            onClick={onAdd}
          >
            <Plus className="h-4 w-4 shrink-0" />
            留곹겕 異붽?
          </Button>
        </div>

        <div className="mt-3 space-y-2">
          {attachments.length === 0 ? (
            <div className="rounded-md bg-white/70 px-3 py-3 text-sm text-slate-500">?곌껐??泥⑤? 臾몄꽌媛 ?놁뒿?덈떎.</div>
          ) : (
            attachments.map((item, index) => (
              <div key={`attachment-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_44px]">
                <Input
                  value={item.name}
                  onChange={(event) => onChange(index, { name: event.target.value })}
                  placeholder="?쒕ぉ"
                  disabled={disabled}
                  className="border-transparent bg-white shadow-none focus-visible:ring-slate-100 focus-visible:ring-offset-0"
                />
                <Input
                  value={item.url}
                  onChange={(event) => onChange(index, { url: event.target.value })}
                  placeholder="臾몄꽌 留곹겕 URL"
                  disabled={disabled}
                  className="border-transparent bg-white shadow-none focus-visible:ring-slate-100 focus-visible:ring-offset-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-10 min-w-10 border-transparent bg-white !p-0 text-rose-600 shadow-none hover:border-transparent hover:bg-rose-50 hover:text-rose-700"
                  disabled={disabled}
                  onClick={() => onRemove(index)}
                  aria-label="泥⑤? ??젣"
                  title="泥⑤? ??젣"
                >
                  <Trash2 size={12} strokeWidth={1.5} className="shrink-0" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
