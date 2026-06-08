export type CampaignStatus = 'DRAFT' | 'RUNNING' | 'PAUSED' | 'ARCHIVED';

export type Campaign = {
  id: string;
  name: string;
  description?: string | null;
  status: CampaignStatus;
  startAt?: string | null;
  endAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

// ✅ 업데이트 폼에서 보내는 값 타입
export type CampaignUpdateFormValues = {
  name: string;
  description?: string | null; // 폼에서는 빈 문자열 가능
  status: CampaignStatus;
  startAt?: string | null; // undefined 허용
  endAt?: string | null; // undefined 허용
};

export type CampaignListResponse = {
  items: Campaign[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
