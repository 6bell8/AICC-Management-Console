import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/auth/session';
import ChangePasswordClient from './ChangePasswordClient';

export const dynamic = 'force-dynamic';

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/change-password');

  return <ChangePasswordClient forcePasswordChange={user.forcePasswordChange} />;
}
