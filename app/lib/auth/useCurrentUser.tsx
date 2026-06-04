'use client';

import { useQuery } from '@tanstack/react-query';
import type { AuthUser } from '../db/users';

type CurrentUserResponse = {
  user: AuthUser | null;
};

export function useCurrentUser() {
  const query = useQuery<CurrentUserResponse>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.status === 401) return { user: null };
      if (!res.ok) throw new Error('현재 로그인 정보를 확인하지 못했습니다.');
      return res.json();
    },
    staleTime: 30_000,
    retry: 1,
  });

  const user = query.data?.user ?? null;
  const canWrite = Boolean(user && user.role !== 'VIEWER');

  return {
    ...query,
    user,
    canWrite,
    isViewer: user?.role === 'VIEWER',
  };
}

export function ReadOnlyNotice() {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
      게스트/VIEWER 권한은 조회만 가능합니다. 등록, 수정, 삭제는 HEAD/ADMIN/OPERATOR 계정으로 로그인해 주세요.
    </div>
  );
}
