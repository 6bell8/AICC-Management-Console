import { randomUUID } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from './mysql';
import { createSecurityAuditLog } from './securityAudit';
import type { AuthUser } from './users';

export type OperationalAssetStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'REVIEW';
export type OperationalAssetType = 'LICENSE' | 'CONTRACT' | 'CERTIFICATE' | 'SECURITY_DOC' | 'ETC';

export type OperationalAssetFile = {
  id: string;
  assetId: string;
  originalName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  storageProvider: string;
  storageKey: string | null;
  uploadedByName: string | null;
  createdAt: string;
};

export type OperationalAsset = {
  id: string;
  type: OperationalAssetType;
  name: string;
  vendor: string;
  ownerName: string | null;
  teamName: string | null;
  status: OperationalAssetStatus;
  startsAt: string | null;
  expiresAt: string | null;
  renewalNoticeDays: number;
  memo: string | null;
  files: OperationalAssetFile[];
};

export type OperationalAssetAccessLog = {
  id: string;
  assetName: string;
  fileName: string;
  action: string;
  actorName: string;
  actorEmail: string | null;
  createdAt: string;
};

type AssetRow = RowDataPacket & {
  id: string;
  asset_type: OperationalAssetType;
  name: string;
  vendor: string;
  owner_name: string | null;
  team_name: string | null;
  status: OperationalAssetStatus;
  starts_at: Date | string | null;
  expires_at: Date | string | null;
  renewal_notice_days: number;
  memo: string | null;
};

type FileRow = RowDataPacket & {
  id: string;
  asset_id: string;
  original_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  storage_provider: string;
  storage_key: string | null;
  uploaded_by_name: string | null;
  created_at: Date | string;
};

type AccessLogRow = RowDataPacket & {
  id: string;
  asset_name: string;
  file_name: string;
  action: string;
  actor_name: string;
  actor_email: string | null;
  created_at: Date | string;
};

let schemaReady: Promise<void> | null = null;

function toDateKey(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function toIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

async function ensureOperationalAssetSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const pool = getMysqlPool();
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS operational_assets (
          id CHAR(36) NOT NULL,
          asset_type ENUM('LICENSE', 'CONTRACT', 'CERTIFICATE', 'SECURITY_DOC', 'ETC') NOT NULL DEFAULT 'LICENSE',
          name VARCHAR(180) NOT NULL,
          vendor VARCHAR(160) NOT NULL,
          owner_user_id CHAR(36) NULL,
          team_id CHAR(36) NULL,
          status ENUM('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'REVIEW') NOT NULL DEFAULT 'ACTIVE',
          starts_at DATE NULL,
          expires_at DATE NULL,
          renewal_notice_days INT NOT NULL DEFAULT 30,
          memo TEXT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          INDEX idx_operational_assets_status_expires (status, expires_at),
          INDEX idx_operational_assets_team_status (team_id, status),
          CONSTRAINT fk_operational_assets_owner
            FOREIGN KEY (owner_user_id) REFERENCES users (id)
            ON DELETE SET NULL
        ) ENGINE=InnoDB
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS operational_asset_files (
          id CHAR(36) NOT NULL,
          asset_id CHAR(36) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          file_type VARCHAR(80) NOT NULL,
          mime_type VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
          file_size BIGINT NOT NULL DEFAULT 0,
          storage_provider VARCHAR(40) NOT NULL DEFAULT 'PENDING',
          storage_key VARCHAR(500) NULL,
          uploaded_by CHAR(36) NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          INDEX idx_operational_asset_files_asset_created (asset_id, created_at),
          CONSTRAINT fk_operational_asset_files_asset
            FOREIGN KEY (asset_id) REFERENCES operational_assets (id)
            ON DELETE CASCADE,
          CONSTRAINT fk_operational_asset_files_uploaded_by
            FOREIGN KEY (uploaded_by) REFERENCES users (id)
            ON DELETE SET NULL
        ) ENGINE=InnoDB
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS operational_asset_access_logs (
          id CHAR(36) NOT NULL,
          asset_id CHAR(36) NOT NULL,
          file_id CHAR(36) NULL,
          action ENUM('VIEW', 'DOWNLOAD', 'UPLOAD', 'DELETE') NOT NULL,
          actor_id CHAR(36) NULL,
          ip_address VARCHAR(80) NULL,
          user_agent TEXT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          INDEX idx_operational_asset_access_logs_asset_created (asset_id, created_at),
          INDEX idx_operational_asset_access_logs_actor_created (actor_id, created_at),
          CONSTRAINT fk_operational_asset_access_logs_asset
            FOREIGN KEY (asset_id) REFERENCES operational_assets (id)
            ON DELETE CASCADE,
          CONSTRAINT fk_operational_asset_access_logs_file
            FOREIGN KEY (file_id) REFERENCES operational_asset_files (id)
            ON DELETE SET NULL,
          CONSTRAINT fk_operational_asset_access_logs_actor
            FOREIGN KEY (actor_id) REFERENCES users (id)
            ON DELETE SET NULL
        ) ENGINE=InnoDB
      `);
      await seedOperationalAssets();
    })();
  }
  return schemaReady;
}

async function seedOperationalAssets() {
  const pool = getMysqlPool();
  const [countRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS count FROM operational_assets');
  if (Number(countRows[0]?.count ?? 0) > 0) return;

  const assets = [
    {
      id: randomUUID(),
      type: 'LICENSE',
      name: 'AICC 상담 녹취 솔루션',
      vendor: 'VoiceOps Korea',
      status: 'ACTIVE',
      startsAt: '2026-01-01',
      expiresAt: '2026-12-31',
      memo: '상담 녹취 및 보관 모듈 운영 라이선스',
      files: [
        ['라이선스 증서', 'AICC-recording-license.pdf'],
        ['계약서', 'AICC-recording-contract.pdf'],
      ],
    },
    {
      id: randomUUID(),
      type: 'LICENSE',
      name: '상담 지식관리 모듈',
      vendor: 'Knowledge Base Lab',
      status: 'EXPIRING_SOON',
      startsAt: '2025-08-01',
      expiresAt: '2026-07-30',
      memo: '만료 전 갱신 견적 확인 필요',
      files: [
        ['갱신 문서', 'knowledge-module-renewal.docx'],
        ['라이선스 증서', 'knowledge-module-license.pdf'],
      ],
    },
    {
      id: randomUUID(),
      type: 'SECURITY_DOC',
      name: '보안 점검 리포트 패키지',
      vendor: 'SecureWorks',
      status: 'REVIEW',
      startsAt: '2026-03-01',
      expiresAt: '2026-09-15',
      memo: '금융권 보안 점검 대응 자료',
      files: [['보안 검토', 'security-review-report.pdf']],
    },
  ] as const;

  for (const asset of assets) {
    await pool.execute(
      `
        INSERT INTO operational_assets (id, asset_type, name, vendor, status, starts_at, expires_at, memo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [asset.id, asset.type, asset.name, asset.vendor, asset.status, asset.startsAt, asset.expiresAt, asset.memo],
    );
    for (const [fileType, originalName] of asset.files) {
      await pool.execute(
        `
          INSERT INTO operational_asset_files (id, asset_id, original_name, file_type, mime_type, file_size, storage_provider)
          VALUES (?, ?, ?, ?, 'application/pdf', ?, 'DEMO')
        `,
        [randomUUID(), asset.id, originalName, fileType, 240_000],
      );
    }
  }
}

export async function listOperationalAssets() {
  await ensureOperationalAssetSchema();
  const pool = getMysqlPool();
  const [assetRows] = await pool.query<AssetRow[]>(
    `
      SELECT oa.id, oa.asset_type, oa.name, oa.vendor, owner.name AS owner_name, team.name AS team_name,
             oa.status, oa.starts_at, oa.expires_at, oa.renewal_notice_days, oa.memo
      FROM operational_assets oa
      LEFT JOIN users owner ON owner.id = oa.owner_user_id
      LEFT JOIN teams team ON team.id = oa.team_id
      ORDER BY FIELD(oa.status, 'EXPIRING_SOON', 'REVIEW', 'ACTIVE', 'EXPIRED'), oa.expires_at ASC, oa.name ASC
    `,
  );
  const [fileRows] = await pool.query<FileRow[]>(
    `
      SELECT oaf.id, oaf.asset_id, oaf.original_name, oaf.file_type, oaf.mime_type, oaf.file_size,
             oaf.storage_provider, oaf.storage_key, uploader.name AS uploaded_by_name, oaf.created_at
      FROM operational_asset_files oaf
      LEFT JOIN users uploader ON uploader.id = oaf.uploaded_by
      ORDER BY oaf.created_at DESC
    `,
  );
  const filesByAsset = new Map<string, OperationalAssetFile[]>();
  for (const row of fileRows) {
    filesByAsset.set(row.asset_id, [
      ...(filesByAsset.get(row.asset_id) ?? []),
      {
        id: row.id,
        assetId: row.asset_id,
        originalName: row.original_name,
        fileType: row.file_type,
        mimeType: row.mime_type,
        fileSize: Number(row.file_size),
        storageProvider: row.storage_provider,
        storageKey: row.storage_key,
        uploadedByName: row.uploaded_by_name,
        createdAt: toIso(row.created_at),
      },
    ]);
  }

  return assetRows.map<OperationalAsset>((row) => ({
    id: row.id,
    type: row.asset_type,
    name: row.name,
    vendor: row.vendor,
    ownerName: row.owner_name,
    teamName: row.team_name,
    status: row.status,
    startsAt: toDateKey(row.starts_at),
    expiresAt: toDateKey(row.expires_at),
    renewalNoticeDays: Number(row.renewal_notice_days),
    memo: row.memo,
    files: filesByAsset.get(row.id) ?? [],
  }));
}

export async function listOperationalAssetAccessLogs() {
  await ensureOperationalAssetSchema();
  const [rows] = await getMysqlPool().query<AccessLogRow[]>(
    `
      SELECT oaal.id, oa.name AS asset_name, COALESCE(oaf.original_name, '-') AS file_name,
             oaal.action, COALESCE(actor.name, '-') AS actor_name, actor.email AS actor_email, oaal.created_at
      FROM operational_asset_access_logs oaal
      JOIN operational_assets oa ON oa.id = oaal.asset_id
      LEFT JOIN operational_asset_files oaf ON oaf.id = oaal.file_id
      LEFT JOIN users actor ON actor.id = oaal.actor_id
      ORDER BY oaal.created_at DESC
      LIMIT 8
    `,
  );
  return rows.map<OperationalAssetAccessLog>((row) => ({
    id: row.id,
    assetName: row.asset_name,
    fileName: row.file_name,
    action: row.action,
    actorName: row.actor_name,
    actorEmail: row.actor_email,
    createdAt: toIso(row.created_at),
  }));
}

export async function recordOperationalAssetDownload(input: {
  user: AuthUser;
  fileId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await ensureOperationalAssetSchema();
  const pool = getMysqlPool();
  const [rows] = await pool.query<(FileRow & { asset_name: string })[]>(
    `
      SELECT oaf.id, oaf.asset_id, oaf.original_name, oaf.file_type, oaf.mime_type, oaf.file_size,
             oaf.storage_provider, oaf.storage_key, uploader.name AS uploaded_by_name, oaf.created_at,
             oa.name AS asset_name
      FROM operational_asset_files oaf
      JOIN operational_assets oa ON oa.id = oaf.asset_id
      LEFT JOIN users uploader ON uploader.id = oaf.uploaded_by
      WHERE oaf.id = ?
      LIMIT 1
    `,
    [input.fileId],
  );
  const file = rows[0];
  if (!file) return null;

  await pool.execute(
    `
      INSERT INTO operational_asset_access_logs (id, asset_id, file_id, action, actor_id, ip_address, user_agent)
      VALUES (?, ?, ?, 'DOWNLOAD', ?, ?, ?)
    `,
    [randomUUID(), file.asset_id, file.id, input.user.id, input.ipAddress ?? null, input.userAgent ?? null],
  );
  await createSecurityAuditLog({
    actorId: input.user.id,
    targetUserId: null,
    action: 'ASSET_FILE_DOWNLOADED',
    details: {
      assetId: file.asset_id,
      assetName: file.asset_name,
      fileId: file.id,
      fileName: file.original_name,
      storageProvider: file.storage_provider,
    },
  });

  return {
    id: file.id,
    assetId: file.asset_id,
    assetName: file.asset_name,
    originalName: file.original_name,
    fileType: file.file_type,
    mimeType: file.mime_type,
    fileSize: Number(file.file_size),
    storageProvider: file.storage_provider,
    storageKey: file.storage_key,
  };
}
