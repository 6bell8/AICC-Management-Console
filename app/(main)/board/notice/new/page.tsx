'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Eye, FileClock, Link2, Megaphone, Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/app/components/ui/use-toast';

import { createNotice } from '@/app/lib/api/notice';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { PinnedToggle } from '@/app/components/ui/pinned-toggle';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import { Separator } from '@/app/components/ui/separator';
import { Textarea } from '@/app/components/ui/textarea';
import type { NoticeAttachment } from '@/app/lib/types/notice';

export default function NoticeNewPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { canWrite } = useCurrentUser();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [status, setStatus] = useState<'PUBLISHED' | 'DRAFT'>('PUBLISHED');
  const [attachments, setAttachments] = useState<NoticeAttachment[]>([]);

  const normalizedAttachments = attachments
    .map((item) => ({ name: item.name.trim(), url: item.url.trim() }))
    .filter((item) => item.name.length > 0 && item.url.length > 0);

  const m = useMutation({
    mutationFn: () => createNotice({ title, content, pinned, status, attachments: normalizedAttachments }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notice', 'list'] });
      await qc.invalidateQueries({ queryKey: ['notice', 'banner'] });
      toast({ title: '저장 완료', description: '공지사항이 등록되었습니다.' });
      router.push('/board/notice');
    },
    onError: (err: Error) => {
      toast({ title: '저장 실패', description: err.message || '오류가 발생했습니다.', variant: 'destructive' });
    },
  });

  const canSubmit = canWrite && title.trim().length > 0 && content.trim().length > 0 && !m.isPending;
  const disabled = !canWrite || m.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold sm:text-2xl">
          <Megaphone className="h-5 w-5 text-sky-600" />새 공지사항 작성
        </h1>
        <div className="flex gap-2 sm:justify-end">
          <Button
            variant="outline"
            className="h-9 w-9 p-0"
            onClick={() => router.push('/board/notice')}
            aria-label="공지사항 목록"
            title="공지사항 목록"
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
        <div className="text-sm text-slate-600">제목</div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="공지사항 제목"
          disabled={disabled}
          className="border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0"
        />
      </div>

      <div className="space-y-2">
        <div className="text-sm text-slate-600">내용</div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="공지사항 내용을 입력해 주세요"
          className="min-h-[320px] border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0 sm:min-h-[360px]"
          disabled={disabled}
        />
      </div>

      <AttachmentFields
        attachments={attachments}
        disabled={disabled}
        onAdd={() => setAttachments((prev) => [...prev, { name: '', url: '' }])}
        onRemove={(index) => setAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
        onChange={(index, patch) => setAttachments((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))}
      />

      <div className="flex justify-end">
        <div className="flex flex-wrap items-center gap-2">
          <PinnedToggle checked={pinned} onCheckedChange={setPinned} disabled={disabled} />
          <NoticeStatusToggle value={status} onChange={setStatus} disabled={disabled} />
          <Button variant="oHGhost" className="h-9 gap-1.5 px-3" disabled={!canSubmit} onClick={() => m.mutate()}>
            <Save className="h-4 w-4" />
            <span>{m.isPending ? '저장 중...' : '저장'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function NoticeStatusToggle({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: 'PUBLISHED' | 'DRAFT') => void;
  value: 'PUBLISHED' | 'DRAFT';
}) {
  return (
    <div className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm" aria-label="공개 상태">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('PUBLISHED')}
        className={[
          'inline-flex h-7 w-8 items-center justify-center rounded-md transition disabled:pointer-events-none disabled:opacity-45',
          value === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
        ].join(' ')}
        aria-label="공개"
        title="공개"
      >
        <Eye className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('DRAFT')}
        className={[
          'inline-flex h-7 w-8 items-center justify-center rounded-md transition disabled:pointer-events-none disabled:opacity-45',
          value === 'DRAFT' ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
        ].join(' ')}
        aria-label="임시저장"
        title="임시저장"
      >
        <FileClock className="h-4 w-4" />
      </button>
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
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 border-sky-100 bg-sky-50 px-3 text-sky-700 hover:border-sky-200 hover:bg-sky-100 hover:text-sky-800"
          disabled={disabled}
          onClick={onAdd}
        >
          <Plus className="h-4 w-4 shrink-0" />
          링크 추가
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        {attachments.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-sm text-slate-500">
            첨부할 문서가 있으면 우측 버튼으로 추가해 주세요.
          </div>
        ) : (
          attachments.map((item, index) => (
            <div key={`attachment-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_44px]">
              <Input
                value={item.name}
                onChange={(event) => onChange(index, { name: event.target.value })}
                placeholder="문서명"
                disabled={disabled}
                className="border-slate-200 bg-white shadow-sm focus-visible:ring-slate-100 focus-visible:ring-offset-0"
              />
              <Input
                value={item.url}
                onChange={(event) => onChange(index, { url: event.target.value })}
                placeholder="문서 링크 URL"
                disabled={disabled}
                className="border-slate-200 bg-white shadow-sm focus-visible:ring-slate-100 focus-visible:ring-offset-0"
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 w-10 min-w-10 border-rose-100 bg-rose-50 !p-0 text-rose-700 hover:border-rose-200 hover:bg-rose-100 hover:text-rose-800"
                disabled={disabled}
                onClick={() => onRemove(index)}
                aria-label="첨부 삭제"
                title="첨부 삭제"
              >
                <Trash2 size={12} strokeWidth={1.5} className="shrink-0" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
