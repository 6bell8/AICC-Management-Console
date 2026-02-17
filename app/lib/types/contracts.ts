// types/contracts.ts
export const CONTRACT_STATUSES = ['LEAD', 'PROPOSAL', 'NEGOTIATION', 'CONTRACTED', 'DONE'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_META: ReadonlyArray<{ key: ContractStatus; label: string }> = [
  { key: 'LEAD', label: '리드' },
  { key: 'PROPOSAL', label: '제안' },
  { key: 'NEGOTIATION', label: '협상' },
  { key: 'CONTRACTED', label: '계약' },
  { key: 'DONE', label: '완료' },
] as const;

export type ContractLineItem = {
  id: string; // 추후 uuid 권장
  name: string; // 품목명
  qty: number; // 수량
  unitPrice: number; // 단가
};

export type ContractDeal = {
  id: string;
  status: ContractStatus;

  title: string;
  customer: string;
  owner: string;
  closeDate: string; // 'YYYY-MM-DD' (추후 Date or ISO로 변경 가능)
  notes?: string;

  discount: number; // 할인(정액)
  commissionRate: number; // 수수료율(%)
  items: ContractLineItem[];
};
