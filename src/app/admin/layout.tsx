import { AdminSidebarNav } from "@/components/admin/admin-sidebar-nav";
import { AdminMobileTabBar } from "@/components/admin/admin-mobile-tab-bar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <AdminSidebarNav />
      <div className="overflow-x-hidden pb-20 md:pb-0 md:pl-16">{children}</div>
      <AdminMobileTabBar />
    </div>
  );
}
