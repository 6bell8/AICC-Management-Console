import { Suspense } from 'react';
import { PageLoadingSkeleton } from '@/app/components/ui/page-loading-skeleton';
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <LoginClient />
    </Suspense>
  );
}
