'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ClipboardList, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/app/components/ui/use-toast';

import { createAuthorGuide } from '@/app/lib/api/authorGuide';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { ReadOnlyNotice, useCurrentUser } from '@/app/lib/auth/useCurrentUser';
import { Separator } from '@/app/components/ui/separator';
import { StatusToggle } from '@/app/components/ui/status-toggle';
import { Textarea } from '@/app/components/ui/textarea';
import type { PublishStatus } from '@/app/lib/types/common';

export default function AuthorGuideNewPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { canWrite } = useCurrentUser();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<PublishStatus>('PUBLISHED');

  const m = useMutation({
    mutationFn: () => createAuthorGuide({ title, content, status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['authorGuide', 'list'] });
      toast({ title: '저장 완료', description: '저작가이드가 등록되었습니다.' });
      router.push('/board/author-guide');
    },
    onError: (err: Error) => {
      toast({ title: '저장 실패', description: err.message || '오류가 발생했습니다.', variant: 'destructive' });
    },
  });

  const canSubmit = canWrite && title.trim().length > 0 && content.trim().length > 0 && !m.isPending;
  const disabled = !canWrite || m.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BookOpen className="h-5 w-5 text-sky-600" />
          새 저작가이드 작성
        </h1>
        <Button variant="outline" className="h-9 w-9 p-0" onClick={() => router.back()} aria-label="뒤로가기" title="뒤로가기">
          <Undo2 className="h-4 w-4 shrink-0" />
        </Button>
      </div>

      <Separator className="bg-slate-200" />
      {!canWrite ? <ReadOnlyNotice /> : null}

      <div className="space-y-2">
        <div className="text-sm text-slate-600">제목</div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="가이드 제목" disabled={disabled} className="border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0" />
      </div>

      <div className="space-y-2">
        <div className="text-sm text-slate-600">내용</div>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="가이드 내용을 입력해 주세요" className="min-h-[220px] border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-slate-100 focus-visible:ring-offset-0" disabled={disabled} />
      </div>

      <div className="flex w-full items-center justify-end gap-3">
        <StatusToggle value={status} onChange={canWrite ? setStatus : () => undefined} />
      </div>

      <div className="flex gap-2">
        <Button variant="oHGhost" disabled={!canSubmit} onClick={() => m.mutate()}>{m.isPending ? '저장 중...' : '저장'}</Button>
        <Button variant="outline" className="h-9 w-9 p-0" disabled={m.isPending} onClick={() => router.push('/board/author-guide')} aria-label="저작가이드 목록" title="저작가이드 목록">
          <ClipboardList className="h-4 w-4 shrink-0" />
        </Button>
      </div>
    </div>
  );
}
