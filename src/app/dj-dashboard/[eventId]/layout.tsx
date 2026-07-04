import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { MobileTabBar } from "@/components/dashboard/mobile-tab-bar";

export default function DjDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <div className="flex-1 overflow-x-hidden pb-20 md:pb-0">{children}</div>
      <MobileTabBar />
    </div>
  );
}
