import CampaignDetailClient from './CampaignDetailClient';

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // ✅ 여기서 언랩
  return <CampaignDetailClient id={id} />;
}
