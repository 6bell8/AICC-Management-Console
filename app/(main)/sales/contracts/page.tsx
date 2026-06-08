import ContractsClient from './ContractsClient';
import { listContractDeals } from '@/app/lib/db/contracts';

export default async function Page() {
  const initialDeals = await listContractDeals();
  return <ContractsClient initialDeals={initialDeals} />;
}
