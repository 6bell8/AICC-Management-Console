// app/components/auth/RequireAuth.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authStorage } from '../../lib/auth/storage';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const session = authStorage.getSession();
    if (!session?.token) router.replace(`/login?next=${encodeURIComponent(pathname)}`);

    setOk(true);
  }, [router, pathname]);

  // 로그인 체크 전 깜빡임 방지용(원하면 Skeleton으로 교체 가능)
  if (!ok) return null;

  return <>{children}</>;
}
