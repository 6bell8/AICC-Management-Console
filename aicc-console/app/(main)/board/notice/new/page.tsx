'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/app/components/ui/use-toast';

import { createNotice } from '@/app/lib/api/notice';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Separator } from '@/app/components/ui/separator';

export default function NoticeNewPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [status, setStatus] = useState<'PUBLISHED' | 'DRAFT'>('PUBLISHED');

  const m = useMutation({
    mutationFn: () => createNotice({ title, content, pinned, status }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['notice', 'list'] });
      await qc.invalidateQueries({ queryKey: ['notice', 'banner'] });

      toast({
        title: '저장 완료',
        description: '공지사항이 등록되었습니다.',
      });

      router.push(`/board/notice`);
    },
  });

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && !m.isPending;

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">새 공지 작성</h1>
        <Button variant="outline" onClick={() => router.back()}>
          뒤로
        </Button>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="text-sm text-slate-600">제목</div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="공지 제목" />
      </div>

      <div className="space-y-2">
        <div className="text-sm text-slate-600">내용(plain text)</div>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="공지 내용을 입력하세요" className="min-h-[180px]" />
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
          <Button variant={status === 'DRAFT' ? 'secondary' : 'outline'} onClick={() => setStatus('DRAFT')} type="button">
            임시저장
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="oHGhost" disabled={!canSubmit} onClick={() => m.mutate()}>
          {m.isPending ? '저장 중...' : '저장'}
        </Button>
        <Button variant="outline" disabled={m.isPending} onClick={() => router.push('/board/notice')}>
          목록
        </Button>
      </div>

      {m.isError ? <div className="text-sm text-red-600">저장 실패: {(m.error as any)?.message ?? 'error'}</div> : null}
    </div>
  );
}
