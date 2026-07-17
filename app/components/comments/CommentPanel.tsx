'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send, Trash2 } from 'lucide-react';

import type { CommentTargetType, PostComment } from '@/app/lib/types/comments';
import { useCurrentUser } from '@/app/lib/auth/useCurrentUser';
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

type CommentsResponse = {
  items: PostComment[];
};

export function CommentPanel({
  compact = false,
  targetId,
  targetType,
}: {
  compact?: boolean;
  targetId: string;
  targetType: CommentTargetType;
}) {
  const qc = useQueryClient();
  const { canWrite, user } = useCurrentUser();
  const [content, setContent] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PostComment | null>(null);
  const queryKey = ['comments', targetType, targetId];

  const query = useQuery<CommentsResponse>({
    queryKey,
    queryFn: async () => {
      const qs = new URLSearchParams({ targetType, targetId });
      const res = await fetch(`/api/comments?${qs.toString()}`, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '댓글을 불러오지 못했습니다.');
      return body;
    },
    enabled: Boolean(targetId),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, content }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '댓글을 저장하지 못했습니다.');
      return body;
    },
    onSuccess: async () => {
      setContent('');
      await qc.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/comments/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '댓글을 삭제하지 못했습니다.');
      return body;
    },
    onSuccess: async () => {
      setDeleteTarget(null);
      await qc.invalidateQueries({ queryKey });
    },
  });

  const items = query.data?.items ?? [];
  const trimmed = content.trim();
  const canSubmit = Boolean(canWrite && trimmed && !createMutation.isPending);

  return (
    <section className={compact ? 'mt-3 border-t border-slate-100 pt-3' : 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm'}>
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MessageCircle className="h-4 w-4 text-sky-600" />
          댓글
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
            {items.length}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {query.isLoading ? (
          <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-500">댓글을 불러오는 중입니다.</div>
        ) : items.length > 0 ? (
          items.map((item) => (
            <article key={item.id} className="rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-800">{item.authorName}</span>
                    <span className="text-slate-400">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.content}</p>
                </div>
                {item.canDelete ? (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    disabled={deleteMutation.isPending}
                    className="soft-interactive inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-rose-100 bg-white text-rose-600 hover:bg-rose-50 disabled:pointer-events-none disabled:opacity-45"
                    aria-label="댓글 삭제"
                    title="댓글 삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-sm text-slate-500">아직 댓글이 없습니다.</div>
        )}
      </div>

      {canWrite ? (
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_40px]"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) createMutation.mutate();
          }}
        >
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={2000}
            rows={compact ? 2 : 3}
            className="min-h-20 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-sky-100 focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
            placeholder={`${user?.name ?? '작성자'}님 의견을 남겨주세요.`}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="soft-interactive inline-flex h-10 w-10 items-center justify-center rounded-md border border-sky-100 bg-sky-50 text-sky-700 shadow-sm hover:bg-sky-100 disabled:pointer-events-none disabled:opacity-45 sm:h-full"
            aria-label="댓글 등록"
            title="댓글 등록"
          >
            <Send className="h-4 w-4" />
          </button>
          {createMutation.error ? <p className="text-sm text-rose-600 sm:col-span-2">{createMutation.error.message}</p> : null}
        </form>
      ) : (
        <p className="mt-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">댓글 작성은 승인된 작성 권한 계정에서 가능합니다.</p>
      )}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>댓글을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>삭제한 댓글은 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
