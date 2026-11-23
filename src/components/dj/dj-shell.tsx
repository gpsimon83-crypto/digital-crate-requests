"use client";

import { usePathname } from "next/navigation";
import { Sidebar, type SidebarNavGroup } from "@/components/ui/sidebar";
import { AdminMobileTabBar } from "@/components/admin/admin-mobile-tab-bar";
import { SiteThemeButton, SiteThemeRoot } from "@/components/admin/site-theme";
import { useAdminSignOut, useUnreadNotifications } from "@/components/admin/admin-sidebar-nav";
import { DJ_NAV_GROUPS, DJ_TAB_ITEMS, djShellHidden } from "@/lib/dj-nav";
import { UpdateAvailabilityButton } from "@/components/dj/update-availability";
import { ViewSwitch } from "@/components/admin/view-switch";

/**
 * The DJ portal's frame, like the admin one: side rail (desktop), tab bar
 * with More (phone), the site theme, and Sign Out. Full-screen tools (the
 * flyer editor) and the sign-in pages go without it.
 */
export function DjShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const unread = useUnreadNotifications();
  const signOut = useAdminSignOut();
  if (djShellHidden(pathname)) return <>{children}</>;
  const groups: SidebarNavGroup[] = DJ_NAV_GROUPS.map((g) => ({
    label: g.label,
    items: g.items.map((it) => ({
      ...it,
      ...(it.href === "/dj-dashboard/notifications" ? { badge: unread } : {}),
      ...(it.alsoActive ? { isActive: (p: string) => it.alsoActive!.includes(p) } : {})
    }))
  }));
  return (
    <div className="min-h-dvh bg-background">
      <SiteThemeRoot />
      <Sidebar
        brandHref="/dj-dashboard"
        brandTitle="DJ Portal"
        brandSubtitle="Digital Crate DJs"
        groups={groups}
        onSignOut={signOut}
        variant="rail"
        className="admin-rail"
        footerExtra={(labelClass) => <SiteThemeButton labelClass={labelClass} />}
        headerExtra={
          <>
            <UpdateAvailabilityButton />
            <ViewSwitch to="admin" />
          </>
        }
      />
      <AdminMobileTabBar
        primary={DJ_TAB_ITEMS}
        groups={DJ_NAV_GROUPS}
        extra={
          <>
            <UpdateAvailabilityButton variant="sheet" />
            <ViewSwitch to="admin" variant="sheet" />
          </>
        }
      />
      <div className="admin-main overflow-x-hidden pb-20 md:pb-0 md:pl-16">{children}</div>
    </div>
  );
}
