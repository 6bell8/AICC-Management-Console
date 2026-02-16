'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/app/components/ui/use-toast';

import { createAuthorGuide } from '@/app/lib/api/authorGuide';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Separator } from '@/app/components/ui/separator';
import { StatusToggle } from '@/app/components/ui/status-toggle';

import type { PublishStatus } from '@/app/lib/types/common';

export default function AuthorGuideNewPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<PublishStatus>('PUBLISHED');

  const m = useMutation({
    mutationFn: () => createAuthorGuide({ title, content, status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['authorGuide', 'list'] });

      toast({
        title: '저장 완료',
        description: '저작가이드가 등록되었습니다.',
      });

      router.push('/board/author-guide');
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : '오류가 발생했습니다.';

      toast({
        title: '저장 실패',
        description: message,
        variant: 'destructive',
      });
    },
  });

  function getErrorMessage(err: unknown) {
    if (err instanceof Error) return err.message;

    if (typeof err === 'object' && err !== null && 'message' in err) {
      const msg = (err as { message?: unknown }).message;

      if (typeof msg === 'string') return msg;
      if (msg != null) return String(msg);
    }
    return 'error';
  }

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && !m.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">새 가이드 작성</h1>
        <Button variant="outline" onClick={() => router.back()}>
          뒤로
        </Button>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="text-sm text-slate-600">제목</div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="가이드 제목" />
      </div>

      <div className="space-y-2">
        <div className="text-sm text-slate-600">내용</div>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="가이드 내용을 입력하세요" className="min-h-[180px]" />
      </div>

      <>
        <div className="flex items-center justify-end gap-3 w-full">
          <StatusToggle value={status} onChange={setStatus} />
        </div>
      </>

      <div className="flex gap-2">
        <Button variant="oHGhost" disabled={!canSubmit} onClick={() => m.mutate()}>
          {m.isPending ? '저장 중...' : '저장'}
        </Button>
        <Button variant="outline" disabled={m.isPending} onClick={() => router.push('/board/author-guide')}>
          목록
        </Button>
      </div>

      {m.isError ? <div className="text-sm text-red-600">저장 실패: {getErrorMessage(m.error)}</div> : null}
    </div>
  );
}
