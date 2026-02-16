import { Suspense } from 'react';
import DynNodeListClient from './DynNodeListClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DynNodeListPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">불러오는 중...</div>}>
      <DynNodeListClient />
    </Suspense>
  );
}
