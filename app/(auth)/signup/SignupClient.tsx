'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const SignupSchema = z.object({
  name: z.string().min(2, '이름은 2자 이상 입력해 주세요.'),
  email: z.string().email('이메일 형식이 올바르지 않습니다.'),
  password: z.string().min(8, '비밀번호는 8자 이상 입력해 주세요.'),
});

type SignupForm = z.infer<typeof SignupSchema>;

export default function SignupClient() {
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(SignupSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = async (data: SignupForm) => {
    setMessage(null);
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage(body.message || '가입 신청에 실패했습니다.');
      return;
    }

    setDone(true);
    setMessage(body.message || '가입 신청이 접수되었습니다.');
    reset();
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="mb-5">
        <p className="text-lg font-semibold">가입 신청</p>
        <p className="mt-1 text-sm text-black/60">관리자 승인 후 콘솔에 로그인할 수 있습니다.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-black/70">이름</label>
          <input className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30" {...register('name')} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>

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
            placeholder="8자 이상"
            {...register('password')}
          />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        {message && (
          <div className={['rounded-lg border px-3 py-2 text-xs', done ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'].join(' ')}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? '신청 중...' : '가입 신청'}
        </button>
      </form>

      <div className="mt-4 text-center text-xs text-black/60">
        이미 승인된 계정이 있으신가요?{' '}
        <Link href="/login" className="font-medium text-black underline">
          로그인
        </Link>
      </div>

      <div className="mt-3 text-center text-xs text-black/60">
        승인 없이 둘러보기는{' '}
        <Link href="/guest" className="font-medium text-black underline">
          게스트 모드
        </Link>
        를 사용하세요.
      </div>
    </div>
  );
}
