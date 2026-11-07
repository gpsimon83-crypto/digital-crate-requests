"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GlobalSearch } from "@/components/admin/global-search";
import { QuickCreateMenu } from "@/components/admin/quick-create-menu";
import { Sidebar, type SidebarNavGroup } from "@/components/ui/sidebar";
import { ADMIN_NAV_GROUPS } from "@/lib/admin-nav";
import { useWhatsNewCount } from "@/lib/use-whats-new";

export function AdminSidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const whatsNew = useWhatsNewCount();

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => setUnreadCount((data.notifications ?? []).filter((n: { read_at: string | null }) => !n.read_at).length))
      .catch(() => {});
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/dj-dashboard/login");
    router.refresh();
  }

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
      headerExtra={
        <>
          <QuickCreateMenu />
          <GlobalSearch />
        </>
      }
    />
  );
}
