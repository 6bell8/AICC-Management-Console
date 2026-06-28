'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { authStorage } from '@/app/lib/auth/storage';

const LoginSchema = z.object({
  email: z.string().trim().min(1, '로그인 ID를 입력해 주세요.'),
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
});

type LoginForm = z.infer<typeof LoginSchema>;
const SAVED_LOGIN_EMAIL_KEY = 'aicc_saved_login_email';

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = useMemo(() => sp.get('next') || '/dashboard', [sp]);
  const [message, setMessage] = useState<string | null>(null);
  const [saveLoginId, setSaveLoginId] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
  });

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(SAVED_LOGIN_EMAIL_KEY);
    if (!savedEmail) return;
    setValue('email', savedEmail, { shouldValidate: false });
    setSaveLoginId(true);
  }, [setValue]);

  const onSubmit = async (data: LoginForm) => {
    setMessage(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage(body.message || '로그인에 실패했습니다.');
      return;
    }

    if (saveLoginId) {
      window.localStorage.setItem(SAVED_LOGIN_EMAIL_KEY, data.email);
    } else {
      window.localStorage.removeItem(SAVED_LOGIN_EMAIL_KEY);
    }

    authStorage.setSession('server_cookie', body.user.role);
    if (body.user.forcePasswordChange) {
      router.replace('/change-password');
      router.refresh();
      return;
    }
    router.replace(next.startsWith('http') ? '/dashboard' : next);
    router.refresh();
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="mb-5">
        <p className="text-lg font-semibold">AICC Management System</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-black/70">로그인 ID</label>
          <input
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            placeholder="00001 또는 you@example.com"
            {...register('email')}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs text-black/70">비밀번호</label>
          <input
            type="password"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            placeholder="비밀번호"
            {...register('password')}
          />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-black/60">
          <input
            type="checkbox"
            checked={saveLoginId}
            onChange={(event) => {
              const checked = event.target.checked;
              setSaveLoginId(checked);
              if (!checked) window.localStorage.removeItem(SAVED_LOGIN_EMAIL_KEY);
            }}
            className="h-4 w-4 rounded border-black/20 accent-black"
          />
          로그인 ID 저장
        </label>

        {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{message}</div>}

        <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
          {isSubmitting ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <div className="mt-4 text-center text-xs text-black/60">
        계정이 없으신가요?{' '}
        <Link href="/signup" className="font-medium text-black underline">
          가입 신청
        </Link>
      </div>

      <div className="mt-3 text-center text-xs text-black/60">
        포트폴리오만 둘러보시나요?{' '}
        <Link href="/guest" className="font-medium text-black underline">
          게스트 모드
        </Link>
      </div>
    </div>
  );
}
