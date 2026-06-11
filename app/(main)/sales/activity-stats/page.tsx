import { Suspense } from 'react';
import { PageLoadingSkeleton } from '@/app/components/ui/page-loading-skeleton';
import ActivityStatsClient from './ActivityStatsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ActivityStatsPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <ActivityStatsClient />
    </Suspense>
  );
}
