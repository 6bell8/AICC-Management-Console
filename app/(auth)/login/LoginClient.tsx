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

        <button
          type="submit"
          disabled={isSubmitting}
          className={[
            'flex w-full items-center justify-center gap-2 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white transition disabled:cursor-wait',
            isSubmitting ? 'animate-[loginButtonPulse_1.15s_ease-in-out_infinite]' : 'hover:bg-slate-900',
          ].join(' ')}
        >
          {isSubmitting ? (
            <>
              <span className="inline-flex items-center gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-[loginDot_900ms_ease-in-out_infinite] rounded-full bg-white" />
                <span className="h-1.5 w-1.5 animate-[loginDot_900ms_ease-in-out_120ms_infinite] rounded-full bg-white/80" />
                <span className="h-1.5 w-1.5 animate-[loginDot_900ms_ease-in-out_240ms_infinite] rounded-full bg-white/60" />
              </span>
            </>
          ) : (
            '로그인'
          )}
        </button>
      </form>

      <div className="mt-5 grid gap-2 max-[480px]:grid-cols-2 sm:block sm:space-y-3">
        <div className="text-center text-xs text-black/60 max-[480px]:rounded-lg max-[480px]:border max-[480px]:border-slate-200 max-[480px]:bg-slate-50/70 max-[480px]:px-2 max-[480px]:py-3 max-[480px]:shadow-sm">
          <span className="max-[480px]:block max-[480px]:text-[11px]">계정이 없으신가요?</span>{' '}
          <Link href="/signup" className="font-semibold text-black underline max-[480px]:mt-1 max-[480px]:inline-flex max-[480px]:no-underline">
            가입 신청
          </Link>
        </div>

        <div className="text-center text-xs text-black/60 max-[480px]:rounded-lg max-[480px]:border max-[480px]:border-sky-100 max-[480px]:bg-sky-50/60 max-[480px]:px-2 max-[480px]:py-3 max-[480px]:shadow-sm">
          <span className="max-[480px]:block max-[480px]:text-[11px]">포트폴리오만 둘러보기</span>{' '}
          <Link
            href="/guest"
            className="font-semibold text-black underline max-[480px]:mt-1 max-[480px]:inline-flex max-[480px]:text-sky-800 max-[480px]:no-underline"
          >
            게스트 모드
          </Link>
        </div>
      </div>
    </div>
  );
}
