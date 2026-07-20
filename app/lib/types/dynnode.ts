export type DynNodeStatus = 'DRAFT' | 'PUBLISHED';

export type DynNodeTemplateFileEntry = {
  path: string;
  size: number;
};

export type DynNodeTemplateFile = {
  id: string;
  postId: string;
  originalName: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  fileCount: number;
  manifest: {
    files: DynNodeTemplateFileEntry[];
    entryCandidates: string[];
    rejectedFiles?: string[];
  };
  createdAt: string;
};

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
  templateFile?: DynNodeTemplateFile | null;
};
