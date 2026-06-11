import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';
import type { AuthUser } from './users';
import type { RoomReservation, RoomReservationSnapshot, RoomResource, RoomResourceType } from '../types/roomReservation';

type ResourceRow = RowDataPacket & {
  id: string;
  name: string;
  type: RoomResourceType;
  location: string | null;
  capacity: number;
  description: string | null;
  active: number | boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type ReservationRow = RowDataPacket & {
  id: string;
  resource_id: string;
  resource_name: string;
  resource_type: RoomResourceType;
  requester_id: string;
  requester_name: string;
  title: string;
  purpose: string | null;
  starts_at: Date | string;
  ends_at: Date | string;
  status: RoomReservation['status'];
  created_at: Date | string;
  updated_at: Date | string;
};

let schemaReady: Promise<void> | null = null;

function toIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toSqlDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('예약 시간을 확인해 주세요.');
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function mapResource(row: ResourceRow): RoomResource {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    location: row.location,
    capacity: Number(row.capacity),
    description: row.description,
    active: Boolean(row.active),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapReservation(row: ReservationRow): RoomReservation {
  return {
    id: row.id,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    resourceType: row.resource_type,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    title: row.title,
    purpose: row.purpose,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function ensureRoomReservationSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const pool = getMysqlPool();
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS meeting_resources (
          id CHAR(36) NOT NULL,
          name VARCHAR(100) NOT NULL,
          type ENUM('MEETING_ROOM', 'TRAINING_ROOM') NOT NULL DEFAULT 'MEETING_ROOM',
          location VARCHAR(120) NULL,
          capacity INT NOT NULL DEFAULT 1,
          description TEXT NULL,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          INDEX idx_meeting_resources_type_active (type, active),
          CONSTRAINT chk_meeting_resources_capacity CHECK (capacity > 0)
        ) ENGINE=InnoDB
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS meeting_reservations (
          id CHAR(36) NOT NULL,
          resource_id CHAR(36) NOT NULL,
          requester_id CHAR(36) NOT NULL,
          title VARCHAR(160) NOT NULL,
          purpose TEXT NULL,
          starts_at DATETIME(3) NOT NULL,
          ends_at DATETIME(3) NOT NULL,
          status ENUM('PENDING', 'APPROVED', 'CANCELLED') NOT NULL DEFAULT 'APPROVED',
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          INDEX idx_meeting_reservations_resource_time (resource_id, starts_at, ends_at),
          INDEX idx_meeting_reservations_requester_created (requester_id, created_at),
          CONSTRAINT fk_meeting_reservations_resource
            FOREIGN KEY (resource_id) REFERENCES meeting_resources (id)
            ON DELETE CASCADE,
          CONSTRAINT fk_meeting_reservations_requester
            FOREIGN KEY (requester_id) REFERENCES users (id)
            ON DELETE CASCADE,
          CONSTRAINT chk_meeting_reservations_time CHECK (ends_at > starts_at)
        ) ENGINE=InnoDB
      `);
    })();
  }
  return schemaReady;
}

export async function listRoomReservationSnapshot(input?: { date?: string; startDate?: string; endDate?: string } | string): Promise<RoomReservationSnapshot> {
  await ensureRoomReservationSchema();
  const pool = getMysqlPool();
  const params = typeof input === 'string' ? { date: input } : input ?? {};
  const targetDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : new Date().toISOString().slice(0, 10);
  const startDate = params.startDate && /^\d{4}-\d{2}-\d{2}$/.test(params.startDate) ? params.startDate : targetDate;
  const endDate = params.endDate && /^\d{4}-\d{2}-\d{2}$/.test(params.endDate) ? params.endDate : targetDate;

  const [resources] = await pool.execute<ResourceRow[]>(
    `SELECT id, name, type, location, capacity, description, active, created_at, updated_at
     FROM meeting_resources
     WHERE active = TRUE
     ORDER BY FIELD(type, 'MEETING_ROOM', 'TRAINING_ROOM'), name ASC`,
  );
  const [reservations] = await pool.execute<ReservationRow[]>(
    `SELECT mr.id, mr.resource_id, res.name AS resource_name, res.type AS resource_type,
            mr.requester_id, u.name AS requester_name, mr.title, mr.purpose,
            mr.starts_at, mr.ends_at, mr.status, mr.created_at, mr.updated_at
       FROM meeting_reservations mr
       JOIN meeting_resources res ON res.id = mr.resource_id
       JOIN users u ON u.id = mr.requester_id
      WHERE DATE(mr.starts_at) <= ? AND DATE(mr.ends_at) >= ?
      ORDER BY mr.starts_at ASC, mr.ends_at ASC`,
    [endDate, startDate],
  );

  return {
    resources: resources.map(mapResource),
    reservations: reservations.map(mapReservation),
  };
}

export async function createRoomResource(input: {
  name: string;
  type: RoomResourceType;
  location?: string | null;
  capacity: number;
  description?: string | null;
}) {
  await ensureRoomReservationSchema();
  const id = randomUUID();
  await getMysqlPool().execute(
    `INSERT INTO meeting_resources (id, name, type, location, capacity, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.name.trim(), input.type, input.location?.trim() || null, input.capacity, input.description?.trim() || null],
  );
  return id;
}

export async function deleteRoomResource(id: string) {
  await ensureRoomReservationSchema();
  const [result] = await getMysqlPool().execute<ResultSetHeader>('DELETE FROM meeting_resources WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function createRoomReservation(input: {
  user: AuthUser;
  resourceId: string;
  title: string;
  purpose?: string | null;
  startsAt: string;
  endsAt: string;
}) {
  await ensureRoomReservationSchema();
  const pool = getMysqlPool();
  const startsAt = toSqlDateTime(input.startsAt);
  const endsAt = toSqlDateTime(input.endsAt);
  if (new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) {
    throw new Error('종료 시간은 시작 시간보다 늦어야 합니다.');
  }

  const [resourceRows] = await pool.execute<RowDataPacket[]>('SELECT id FROM meeting_resources WHERE id = ? AND active = TRUE', [input.resourceId]);
  if (resourceRows.length === 0) throw new Error('예약할 공간을 찾을 수 없습니다.');

  const [conflicts] = await pool.execute<RowDataPacket[]>(
    `SELECT id
       FROM meeting_reservations
      WHERE resource_id = ?
        AND status IN ('PENDING', 'APPROVED')
        AND starts_at < ?
        AND ends_at > ?
      LIMIT 1`,
    [input.resourceId, endsAt, startsAt],
  );
  if (conflicts.length > 0) throw new Error('선택한 시간에 이미 예약이 있습니다.');

  const id = randomUUID();
  await pool.execute(
    `INSERT INTO meeting_reservations (id, resource_id, requester_id, title, purpose, starts_at, ends_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED')`,
    [id, input.resourceId, input.user.id, input.title.trim(), input.purpose?.trim() || null, startsAt, endsAt],
  );
  return id;
}

export async function cancelRoomReservation(input: { id: string; user: AuthUser }) {
  await ensureRoomReservationSchema();
  const pool = getMysqlPool();
  const isAdmin = input.user.role === 'HEAD' || input.user.role === 'ADMIN';
  const params = isAdmin ? [input.id] : [input.id, input.user.id];
  const where = isAdmin ? 'id = ?' : 'id = ? AND requester_id = ?';
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE meeting_reservations SET status = 'CANCELLED' WHERE ${where} AND status <> 'CANCELLED'`,
    params,
  );
  return result.affectedRows > 0;
}
