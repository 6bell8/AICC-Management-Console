export type NoticeStatus = 'PUBLISHED' | 'DRAFT';

export type Notice = {
  id: string;
  title: string;
  content: string;
  pinned: boolean; // ✅ 고정
  status: NoticeStatus; // ✅ 노출 여부 (PUBLISHED만 배너/목록 노출로 쓸 수도)
  createdAt: string; // ISO
  updatedAt: string; // ISO
};
