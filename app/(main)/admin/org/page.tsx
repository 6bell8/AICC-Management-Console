import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/auth/session';
import { listOrganizationSnapshot } from '@/app/lib/db/erp';

import OrgManagementClient from './OrgManagementClient';

export const dynamic = 'force-dynamic';

export default async function OrganizationPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin/org');

  const data = await listOrganizationSnapshot();

  return <OrgManagementClient initialData={data as Parameters<typeof OrgManagementClient>[0]['initialData']} currentUser={user} />;
}
