import { WhatsNewDetail } from "@/components/admin/whats-new-detail";

export default async function WhatsNewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WhatsNewDetail id={id} />;
}
