import ContractsClient from './ContractsClient';
import contracts from '@/data/contracts.json';
import type { ContractDeal } from '@/app/lib/types/contracts';

export default function Page() {
  const initialDeals = contracts as unknown as ContractDeal[];
  return <ContractsClient initialDeals={initialDeals} />;
}
