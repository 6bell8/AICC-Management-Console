import { Suspense } from 'react';
import AuthorGuideListClient from './AuthorGuideListClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AuthorGuidePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">불러오는 중...</div>}>
      <AuthorGuideListClient />
    </Suspense>
  );
}
