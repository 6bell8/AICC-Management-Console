import type { ContractDeal } from '@/app/lib/types/contracts';

export async function getContractDeals(): Promise<ContractDeal[]> {
  const res = await fetch('/api/contracts/deals', { cache: 'no-store' });
  if (!res.ok) throw new Error('계약 목록을 불러오지 못했습니다.');
  return res.json();
}
