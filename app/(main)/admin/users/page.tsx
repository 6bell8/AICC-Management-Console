import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/auth/session';
import UsersAdminClient from './UsersAdminClient';

export const dynamic = 'force-dynamic';

export default async function UsersAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin/users');
  if (user.role !== 'HEAD' && user.role !== 'ADMIN') redirect('/dashboard');

  return <UsersAdminClient currentUser={user} />;
}
