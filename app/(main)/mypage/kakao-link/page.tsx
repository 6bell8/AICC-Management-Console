import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/auth/session';
import KakaoLinkVerifyClient from './KakaoLinkVerifyClient';

export const dynamic = 'force-dynamic';

export default async function KakaoLinkPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/mypage/kakao-link');

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="inline-flex rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700">Kakao Account Link</span>
          <h1 className="mt-3 text-xl font-semibold text-slate-950">카카오 계정 연동</h1>
          <p className="mt-1 text-sm text-slate-500">카카오 채널에서 발급받은 1회용 코드를 확인해 AICC 계정과 연결합니다.</p>
        </div>
        <Link href="/mypage" className="w-fit rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
          마이페이지로 돌아가기
        </Link>
      </div>

      <KakaoLinkVerifyClient userName={user.name} userEmail={user.email} />
    </div>
  );
}
