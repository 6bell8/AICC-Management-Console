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

export type CampaignUpdateFormValues = {
  name: string;
  description?: string | null;
  status: CampaignStatus;
  startAt?: string | null;
  endAt?: string | null;
};

export type CampaignListResponse = {
  items: Campaign[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
