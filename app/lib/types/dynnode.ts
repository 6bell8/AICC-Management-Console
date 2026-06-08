export type DynNodeStatus = 'DRAFT' | 'PUBLISHED';

export type DynNodePost = {
  id: string;
  title: string;
  summary: string | null;
  code: string;
  sampleCtx: string; // JSON 텍스트 그대로 저장
  tags: string[];
  status: DynNodeStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};
