'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, History, Link2, Megaphone, Plus, Trash2, Undo2 } from 'lucide-react';
import { useToast } from '@/app/components/ui/use-toast';

import { deleteNotice, getNotice, patchNotice } from '@/app/lib/api/notice';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import { Separator } from '@/app/components/ui/separator';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Textarea } from '@/app/components/ui/textarea';
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
    setTitle(notice.title ?? '');
    setContent(notice.content ?? '');
    setPinned(!!notice.pinned);
    setStatus(notice.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED');
    setAttachments(notice.attachments ?? []);
  }, [q.data?.notice]);

  const normalizedAttachments = attachments
    .map((item) => ({ name: item.name.trim(), url: item.url.trim() }))
    .filter((item) => item.name.length > 0 && item.url.length > 0);

  const mSave = useMutation({
    mutationFn: () => patchNotice(String(id), { title, content, pinned, status, attachments: normalizedAttachments }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notice', 'detail', id] });
      await qc.invalidateQueries({ queryKey: ['notice', 'list'] });
      await qc.invalidateQueries({ queryKey: ['notice', 'banner'] });
      toast({ title: '저장 완료', description: '공지사항이 저장되었습니다.' });
      router.push('/board/notice');
    },
    onError: (err: Error) => toast({ title: '저장 실패', description: err.message || '오류가 발생했습니다.', variant: 'destructive' }),
  });

  const mDel = useMutation({
    mutationFn: () => deleteNotice(String(id)),
    onSuccess: async () => {
      qc.removeQueries({ queryKey: ['notice', 'detail', id] });
      await qc.invalidateQueries({ queryKey: ['notice', 'list'] });
      await qc.invalidateQueries({ queryKey: ['notice', 'banner'] });
      toast({ title: '삭제 완료', description: '공지사항을 삭제했습니다.' });
      router.push('/board/notice');
    },
    onError: (err: Error) => toast({ title: '삭제 실패', description: err.message || '오류가 발생했습니다.', variant: 'destructive' }),
  });

  if (q.isPending) {
    return <div className="mx-auto w-full max-w-4xl space-y-3 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-10 w-full" /><Skeleton className="h-44 w-full" /></div>;
  }

  if (q.isError || !q.data?.notice) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-3 p-6">
        <div className="text-sm text-red-600">불러오기 실패</div>
        <Button variant="outline" className="h-9 w-9 p-0" onClick={() => router.push('/board/notice')} aria-label="공지사항 목록" title="공지사항 목록"><ClipboardList className="h-4 w-4 shrink-0" /></Button>
      </div>
    );
  }

  const notice = q.data.notice;
  const canSave = canWrite && title.trim().length > 0 && content.trim().length > 0 && !mSave.isPending;
  const writeDisabled = !canWrite || mSave.isPending || mDel.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Megaphone className="h-5 w-5 text-sky-600" />
          공지 상세
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" className="h-9 w-9 p-0" onClick={() => router.push('/board/notice')} aria-label="공지사항 목록" title="공지사항 목록"><ClipboardList className="h-4 w-4 shrink-0" /></Button>
          <Button variant="outline" className="h-9 w-9 p-0" onClick={() => router.back()} aria-label="뒤로가기" title="뒤로가기"><Undo2 className="h-4 w-4 shrink-0" /></Button>
        </div>
      </div>

      <Separator className="bg-slate-200" />
      {!canWrite ? <ReadOnlyNotice /> : null}

      <div className="space-y-2"><div className="text-sm text-slate-600">제목</div><Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={writeDisabled} className="border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0" /></div>
      <div className="space-y-2"><div className="text-sm text-slate-600">내용</div><Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[220px] border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0" disabled={writeDisabled} /></div>

      <AttachmentFields
        attachments={attachments}
        disabled={writeDisabled}
        onAdd={() => setAttachments((prev) => [...prev, { name: '', url: '' }])}
        onRemove={(index) => setAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
        onChange={(index, patch) => setAttachments((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))}
      />

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} disabled={writeDisabled} />상단 고정</label>
        <div className="ml-auto flex gap-2"><Button variant={status === 'PUBLISHED' ? 'secondary' : 'outline'} onClick={() => setStatus('PUBLISHED')} type="button" disabled={writeDisabled}>공개</Button><Button variant={status === 'DRAFT' ? 'draft' : 'outline'} onClick={() => setStatus('DRAFT')} type="button" disabled={writeDisabled}>임시저장</Button></div>
      </div>

      <div className="flex gap-2"><Button variant="oHGhost" disabled={!canSave} onClick={() => mSave.mutate()}>{mSave.isPending ? '저장 중...' : '저장'}</Button><Button variant="dlOutline" disabled={!canWrite || mDel.isPending} onClick={() => setDeleteConfirmOpen(true)}>{mDel.isPending ? '삭제 중...' : '삭제'}</Button></div>

      <ChangeHistory
        createdAt={notice.createdAt}
        lastEditorName={notice.lastEditorName}
        revisionCount={notice.revisionCount}
        updatedAt={notice.updatedAt}
      />

      {deleteConfirmOpen ? <ConfirmDeleteModal title="공지사항을 삭제할까요?" description="삭제한 공지사항은 목록에서 제거되며 되돌릴 수 없습니다." pending={mDel.isPending} onClose={() => setDeleteConfirmOpen(false)} onConfirm={() => { setDeleteConfirmOpen(false); mDel.mutate(); }} /> : null}
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
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Link2 className="h-4 w-4 text-sky-600" />
            첨부 문서
          </div>
          <p className="mt-1 text-xs text-slate-500">파일 저장소나 문서 링크를 연결해 공지에서 바로 열람할 수 있습니다.</p>
        </div>
        <Button type="button" variant="outline" className="h-9 w-9 p-0" disabled={disabled} onClick={onAdd} aria-label="첨부 추가" title="첨부 추가">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        {attachments.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-sm text-slate-500">연결된 첨부 문서가 없습니다.</div>
        ) : (
          attachments.map((item, index) => (
            <div key={`attachment-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_36px]">
              <Input value={item.name} onChange={(event) => onChange(index, { name: event.target.value })} placeholder="문서명" disabled={disabled} className="border-slate-200 bg-white shadow-sm focus-visible:ring-slate-100 focus-visible:ring-offset-0" />
              <Input value={item.url} onChange={(event) => onChange(index, { url: event.target.value })} placeholder="https://..." disabled={disabled} className="border-slate-200 bg-white shadow-sm focus-visible:ring-slate-100 focus-visible:ring-offset-0" />
              <Button type="button" variant="outline" className="h-10 w-10 border-rose-100 bg-rose-50 p-0 text-rose-600 hover:bg-rose-100" disabled={disabled} onClick={() => onRemove(index)} aria-label="첨부 삭제" title="첨부 삭제">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ChangeHistory({
  createdAt,
  lastEditorName,
  revisionCount,
  updatedAt,
}: {
  createdAt?: string;
  lastEditorName?: string | null;
  revisionCount?: number;
  updatedAt?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <History className="h-4 w-4 text-slate-500" />
        변경 이력
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <div className="font-medium text-slate-700">생성</div>
          <div className="mt-1">{createdAt ? new Date(createdAt).toLocaleString() : '-'}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <div className="font-medium text-slate-700">최근 수정</div>
          <div className="mt-1">{updatedAt ? new Date(updatedAt).toLocaleString() : '-'}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <div className="font-medium text-slate-700">수정 횟수</div>
          <div className="mt-1">{revisionCount ?? 0}회</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <div className="font-medium text-slate-700">최근 수정자</div>
          <div className="mt-1">{lastEditorName || '-'}</div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ description, onClose, onConfirm, pending, title }: { description: string; onClose: () => void; onConfirm: () => void; pending: boolean; title: string }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><button type="button" className="absolute inset-0 bg-slate-950/35" aria-label="삭제 확인 닫기" onClick={onClose} /><div className="relative z-10 w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl"><div className="text-base font-semibold text-slate-950">{title}</div><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={pending} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-45">닫기</button><button type="button" onClick={onConfirm} disabled={pending} className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:pointer-events-none disabled:opacity-45">{pending ? '삭제 중...' : '삭제'}</button></div></div></div>;
}
