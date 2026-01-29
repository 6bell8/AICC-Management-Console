'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { authStorage, Role } from '../../lib/auth/storage';

const LoginSchema = z.object({
  email: z.string().min(1, '이메일을 입력해 주세요.').email('이메일 형식이 올바르지 않습니다.'),
  password: z.string().min(1, '비밀번호를 입력해 주세요.').min(4, '비밀번호는 최소 4자 이상 입력해 주세요.'),
  role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER']),
});

type LoginForm = z.infer<typeof LoginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = useMemo(() => sp.get('next') || '/dashboard', [sp]);

  useEffect(() => {
    const session = authStorage.getSession(); // ✅ 옵셔널 제거
    if (session?.token) {
      router.replace(next.startsWith('http') ? '/dashboard' : next);
    }
  }, [router, next]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
      role: 'OPERATOR',
    },
    mode: 'onSubmit',
  });

  const role = watch('role');

  const onSubmit = async (data: LoginForm) => {
    // ✅ MVP: 모킹 로그인(실API 붙이면 여기만 교체)
    // - 성공했다고 가정하고 세션 저장
    authStorage.setSession('mock_token', data.role as Role);

    // next가 외부 URL이면 막기(기본 안전장치)
    if (next.startsWith('http')) {
      router.replace('/campaigns');
      return;
    }
    router.replace(next);
  };

  const quickLogin = (r: Role) => {
    setValue('role', r);
    authStorage.setSession('mock_token', r);
    router.replace(next);
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur">
      <div className="mb-5">
        <p className="text-lg font-semibold">AICC Management System</p>
        <p className="mt-1 text-sm text-black/60">로그인 후 콘솔에 접근할 수 있습니다.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-black/70">이메일</label>
          <input
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            placeholder="you@example.com"
            {...register('email')}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs text-black/70">비밀번호</label>
          <input
            type="password"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            placeholder="••••"
            {...register('password')}
          />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs text-black/70">역할(Role)</label>
          <select className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30" {...register('role')}>
            <option value="ADMIN">ADMIN</option>
            <option value="OPERATOR">OPERATOR</option>
            <option value="VIEWER">VIEWER</option>
          </select>
          <p className="mt-1 text-xs text-black/50">현재 선택: {role}</p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? '로그인 중...' : '로그인'}
        </button>
      </form>

      {/* 개발 편의용 퀵로그인 */}
      <div className="mt-4 rounded-xl border border-black/10 bg-white p-3">
        <p className="text-xs font-medium text-black/70">퀵 로그인(MVP)</p>
        <div className="mt-2 flex gap-2">
          <button className="flex-1 rounded-lg border px-2 py-2 text-xs" onClick={() => quickLogin('ADMIN')}>
            ADMIN
          </button>
          <button className="flex-1 rounded-lg border px-2 py-2 text-xs" onClick={() => quickLogin('OPERATOR')}>
            OPERATOR
          </button>
          <button className="flex-1 rounded-lg border px-2 py-2 text-xs" onClick={() => quickLogin('VIEWER')}>
            VIEWER
          </button>
        </div>
      </div>
    </div>
  );
}
