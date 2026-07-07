import { Suspense } from 'react';
import { Skeleton } from '@/app/components/ui/skeleton';
import NoticeListClient from './NoticeListClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function BoardListFallback() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-36 max-w-full" />
        <Skeleton className="h-10 w-24 max-w-full" />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="border-b border-slate-100 p-4 last:border-b-0">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NoticePage() {
  return (
    <Suspense fallback={<BoardListFallback />}>
      <NoticeListClient />
    </Suspense>
  );
}
