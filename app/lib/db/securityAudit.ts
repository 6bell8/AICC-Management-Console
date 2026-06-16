import { randomUUID } from 'crypto';

import { getMysqlPool } from './mysql';

type SecurityAuditAction =
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'SETTINGS_UPDATED'
  | 'TRIP_EXPENSE_APPROVED'
  | 'TRIP_EXPENSE_REJECTED'
  | 'TRIP_EXPENSE_SETTLED';

export async function createSecurityAuditLog(input: {
  actorId: string | null;
  targetUserId: string | null;
  action: SecurityAuditAction;
  details?: Record<string, unknown>;
}) {
  const pool = getMysqlPool();
  await pool.execute(
    `
      INSERT INTO security_audit_logs (id, actor_id, target_user_id, action, details)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      randomUUID(),
      input.actorId,
      input.targetUserId,
      input.action,
      input.details ? JSON.stringify(input.details) : null,
    ],
  );
}
