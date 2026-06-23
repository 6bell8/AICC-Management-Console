'use client';

import { CheckCircle2, Link2, MessageCircle, QrCode, ShieldCheck, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

export default function KakaoLinkVerifyClient({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const normalizedCode = code.replace(/\D/g, '').slice(0, 6);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/profile/kakao-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '카카오 계정 연동을 완료하지 못했습니다.');
      setSuccess(true);
      setMessage(body.message || '카카오 계정이 연결되었습니다.');
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : '카카오 계정 연동을 완료하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-lg border border-yellow-100 bg-yellow-50/45 p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-300 text-slate-950 shadow-sm">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">카카오톡 채널에서 먼저 시작</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              카카오톡 채널에서 <span className="font-semibold text-slate-900">연동 {userEmail}</span> 형식으로 입력하면 10분 동안 사용할 수 있는 6자리 코드가 발급됩니다.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-yellow-100 bg-white/80 p-4">
          <div className="text-xs font-semibold text-yellow-700">연동 대상 AICC 계정</div>
          <div className="mt-2 text-sm font-semibold text-slate-950">{userName}</div>
          <div className="mt-0.5 text-sm text-slate-500">{userEmail}</div>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-600">
          <Step icon={<ShieldCheck className="h-4 w-4" />} text="AICC에서 승인된 계정 이메일만 코드를 발급합니다." />
          <Step icon={<Link2 className="h-4 w-4" />} text="현재 로그인한 계정과 코드의 계정이 같을 때만 연결합니다." />
          <Step icon={<CheckCircle2 className="h-4 w-4" />} text="연결 후 카카오 공간예약은 해당 AICC 권한으로 처리됩니다." />
        </div>
      </div>

      <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">1회용 코드 확인</h2>
            <p className="mt-1 text-sm text-slate-500">카카오톡 채널에서 받은 숫자 6자리를 입력해 주세요.</p>
          </div>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 text-sm font-semibold text-yellow-700 transition hover:bg-yellow-100"
          >
            <QrCode className="h-4 w-4" />
            카카오톡 채널 바로가기
          </button>
        </div>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">인증 코드</span>
          <input
            value={normalizedCode}
            onChange={(event) => {
              setCode(event.target.value);
              setMessage('');
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="h-14 w-full rounded-md border border-slate-200 bg-white px-4 text-center text-2xl font-semibold tracking-[0.35em] text-slate-950 outline-none transition placeholder:text-slate-300 focus:border-yellow-300 focus:ring-2 focus:ring-yellow-100"
          />
        </label>

        <button
          type="submit"
          disabled={loading || normalizedCode.length !== 6}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-yellow-200 bg-yellow-300 px-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-400"
        >
          <Link2 className="h-4 w-4" />
          {loading ? '확인 중' : '카카오 계정 연결'}
        </button>

        {message ? (
          <div className={['mt-4 rounded-md border px-3 py-2 text-sm', success ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-100 bg-rose-50 text-rose-700'].join(' ')}>
            {message}
          </div>
        ) : null}
      </form>

      {qrOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-950/40" aria-label="QR 코드 닫기" onClick={() => setQrOpen(false)} />
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-yellow-50/70 px-5 py-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-white/80 px-2.5 py-1 text-xs font-semibold text-yellow-700">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Kakao Channel QR
                </div>
                <h2 className="mt-3 text-base font-semibold text-slate-950">카카오톡 채널 바로가기</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">모바일 카카오톡으로 QR 코드를 스캔해 주세요.</p>
              </div>
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-slate-500 transition hover:bg-yellow-100 hover:text-slate-900"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex justify-center bg-white p-6">
              <div className="rounded-lg bg-yellow-50/60 p-4">
                <img src="/kakao-qr-code.svg" alt="AICC 카카오톡 채널 QR 코드" className="h-52 w-52 rounded-md bg-white object-contain p-3 shadow-sm" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Step({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-yellow-100 bg-white/70 px-3 py-2">
      <span className="text-yellow-700">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
