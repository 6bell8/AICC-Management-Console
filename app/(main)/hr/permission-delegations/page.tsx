import { redirect } from 'next/navigation';

import { getDirectHeadedTeamIds, isGlobalAdmin } from '@/app/lib/auth/authorization';
import { getCurrentUser } from '@/app/lib/auth/session';
import { getSettingsCenterData } from '@/app/lib/db/settingsCenter';

import PermissionDelegationsClient from './PermissionDelegationsClient';

export const dynamic = 'force-dynamic';

export default async function PermissionDelegationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/hr/permission-delegations');

  const data = await getSettingsCenterData();
  const globalAdmin = isGlobalAdmin(user);
  const headedTeamIds = globalAdmin ? [] : await getDirectHeadedTeamIds(user);
  if (!globalAdmin && headedTeamIds.length === 0) redirect('/dashboard');

  const scopedData = globalAdmin
    ? data
    : {
        ...data,
        teams: data.teams.filter((team) => headedTeamIds.includes(team.id)),
        approvedUsers: data.approvedUsers.filter((approvedUser) => approvedUser.id === user.id || (approvedUser.teamId ? headedTeamIds.includes(approvedUser.teamId) : false)),
        permissionDelegations: data.permissionDelegations.filter((delegation) => headedTeamIds.includes(delegation.teamId)),
      };

  return <PermissionDelegationsClient initialData={scopedData} currentUser={user} />;
}
