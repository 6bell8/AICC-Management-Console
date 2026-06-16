import type { RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';

export type EmployeeProfileDetails = {
  userId: string;
  displayName: string;
  address: string;
  education: string;
  awards: string;
  certifications: string;
  photoUrl: string;
  updatedAt: string | null;
};

type ProfileDetailsRow = RowDataPacket & {
  user_id: string;
  display_name: string | null;
  address: string | null;
  education: string | null;
  awards: string | null;
  certifications: string | null;
  photo_url: string | null;
  updated_at: Date | string | null;
};

let tableEnsured = false;

function toIso(value: Date | string | null) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function emptyProfileDetails(userId: string): EmployeeProfileDetails {
  return {
    userId,
    displayName: '',
    address: '',
    education: '',
    awards: '',
    certifications: '',
    photoUrl: '',
    updatedAt: null,
  };
}

function mapProfileDetails(row: ProfileDetailsRow): EmployeeProfileDetails {
  return {
    userId: row.user_id,
    displayName: row.display_name ?? '',
    address: row.address ?? '',
    education: row.education ?? '',
    awards: row.awards ?? '',
    certifications: row.certifications ?? '',
    photoUrl: row.photo_url ?? '',
    updatedAt: toIso(row.updated_at),
  };
}

export async function ensureEmployeeProfileDetailsTable() {
  if (tableEnsured) return;
  const pool = getMysqlPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS employee_profile_details (
      user_id CHAR(36) NOT NULL,
      display_name VARCHAR(100) NULL,
      address VARCHAR(255) NULL,
      education TEXT NULL,
      awards TEXT NULL,
      certifications TEXT NULL,
      photo_url MEDIUMTEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (user_id),
      CONSTRAINT fk_employee_profile_details_user_id
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);
  tableEnsured = true;
}

export async function getEmployeeProfileDetails(userId: string) {
  await ensureEmployeeProfileDetailsTable();
  const pool = getMysqlPool();
  const [rows] = await pool.query<ProfileDetailsRow[]>(
    `
      SELECT user_id, display_name, address, education, awards, certifications, photo_url, updated_at
      FROM employee_profile_details
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId],
  );
  return rows[0] ? mapProfileDetails(rows[0]) : emptyProfileDetails(userId);
}

export async function upsertEmployeeProfileDetails(input: Omit<EmployeeProfileDetails, 'updatedAt'>) {
  await ensureEmployeeProfileDetailsTable();
  const pool = getMysqlPool();
  await pool.execute(
    `
      INSERT INTO employee_profile_details (user_id, display_name, address, education, awards, certifications, photo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        display_name = VALUES(display_name),
        address = VALUES(address),
        education = VALUES(education),
        awards = VALUES(awards),
        certifications = VALUES(certifications),
        photo_url = VALUES(photo_url)
    `,
    [
      input.userId,
      input.displayName.trim() || null,
      input.address.trim() || null,
      input.education.trim() || null,
      input.awards.trim() || null,
      input.certifications.trim() || null,
      input.photoUrl.trim() || null,
    ],
  );
  return getEmployeeProfileDetails(input.userId);
}
