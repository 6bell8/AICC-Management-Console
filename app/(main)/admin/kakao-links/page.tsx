import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/auth/session';
import KakaoLinksClient from './KakaoLinksClient';

export const dynamic = 'force-dynamic';

export default async function KakaoLinksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin/kakao-links');
  if (user.role !== 'HEAD' && user.role !== 'ADMIN') redirect('/dashboard');

  return <KakaoLinksClient currentUser={user} />;
}
