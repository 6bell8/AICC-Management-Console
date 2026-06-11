import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { PageLoadingSkeleton } from '@/app/components/ui/page-loading-skeleton';
import { getCurrentUser } from '@/app/lib/auth/session';
import OperationsClient from './OperationsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OperationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/operations');
  if (user.role !== 'HEAD' && user.role !== 'ADMIN') redirect('/dashboard');

  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <OperationsClient />
    </Suspense>
  );
}
