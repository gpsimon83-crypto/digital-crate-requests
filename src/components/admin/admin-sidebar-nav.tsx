"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GlobalSearch } from "@/components/admin/global-search";
import { QuickCreateMenu } from "@/components/admin/quick-create-menu";
import { Sidebar, type SidebarNavGroup } from "@/components/ui/sidebar";
import { ADMIN_NAV_GROUPS } from "@/lib/admin-nav";
import { useWhatsNewCount } from "@/lib/use-whats-new";
import { SiteThemeButton } from "@/components/admin/site-theme";

/** Unread notifications, refreshed on each page change (shared with the dashboard's top menu). */
export function useUnreadNotifications() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => setUnreadCount((data.notifications ?? []).filter((n: { read_at: string | null }) => !n.read_at).length))
      .catch(() => {});
  }, [pathname]);
  return unreadCount;
}

export function useAdminSignOut() {
  const router = useRouter();
  return async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/dj-dashboard/login");
    router.refresh();
  };
}

export function AdminSidebarNav() {
  const unreadCount = useUnreadNotifications();
  const whatsNew = useWhatsNewCount();
  const handleLogout = useAdminSignOut();

  const groups: SidebarNavGroup[] = ADMIN_NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.map((item) =>
      item.href === "/admin/notifications"
        ? { ...item, badge: unreadCount }
        : item.href === "/admin/whats-new"
          ? { ...item, badge: whatsNew }
          : item
    )
  }));

  return (
    <Sidebar
      brandHref="/admin"
      brandTitle="Admin"
      brandSubtitle="Digital Crate DJs"
      groups={groups}
      onSignOut={handleLogout}
      variant="rail"
      className="admin-rail"
      footerExtra={(labelClass) => <SiteThemeButton labelClass={labelClass} />}
      headerExtra={
        <>
          <QuickCreateMenu />
          <GlobalSearch />
        </>
      }
    />
  );
}
