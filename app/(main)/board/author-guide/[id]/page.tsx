'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ClipboardList, Undo2 } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import { Separator } from '@/app/components/ui/separator';
import { Skeleton } from '@/app/components/ui/skeleton';
import { StatusToggle } from '@/app/components/ui/status-toggle';
import { Textarea } from '@/app/components/ui/textarea';
import { useToast } from '@/app/components/ui/use-toast';
import { deleteAuthorGuide, getAuthorGuide, patchAuthorGuide } from '@/app/lib/api/authorGuide';
import type { PublishStatus } from '@/app/lib/types/common';

export default function AuthorGuideDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { canWrite } = useCurrentUser();
  const id = params?.id;

  const q = useQuery({ queryKey: ['authorGuide', 'detail', id], queryFn: () => getAuthorGuide(String(id)), enabled: Boolean(id), staleTime: 10_000 });

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<PublishStatus>('DRAFT');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    const guide = q.data?.authorGuide;
    if (!guide) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(guide.title ?? '');
    setContent(guide.content ?? '');
    setStatus(guide.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED');
  }, [q.data?.authorGuide]);

  const mSave = useMutation({
    mutationFn: () => patchAuthorGuide(String(id), { title, content, status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['authorGuide', 'detail', id] });
      await qc.invalidateQueries({ queryKey: ['authorGuide', 'list'] });
      toast({ title: '저장 완료', description: '저작가이드가 저장되었습니다.' });
      router.push('/board/author-guide');
    },
    onError: (error: Error) => toast({ title: '저장 실패', description: error.message || '오류가 발생했습니다.', variant: 'destructive' }),
  });

  const mDel = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('id가 없습니다.');
      return deleteAuthorGuide(String(id));
    },
    onSuccess: async () => {
      qc.removeQueries({ queryKey: ['authorGuide', 'detail', id] });
      await qc.invalidateQueries({ queryKey: ['authorGuide', 'list'] });
      toast({ title: '삭제 완료', description: '저작가이드가 삭제되었습니다.' });
      router.push('/board/author-guide');
    },
    onError: (error: Error) => toast({ title: '삭제 실패', description: error.message || '오류가 발생했습니다.', variant: 'destructive' }),
  });

  if (q.isPending) return <div className="mx-auto w-full max-w-4xl space-y-3"><Skeleton className="h-8 w-56 max-w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-44 w-full" /></div>;

  if (q.isError || !q.data?.authorGuide) {
    return <div className="mx-auto w-full max-w-4xl space-y-3"><div className="text-sm text-red-600">불러오기 실패</div><div className="flex gap-2"><Button variant="outline" className="h-9 w-9 p-0" onClick={() => router.push('/board/author-guide')} aria-label="저작가이드 목록" title="저작가이드 목록"><ClipboardList className="h-4 w-4 shrink-0" /></Button><Button variant="outline" className="h-9 w-9 p-0" onClick={() => router.back()} aria-label="뒤로가기" title="뒤로가기"><Undo2 className="h-4 w-4 shrink-0" /></Button></div></div>;
  }

  const guide = q.data.authorGuide;
  const canSave = canWrite && title.trim().length > 0 && content.trim().length > 0 && !mSave.isPending && !mDel.isPending;
  const writeDisabled = !canWrite || mSave.isPending || mDel.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3"><h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold sm:text-2xl"><BookOpen className="h-5 w-5 text-sky-600" />가이드 상세</h1><div className="flex gap-2 sm:justify-end"><Button variant="outline" className="h-9 w-9 p-0" onClick={() => router.push('/board/author-guide')} aria-label="저작가이드 목록" title="저작가이드 목록"><ClipboardList className="h-4 w-4 shrink-0" /></Button><Button variant="outline" className="h-9 w-9 p-0" onClick={() => router.back()} aria-label="뒤로가기" title="뒤로가기"><Undo2 className="h-4 w-4 shrink-0" /></Button></div></div>
      <Separator className="bg-slate-200" />
      {!canWrite ? <ReadOnlyNotice /> : null}
      <div className="space-y-2"><div className="text-sm text-slate-600">제목</div><Input value={title} onChange={(event) => setTitle(event.target.value)} disabled={writeDisabled} className="border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0" /></div>
      <div className="space-y-2"><div className="text-sm text-slate-600">내용</div><Textarea value={content} onChange={(event) => setContent(event.target.value)} className="min-h-[320px] border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0 sm:min-h-[360px]" disabled={writeDisabled} /></div>
      <div className="flex w-full items-center justify-end gap-3"><StatusToggle value={status} onChange={canWrite ? setStatus : () => undefined} /></div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><Button variant="oHGhost" disabled={!canSave} onClick={() => mSave.mutate()}>{mSave.isPending ? '저장 중...' : '저장'}</Button><Button variant="dlOutline" disabled={!canWrite || mDel.isPending} onClick={() => setDeleteConfirmOpen(true)}>{mDel.isPending ? '삭제 중...' : '삭제'}</Button></div>
      <div className="text-xs text-slate-500">생성: {guide.createdAt ? new Date(guide.createdAt).toLocaleString() : '-'} / 수정: {guide.updatedAt ? new Date(guide.updatedAt).toLocaleString() : '-'}</div>
      {mSave.isError ? <div className="text-sm text-red-600">저장 실패: {(mSave.error as Error)?.message ?? 'error'}</div> : null}
      {deleteConfirmOpen ? <ConfirmDeleteModal title="저작가이드를 삭제할까요?" description="삭제하면 되돌릴 수 없습니다." pending={mDel.isPending} onClose={() => setDeleteConfirmOpen(false)} onConfirm={() => { setDeleteConfirmOpen(false); mDel.mutate(); }} /> : null}
    </div>
  );
}

function ConfirmDeleteModal({ description, onClose, onConfirm, pending, title }: { description: string; onClose: () => void; onConfirm: () => void; pending: boolean; title: string }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><button type="button" className="absolute inset-0 bg-slate-950/35" aria-label="삭제 확인 닫기" onClick={onClose} /><div className="relative z-10 w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl"><div className="text-base font-semibold text-slate-950">{title}</div><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={pending} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-45">닫기</button><button type="button" onClick={onConfirm} disabled={pending} className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:pointer-events-none disabled:opacity-45">{pending ? '삭제 중...' : '삭제'}</button></div></div></div>;
}
