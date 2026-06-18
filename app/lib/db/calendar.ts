import { randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';
import type { AuthUser } from './users';

export type CalendarMemoScope = 'PERSONAL' | 'TEAM';

export type CalendarMemo = {
  id: string;
  scope: CalendarMemoScope;
  date: string;
  text: string;
  createdBy: string;
  createdByName: string;
  teamId: string | null;
  createdAt: string;
};

type CalendarMemoRow = RowDataPacket & {
  id: string;
  scope: CalendarMemoScope;
  memo_date: Date | string;
  memo_text: string;
  created_by: string;
  created_by_name: string;
  team_id: string | null;
  created_at: Date | string;
};

type TeamRow = RowDataPacket & {
  team_id: string | null;
};

let schemaReady: Promise<void> | null = null;

function toDateKey(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function toIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapMemo(row: CalendarMemoRow): CalendarMemo {
  return {
    id: row.id,
    scope: row.scope,
    date: toDateKey(row.memo_date),
    text: row.memo_text,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    teamId: row.team_id,
    createdAt: toIso(row.created_at),
  };
}

async function ensureCalendarSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await getMysqlPool().execute(`
        CREATE TABLE IF NOT EXISTS calendar_memos (
          id CHAR(36) NOT NULL,
          scope ENUM('PERSONAL', 'TEAM') NOT NULL,
          memo_date DATE NOT NULL,
          memo_text TEXT NOT NULL,
          created_by CHAR(36) NOT NULL,
          team_id CHAR(36) NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          INDEX idx_calendar_memos_personal (created_by, memo_date),
          INDEX idx_calendar_memos_team (team_id, memo_date),
          CONSTRAINT fk_calendar_memos_created_by
            FOREIGN KEY (created_by) REFERENCES users (id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
    })();
  }
  return schemaReady;
}

async function getUserTeamId(userId: string) {
  const [rows] = await getMysqlPool().query<TeamRow[]>(
    `
      SELECT team_id
      FROM employee_profiles
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId],
  );
  return rows[0]?.team_id ?? null;
}

export async function listCalendarMemos(input: { user: AuthUser; scope: CalendarMemoScope; month: string }) {
  await ensureCalendarSchema();
  const teamId = await getUserTeamId(input.user.id);
  const [year, monthRaw] = input.month.split('-').map(Number);
  const startDate = `${year}-${String(monthRaw).padStart(2, '0')}-01`;
  const end = new Date(year, monthRaw, 0);
  const endDate = `${year}-${String(monthRaw).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

  const where =
    input.scope === 'PERSONAL'
      ? 'cm.scope = ? AND cm.created_by = ? AND cm.memo_date BETWEEN ? AND ?'
      : teamId
        ? 'cm.scope = ? AND cm.team_id = ? AND cm.memo_date BETWEEN ? AND ?'
        : 'cm.scope = ? AND cm.created_by = ? AND cm.memo_date BETWEEN ? AND ?';
  const params = input.scope === 'TEAM' && teamId ? [input.scope, teamId, startDate, endDate] : [input.scope, input.user.id, startDate, endDate];

  const [rows] = await getMysqlPool().query<CalendarMemoRow[]>(
    `
      SELECT cm.id, cm.scope, cm.memo_date, cm.memo_text, cm.created_by,
             u.name AS created_by_name, cm.team_id, cm.created_at
      FROM calendar_memos cm
      JOIN users u ON u.id = cm.created_by
      WHERE ${where}
      ORDER BY cm.memo_date ASC, cm.created_at DESC
    `,
    params,
  );
  return rows.map(mapMemo);
}

export async function createCalendarMemo(input: { user: AuthUser; scope: CalendarMemoScope; date: string; text: string }) {
  await ensureCalendarSchema();
  const id = randomUUID();
  const teamId = input.scope === 'TEAM' ? await getUserTeamId(input.user.id) : null;
  await getMysqlPool().execute(
    `
      INSERT INTO calendar_memos (id, scope, memo_date, memo_text, created_by, team_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [id, input.scope, input.date, input.text.trim(), input.user.id, teamId],
  );
  return id;
}
