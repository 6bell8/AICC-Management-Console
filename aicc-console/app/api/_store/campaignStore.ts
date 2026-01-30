import { promises as fs } from 'fs';
import path from 'path';

import type { Campaign, CampaignStatus } from '../../lib/types/campaign';

type CampaignUpdateInput = {
  name?: string;
  description?: string | null;
  status?: CampaignStatus;
  startAt?: string | null;
  endAt?: string | null;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'campaigns.json');

function nowIso() {
  return new Date().toISOString();
}

function seed(): Campaign[] {
  const now = nowIso();
  return [
    {
      id: 'camp_001',
      name: '2026 Q1 아웃바운드 캠페인',
      description: '초기 더미 캠페인(서버 파일 저장)',
      status: 'DRAFT',
      startAt: null,
      endAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'camp_002',
      name: '채권관리실 OB 캠페인',
      description: null,
      status: 'RUNNING',
      startAt: null,
      endAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(FILE_PATH, JSON.stringify(seed(), null, 2), 'utf-8');
  }
}

export async function readAllCampaigns(): Promise<Campaign[]> {
  await ensureFile();
  const raw = await fs.readFile(FILE_PATH, 'utf-8');
  const data = JSON.parse(raw) as Campaign[];
  return data;
}

export async function writeAllCampaigns(next: Campaign[]): Promise<void> {
  await ensureFile();
  await fs.writeFile(FILE_PATH, JSON.stringify(next, null, 2), 'utf-8');
}

export async function findCampaignById(id: string): Promise<Campaign | null> {
  const all = await readAllCampaigns();
  return all.find((c) => c.id === id) ?? null;
}

export async function updateCampaign(
  id: string,
  patch: {
    name: string;
    description: string | null;
    status: CampaignStatus;
    startAt: string | null;
    endAt: string | null;
  },
) {
  const campaigns = await readAllCampaigns();
  const idx = campaigns.findIndex((c) => c.id === id);
  if (idx === -1) return null;

  const prev = campaigns[idx];

  const next = { ...prev, ...patch };

  const onlyStatusChanged =
    prev.status !== next.status &&
    prev.name === next.name &&
    (prev.description ?? null) === (next.description ?? null) &&
    (prev.startAt ?? null) === (next.startAt ?? null) &&
    (prev.endAt ?? null) === (next.endAt ?? null);

  campaigns[idx] = {
    ...next,
    updatedAt: onlyStatusChanged ? prev.updatedAt : new Date().toISOString(),
  };

  await writeAllCampaigns(campaigns);
  return campaigns[idx];
}

function nextIdFrom(list: Campaign[]) {
  // camp_001 ~ 숫자 자동 증가
  const nums = list
    .map((c) => c.id)
    .map((id) => {
      const m = /^camp_(\d+)$/.exec(id);
      return m ? Number(m[1]) : null;
    })
    .filter((n): n is number => n !== null);

  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `camp_${String(next).padStart(3, '0')}`;
}

export async function createCampaign(): Promise<Campaign> {
  const all = await readAllCampaigns();
  const now = nowIso();
  const id = nextIdFrom(all);

  const c: Campaign = {
    id,
    name: `새 캠페인 (${id})`,
    description: null,
    status: 'DRAFT',
    startAt: null,
    endAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await writeAllCampaigns([c, ...all]);
  return c;
}
