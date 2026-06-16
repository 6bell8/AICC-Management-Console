import type { RowDataPacket } from 'mysql2/promise';

import type { AuthUser } from '../db/users';
import { getMysqlPool } from '../db/mysql';

export type TeamScope = {
  scope: 'ALL' | 'TEAM' | 'SELF';
  teamIds: string[];
};

export function isGlobalAdmin(user: Pick<AuthUser, 'role'> | null | undefined) {
  return user?.role === 'HEAD' || user?.role === 'ADMIN';
}

export function canWrite(user: Pick<AuthUser, 'role'> | null | undefined) {
  return Boolean(user && user.role !== 'VIEWER');
}

export async function getHeadedTeamIds(user: Pick<AuthUser, 'id' | 'role'>) {
  if (isGlobalAdmin(user)) return [];

  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT DISTINCT team_id AS id
      FROM user_team_memberships
      WHERE user_id = ? AND team_role = 'HEAD'
      UNION
      SELECT id
      FROM teams
      WHERE head_user_id = ?
    `,
    [user.id, user.id],
  );

  return rows.map((row) => String(row.id)).filter(Boolean);
}

export async function getTeamScope(user: Pick<AuthUser, 'id' | 'role'>): Promise<TeamScope> {
  if (isGlobalAdmin(user)) return { scope: 'ALL', teamIds: [] };

  const teamIds = await getHeadedTeamIds(user);
  if (teamIds.length > 0) return { scope: 'TEAM', teamIds };

  return { scope: 'SELF', teamIds: [] };
}

export async function isTeamHeadByName(user: Pick<AuthUser, 'id' | 'role'>, names: string[]) {
  if (isGlobalAdmin(user)) return true;
  if (names.length === 0) return false;

  const pool = getMysqlPool();
  const placeholders = names.map(() => '?').join(', ');
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT 1
      FROM teams t
      LEFT JOIN user_team_memberships team_head
        ON team_head.team_id = t.id
       AND team_head.user_id = ?
       AND team_head.team_role = 'HEAD'
      WHERE t.name IN (${placeholders})
        AND (t.head_user_id = ? OR team_head.user_id IS NOT NULL)
      LIMIT 1
    `,
    [user.id, ...names, user.id],
  );

  return Boolean(rows[0]);
}

export async function canSettleTripExpenses(user: Pick<AuthUser, 'id' | 'role'>) {
  return isTeamHeadByName(user, ['인사팀', 'HR', 'Human Resources']);
}

