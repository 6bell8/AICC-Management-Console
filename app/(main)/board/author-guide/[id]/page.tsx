'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/app/components/ui/use-toast';

import { deleteAuthorGuide, getAuthorGuide, patchAuthorGuide } from '@/app/lib/api/authorGuide';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Separator } from '@/app/components/ui/separator';
import { Skeleton } from '@/app/components/ui/skeleton';
import { StatusToggle } from '@/app/components/ui/status-toggle';
import type { PublishStatus } from '@/app/lib/types/common';

export default function AuthorGuideDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const id = params?.id;

  const q = useQuery({
    queryKey: ['authorGuide', 'detail', id],
    queryFn: () => getAuthorGuide(String(id)),
    enabled: !!id,
    staleTime: 10_000,
  });

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<PublishStatus>('DRAFT');

  useEffect(() => {
    const g = q.data?.authorGuide;
    if (!g) return;
    setTitle(g.title ?? '');
    setContent(g.content ?? '');
    setStatus(g.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED');
  }, [q.data?.authorGuide]);

  const mSave = useMutation({
    mutationFn: () => patchAuthorGuide(String(id), { title, content, status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['authorGuide', 'detail', id] });
      await qc.invalidateQueries({ queryKey: ['authorGuide', 'list'] });

      toast({
        title: '저장 완료',
        description: '저작가이드가 저장되었습니다.',
      });

      router.push('/board/author-guide');
    },
    onError: (err: any) => {
      toast({
        title: '저장 실패',
        description: err?.message ?? '오류가 발생했습니다.',
        variant: 'destructive',
      });
    },
  });

  const mDel = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('id가 없습니다.');
      return deleteAuthorGuide(String(id));
    },
    onSuccess: async () => {
      qc.removeQueries({ queryKey: ['authorGuide', 'detail', id] });
      await qc.invalidateQueries({ queryKey: ['authorGuide', 'list'] });

      toast({
        title: '삭제 완료',
        description: '저작가이드가 삭제되었습니다.',
      });

      router.push('/board/author-guide');
    },
    onError: (err: any) => {
      toast({
        title: '삭제 실패',
        description: err?.message ?? '오류가 발생했습니다.',
        variant: 'destructive',
      });
    },
  });

  if (q.isPending) {
    return (
      <div className="mx-auto w-full max-w-4xl p-6 space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  if (q.isError || !q.data?.authorGuide) {
    return (
      <div className="mx-auto w-full max-w-4xl p-6 space-y-3">
        <div className="text-sm text-red-600">불러오기 실패</div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/board/author-guide')}>
            목록
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            뒤로
          </Button>
        </div>
      </div>
    );
  }

  const guide = q.data.authorGuide;

  const canSave = title.trim().length > 0 && content.trim().length > 0 && !mSave.isPending && !mDel.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">가이드 상세</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/board/author-guide')}>
            목록
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            뒤로
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="text-sm text-slate-600">제목</div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-2">
        <div className="text-sm text-slate-600">내용</div>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[220px]" />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center justify-end gap-3 w-full">
          <StatusToggle value={status} onChange={setStatus} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="oHGhost" disabled={!canSave} onClick={() => mSave.mutate()}>
          {mSave.isPending ? '저장 중...' : '저장'}
        </Button>

        <Button
          variant="dlOutline"
          disabled={mDel.isPending}
          onClick={() => {
            const ok = window.confirm('정말 삭제할까요?');
            if (ok) mDel.mutate();
          }}
        >
          {mDel.isPending ? '삭제 중...' : '삭제'}
        </Button>
      </div>

      <div className="text-xs text-slate-500">
        생성: {guide.createdAt ? new Date(guide.createdAt).toLocaleString() : '-'} / 수정:{' '}
        {guide.updatedAt ? new Date(guide.updatedAt).toLocaleString() : '-'}
      </div>

      {mSave.isError ? <div className="text-sm text-red-600">저장 실패: {(mSave.error as any)?.message ?? 'error'}</div> : null}
    </div>
  );
}
