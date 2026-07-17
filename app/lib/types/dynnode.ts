export type DynNodeStatus = 'DRAFT' | 'PUBLISHED';

export type DynNodePost = {
  id: string;
  title: string;
  summary: string | null;
  code: string;
  sampleCtx: string;
  ctxKey: string;
  tags: string[];
  status: DynNodeStatus;
  lastEditorName?: string | null;
  createdAt: string;
  updatedAt: string;
};
