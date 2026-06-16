import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/auth/session';
import { getSettingsCenterData } from '@/app/lib/db/settingsCenter';

import SettingsCenterClient from './SettingsCenterClient';

export const dynamic = 'force-dynamic';

export default async function SettingsCenterPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin/settings');
  if (user.role !== 'HEAD' && user.role !== 'ADMIN') redirect('/dashboard');

  const data = await getSettingsCenterData();

  return <SettingsCenterClient initialData={data} currentUser={user} />;
}
