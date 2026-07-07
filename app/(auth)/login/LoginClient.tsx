'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';

import { authStorage } from '@/app/lib/auth/storage';

const LoginSchema = z.object({
  email: z.string().trim().min(1, '로그인 ID를 입력해 주세요.'),
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
});

type LoginForm = z.infer<typeof LoginSchema>;

const SAVED_LOGIN_EMAIL_KEY = 'aicc_saved_login_email';
const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:ring-2 focus:ring-sky-100';

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm backdrop-blur">
      <div className="mb-5">
        <p className="text-lg font-semibold text-slate-950">AICC Management System</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">로그인 ID</label>
          <input className={inputClass} placeholder="00001 또는 you@example.com" {...register('email')} />
          {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">비밀번호</label>
          <input type="password" className={inputClass} placeholder="비밀번호" {...register('password')} />
          {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password.message}</p> : null}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={saveLoginId}
            onChange={(event) => {
              const checked = event.target.checked;
              setSaveLoginId(checked);
              if (!checked) window.localStorage.removeItem(SAVED_LOGIN_EMAIL_KEY);
            }}
            className="h-4 w-4 rounded border-slate-300 accent-sky-700"
          />
          로그인 ID 저장
        </label>

        {message ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{message}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className={[
            'flex w-full items-center justify-center rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white transition disabled:cursor-wait disabled:opacity-80',
            isSubmitting ? '' : 'hover:bg-slate-900',
          ].join(' ')}
        >
          {isSubmitting ? (
            <span className="inline-flex w-6 items-center justify-center gap-0.5" aria-label="로그인 중">
              <span className="animate-[loginDot_900ms_ease-in-out_infinite]">.</span>
              <span className="animate-[loginDot_900ms_ease-in-out_120ms_infinite]">.</span>
              <span className="animate-[loginDot_900ms_ease-in-out_240ms_infinite]">.</span>
            </span>
          ) : (
            '로그인'
          )}
        </button>
      </form>

      <div className="mt-5 grid gap-2 max-[480px]:grid-cols-2 sm:block sm:space-y-3">
        <div className="text-center text-xs text-slate-500 max-[480px]:rounded-lg max-[480px]:border max-[480px]:border-slate-200 max-[480px]:bg-slate-50/70 max-[480px]:px-2 max-[480px]:py-3 max-[480px]:shadow-sm">
          <span className="max-[480px]:block max-[480px]:text-[11px]">계정이 없으신가요?</span>{' '}
          <Link href="/signup" className="font-semibold text-slate-950 underline max-[480px]:mt-1 max-[480px]:inline-flex max-[480px]:no-underline">
            가입 신청
          </Link>
        </div>

        <div className="text-center text-xs text-slate-500 max-[480px]:rounded-lg max-[480px]:border max-[480px]:border-sky-100 max-[480px]:bg-sky-50/60 max-[480px]:px-2 max-[480px]:py-3 max-[480px]:shadow-sm">
          <span className="max-[480px]:block max-[480px]:text-[11px]">둘러보기만 하시겠어요?</span>{' '}
          <Link href="/guest" className="font-semibold text-slate-950 underline max-[480px]:mt-1 max-[480px]:inline-flex max-[480px]:text-sky-800 max-[480px]:no-underline">
            게스트 모드
          </Link>
        </div>
      </div>
    </div>
  );
}
