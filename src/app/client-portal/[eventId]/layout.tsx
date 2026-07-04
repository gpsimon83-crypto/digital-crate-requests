import { ClientSidebarNav } from "@/components/client-portal/client-sidebar-nav";
import { ClientMobileTabBar } from "@/components/client-portal/client-mobile-tab-bar";

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <ClientSidebarNav />
      <div className="flex-1 overflow-x-hidden pb-20 md:pb-0">{children}</div>
      <ClientMobileTabBar />
    </div>
  );
}
