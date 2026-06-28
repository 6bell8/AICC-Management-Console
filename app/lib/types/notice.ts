export type NoticeStatus = 'PUBLISHED' | 'DRAFT';

export type NoticeAttachment = {
  name: string;
  url: string;
};

export type Notice = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  status: NoticeStatus;
  attachments?: NoticeAttachment[];
  revisionCount?: number;
  lastEditorName?: string | null;
  createdAt: string;
  updatedAt: string;
};
