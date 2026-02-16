'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/app/components/ui/use-toast';

import { deleteNotice, getNotice, patchNotice } from '@/app/lib/api/notice';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Separator } from '@/app/components/ui/separator';
import { Skeleton } from '@/app/components/ui/skeleton';

export default function NoticeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const id = params?.id;

  const q = useQuery({
    queryKey: ['notice', 'detail', id],
    queryFn: () => getNotice(String(id)),
    enabled: !!id,
  });

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [status, setStatus] = useState<'PUBLISHED' | 'DRAFT'>('PUBLISHED');

  useEffect(() => {
    const n = q.data?.notice;
    if (!n) return;
    setTitle(n.title ?? '');
    setContent(n.content ?? '');
    setPinned(!!n.pinned);
    setStatus(n.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED');
  }, [q.data?.notice]);

  const mSave = useMutation({
    mutationFn: () => patchNotice(String(id), { title, content, pinned, status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notice', 'detail', id] });
      await qc.invalidateQueries({ queryKey: ['notice', 'list'] });
      await qc.invalidateQueries({ queryKey: ['notice', 'banner'] });

      toast({ title: '저장 완료', description: '공지사항이 저장되었습니다.' });
      router.push('/board/notice');
    },
  });

  const mDel = useMutation({
    mutationFn: () => deleteNotice(String(id)),
    onSuccess: async () => {
      qc.removeQueries({ queryKey: ['notice', 'detail', id] });
      await qc.invalidateQueries({ queryKey: ['notice', 'list'] });
      await qc.invalidateQueries({ queryKey: ['notice', 'banner'] });

      toast({ title: '삭제 완료', description: '공지사항이 삭제되었습니다.' });
      router.push('/board/notice');
    },
    onError: (err: any) => {
      toast({ title: '삭제 실패', description: err?.message ?? '오류가 발생했습니다.', variant: 'destructive' });
    },
  });

  if (q.isPending) {
    return (
      <div className="mx-auto w-full max-w-4xl p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  if (q.isError || !q.data?.notice) {
    return (
      <div className="mx-auto w-full max-w-4xl p-6 space-y-3">
        <div className="text-sm text-red-600">불러오기 실패</div>
        <Button variant="outline" onClick={() => router.push('/board/notice')}>
          목록
        </Button>
      </div>
    );
  }

  const notice = q.data.notice;
  const canSave = title.trim() && content.trim() && !mSave.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">공지 상세</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/board/notice')}>
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          상단 고정(배너 우선)
        </label>

        <div className="ml-auto flex gap-2">
          <Button variant={status === 'PUBLISHED' ? 'secondary' : 'outline'} onClick={() => setStatus('PUBLISHED')} type="button">
            공개
          </Button>
          <Button variant={status === 'DRAFT' ? 'draft' : 'outline'} onClick={() => setStatus('DRAFT')} type="button">
            임시저장
          </Button>
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
        생성: {notice.createdAt ? new Date(notice.createdAt).toLocaleString() : '-'} / 수정:{' '}
        {notice.updatedAt ? new Date(notice.updatedAt).toLocaleString() : '-'}
      </div>
    </div>
  );
}
