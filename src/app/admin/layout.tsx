import { AdminSidebarNav } from "@/components/admin/admin-sidebar-nav";
import { AdminMobileTabBar } from "@/components/admin/admin-mobile-tab-bar";
import { Suspense } from "react";
import { GuidedTour } from "@/components/admin/guided-tour";
import { SiteThemeRoot } from "@/components/admin/site-theme";
import { DASH_LAYOUT_BOOT, SITE_THEME_BOOT } from "@/lib/site-theme-boot";
import { ViewSwitch } from "@/components/admin/view-switch";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      {/* Puts the picked site theme on before the first paint (no cream flash on dark looks). */}
      <script dangerouslySetInnerHTML={{ __html: SITE_THEME_BOOT + DASH_LAYOUT_BOOT }} />
      <SiteThemeRoot />
      <AdminSidebarNav />
      <div className="admin-main overflow-x-hidden pb-20 md:pb-0 md:pl-16">{children}</div>
      <AdminMobileTabBar extra={<ViewSwitch to="dj" variant="sheet" />} />
      <Suspense fallback={null}>
        <GuidedTour />
      </Suspense>
    </div>
  );
}
