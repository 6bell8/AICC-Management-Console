'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/app/components/ui/button';
import { authStorage } from '@/app/lib/auth/storage';

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '현재 비밀번호를 입력해 주세요.'),
    newPassword: z.string().min(8, '새 비밀번호는 8자 이상 입력해 주세요.'),
    confirmPassword: z.string().min(1, '새 비밀번호 확인을 입력해 주세요.'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: '새 비밀번호가 일치하지 않습니다.',
  });

type ChangePasswordForm = z.infer<typeof ChangePasswordSchema>;

export default function ChangePasswordClient({ forcePasswordChange }: { forcePasswordChange: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ChangePasswordForm) => {
    setMessage(null);
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage(body.message || '비밀번호 변경에 실패했습니다.');
      return;
    }

    authStorage.setSession('server_cookie', body.user.role);
    router.replace('/dashboard');
    router.refresh();
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm backdrop-blur">
      <div className="mb-5">
        <p className="text-lg font-semibold text-slate-950">비밀번호 변경</p>
        <p className="mt-1 text-sm text-slate-500">
          {forcePasswordChange
            ? '임시 비밀번호로 로그인했습니다. 계속 사용하려면 새 비밀번호로 변경해 주세요.'
            : '계정 보안을 위해 새 비밀번호를 설정할 수 있습니다.'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-slate-600">현재 비밀번호</label>
          <input
            type="password"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
            placeholder="현재 비밀번호"
            {...register('currentPassword')}
          />
          {errors.currentPassword && <p className="mt-1 text-xs text-red-600">{errors.currentPassword.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-600">새 비밀번호</label>
          <input
            type="password"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
            placeholder="8자 이상"
            {...register('newPassword')}
          />
          {errors.newPassword && <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-600">새 비밀번호 확인</label>
          <input
            type="password"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
            placeholder="새 비밀번호 재입력"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
        </div>

        {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{message}</div>}

        <Button type="submit" variant="saveNeutral" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? '변경 중...' : '비밀번호 변경'}
        </Button>
      </form>
    </div>
  );
}
