import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { MobileTabBar } from "@/components/dashboard/mobile-tab-bar";
import { EventBreadcrumb } from "@/components/dashboard/event-breadcrumb";

export default function DjDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <div className="flex flex-1 flex-col overflow-x-hidden pb-20 md:pb-0">
        <EventBreadcrumb />
        <div className="flex-1">{children}</div>
      </div>
      <MobileTabBar />
    </div>
  );
}
