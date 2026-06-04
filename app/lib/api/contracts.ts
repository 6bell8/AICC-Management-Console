import type { ContractDeal } from '@/app/lib/types/contracts';

export async function getContractDeals(): Promise<ContractDeal[]> {
  const res = await fetch('/api/contracts/deals', { cache: 'no-store' });
  if (!res.ok) throw new Error('계약 목록을 불러오지 못했습니다.');
  return res.json();
}

export async function saveContractDeal(deal: ContractDeal): Promise<ContractDeal> {
  const res = await fetch('/api/contracts/deals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deal),
  });
  if (!res.ok) throw new Error('계약 정보를 저장하지 못했습니다.');
  return res.json();
}

export async function updateContractDealStatus(id: string, status: ContractDeal['status']) {
  const res = await fetch('/api/contracts/deals', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) throw new Error('계약 상태를 저장하지 못했습니다.');
}

export async function deleteContractDeal(id: string) {
  const res = await fetch(`/api/contracts/deals?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('계약 정보를 삭제하지 못했습니다.');
}
