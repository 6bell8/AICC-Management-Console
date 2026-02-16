'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/app/components/ui/button';
import { useToast } from '@/app/components/ui/use-toast';
import { Input } from '@/app/components/ui/input';
import { Skeleton } from '@/app/components/ui/skeleton';

import { getDynNode, patchDynNode, deleteDynnode } from '@/app/lib/api/dynnode';
import DynNodeRunner from '../../../../components/dynnode/DynnodeRunner';

export default function DynNodeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const q = useQuery({
    queryKey: ['dynnode', id],
    queryFn: () => getDynNode(id),
  });

  const post = q.data?.post;

  const [isEdit, setIsEdit] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [code, setCode] = useState('');
  const [sampleCtx, setSampleCtx] = useState('');

  // 서버 데이터 로드 시 폼 초기화
  useEffect(() => {
    if (!post) return;
    setTitle(post.title);
    setSummary(post.summary ?? '');
    setCode(post.code);
    setSampleCtx(post.sampleCtx);
  }, [post?.id]);

  const dirty = useMemo(() => {
    if (!post) return false;
    return title !== post.title || summary !== (post.summary ?? '') || code !== post.code || sampleCtx !== post.sampleCtx;
  }, [post, title, summary, code, sampleCtx]);

  const saveM = useMutation({
    mutationFn: () =>
      patchDynNode(id, {
        title: title.trim() || '제목 없음',
        summary: summary.trim() || null,
        code,
        sampleCtx,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['dynnode', id] });
      await qc.invalidateQueries({ queryKey: ['dynnode', 'list'] });
      setIsEdit(false);

      toast({ title: '저장 완료', description: '변경사항이 저장되었습니다.' });
      router.push('/board/dynnode');
    },
    onError: (e: any) => {
      toast({
        title: '저장 실패',
        description: e?.message ?? '저장 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    },
  });

  // ✅ 삭제 mutation 추가
  const delM = useMutation({
    mutationFn: () => deleteDynnode(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['dynnode', 'list'] });
      await qc.removeQueries({ queryKey: ['dynnode', id] });

      toast({ title: '삭제 완료', description: '게시글이 삭제되었습니다.' });
      router.push('/board/dynnode');
    },
    onError: (e: any) => {
      toast({
        title: '삭제 실패',
        description: e?.message ?? '삭제 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    },
  });

  const onCancel = () => {
    if (!post) return;
    setTitle(post.title);
    setSummary(post.summary ?? '');
    setCode(post.code);
    setSampleCtx(post.sampleCtx);
    setIsEdit(false);
  };

  const onDelete = () => {
    const ok = window.confirm('정말 삭제하시겠습니까?\n삭제하면 되돌릴 수 없습니다.');
    if (!ok) return;
    delM.mutate();
  };

  function DetailSkeleton() {
    return (
      <div className="mx-auto w-full max-w-4xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-4 w-64" />
          </div>

          <div className="flex gap-2 shrink-0">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-16" />
          </div>
        </div>

        {/* DynNodeRunner 자리(대략적인 레이아웃) */}
        <div className="rounded-lg border bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-9 w-60" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-[260px] w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-[260px] w-full" />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-[260px] w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-[260px] w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const busy = saveM.isPending || delM.isPending;

  if (q.isLoading) return <DetailSkeleton />;
  if (!post) return <div className="p-6 text-sm text-slate-500">게시글을 찾을 수 없습니다.</div>;

  return (
    <div className={busy ? 'opacity-60 pointer-events-none' : 'p-6 space-y-4'}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {isEdit ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              className="h-12 text-xl font-semibold"
              disabled={busy}
            />
          ) : (
            <h1 className="text-2xl font-semibold truncate">{post.title}</h1>
          )}
          <div className="text-xs text-slate-500">updated: {new Date(post.updatedAt).toLocaleString()}</div>
        </div>

        <div className="flex gap-2 shrink-0">
          {/* ✅ 삭제 버튼은 편집 모드 여부와 무관하게 노출(원하면 isEdit일 때만 숨기기도 가능) */}
          {!isEdit && (
            <Button
              variant="outline"
              onClick={onDelete}
              disabled={busy}
              className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
            >
              삭제
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push('/board/dynnode')} disabled={busy}>
            목록
          </Button>

          {isEdit ? (
            <>
              <Button variant="outline" onClick={onCancel} disabled={busy}>
                취소
              </Button>
              <Button variant="outline" onClick={() => saveM.mutate()} disabled={busy || !dirty}>
                저장
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setIsEdit(true)} disabled={busy}>
              수정
            </Button>
          )}
        </div>
      </div>

      <DynNodeRunner code={code} onChangeCode={setCode} ctxText={sampleCtx} onChangeCtxText={setSampleCtx} />
    </div>
  );
}
