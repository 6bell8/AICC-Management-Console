import { Suspense } from 'react';
import { PageLoadingSkeleton } from '@/app/components/ui/page-loading-skeleton';
import CampaignsClient from './CampaignsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function CampaignsPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <CampaignsClient />
    </Suspense>
  );
}
