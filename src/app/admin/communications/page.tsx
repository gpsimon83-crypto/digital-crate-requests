import { CommunicationsCenter, type CommTab } from "@/components/comm/communications-center";

const TABS: CommTab[] = ["overview", "templates", "sent", "settings"];

export default async function CommunicationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <CommunicationsCenter tab={TABS.includes(tab as CommTab) ? (tab as CommTab) : "overview"} />;
}
