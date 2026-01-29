'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authStorage } from './lib/auth/storage';

function Background() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* soft blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-black/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-black/5 blur-3xl" />

      {/* subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative flex min-h-screen items-center justify-center">
        <div className="rounded-2xl border border-black/10 bg-white/70 px-6 py-4 shadow-sm backdrop-blur">
          <p className="text-sm text-black/70">준비 중…</p>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const token = authStorage.getToken();
    if (token) router.replace('/dashboard');
    else router.replace('/login?next=/dashboard');
  }, [router]);

  return <Background />;
}
