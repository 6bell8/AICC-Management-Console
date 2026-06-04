'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authStorage } from '@/app/lib/auth/storage';

export default function GuestClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function enterGuestMode() {
    setLoading(true);
    setMessage(null);
    const res = await fetch('/api/auth/guest', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMessage(body.message || '게스트 모드 진입에 실패했습니다.');
      return;
    }

    authStorage.setSession('server_cookie', body.user.role);
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="space-y-2">
        <p className="text-lg font-semibold">포트폴리오 게스트 모드</p>
        <p className="text-sm leading-6 text-black/60">
          별도 가입 없이 승인된 VIEWER 권한으로 콘솔 화면을 둘러볼 수 있습니다. 관리자 권한과 계정 승인 관리는 HEAD 계정에서만 가능합니다.
        </p>
      </div>

      <div className="mt-5 grid gap-2 rounded-xl border border-black/10 bg-slate-50 p-3 text-xs text-slate-600">
        <div>접근 역할: VIEWER</div>
        <div>권한 범위: 포트폴리오 관람용 콘솔 접근</div>
        <div>관리 기능: HEAD/ADMIN 전용</div>
      </div>

      {message && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{message}</div>}

      <button
        type="button"
        onClick={enterGuestMode}
        disabled={loading}
        className="mt-5 w-full rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? '입장 중...' : '게스트로 둘러보기'}
      </button>

      <div className="mt-4 text-center text-xs text-black/60">
        관리자 계정이 있으신가요?{' '}
        <Link href="/login" className="font-medium text-black underline">
          로그인
        </Link>
      </div>
    </div>
  );
}
