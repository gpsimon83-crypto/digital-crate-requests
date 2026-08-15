"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GlobalSearch } from "@/components/admin/global-search";
import { QuickCreateMenu } from "@/components/admin/quick-create-menu";
import { Sidebar, type SidebarNavGroup } from "@/components/ui/sidebar";
import {
  Home,
  Bell,
  Briefcase,
  CalendarDays,
  Users,
  Magnet,
  Sparkles,
  FolderOpen,
  Wallet,
  Zap,
  BarChart3,
  Disc3,
  MapPin,
  Boxes,
  LayoutTemplate,
  DollarSign,
  KeyRound,
  Music2,
  Settings,
  CalendarClock,
  ClipboardList,
  LifeBuoy,
  ArrowLeft
} from "lucide-react";

export function AdminSidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

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

  const groups: SidebarNavGroup[] = [
    {
      items: [
        { href: "/admin", label: "Home", icon: Home },
        { href: "/admin/notifications", label: "Notifications", icon: Bell, badge: unreadCount },
        { href: "/admin/calendar", label: "Calendar", icon: CalendarDays }
      ]
    },
    {
      label: "Workspace",
      items: [
        { href: "/admin/events", label: "Projects", icon: Briefcase },
        { href: "/admin/clients", label: "Contacts", icon: Users },
        { href: "/admin/leads", label: "Lead Capture", icon: Magnet }
      ]
    },
    {
      label: "Business",
      items: [
        { href: "/admin/finance", label: "Finance", icon: Wallet },
        { href: "/admin/reports", label: "Reports", icon: BarChart3 }
      ]
    },
    {
      label: "Communication",
      items: [{ href: "/admin/files", label: "Library", icon: FolderOpen }]
    },
    {
      label: "Team",
      items: [
        { href: "/admin/djs", label: "DJs", icon: Disc3 },
        { href: "/admin/equipment", label: "Equipment", icon: Boxes }
      ]
    },
    {
      label: "Tools",
      items: [
        { href: "/admin/crate-requests", label: "Crate Requests", icon: Music2 },
        { href: "/admin/crate-templates", label: "Crate Templates", icon: LayoutTemplate },
        { href: "/admin/monetization", label: "Monetization", icon: DollarSign },
        { href: "/admin/venues", label: "Venues", icon: MapPin },
        { href: "/admin/services", label: "Services", icon: Sparkles },
        { href: "/admin/tools/scheduler", label: "Scheduler", icon: CalendarClock },
        { href: "/admin/questionnaires", label: "Questionnaire Builder", icon: ClipboardList },
        { href: "/admin/automations", label: "Automations", icon: Zap },
        { href: "/admin/invite-codes", label: "Invite Codes", icon: KeyRound }
      ]
    },
    {
      label: "System",
      items: [
        { href: "/admin/settings", label: "Settings", icon: Settings },
        { href: "/admin/resources", label: "Resources", icon: LifeBuoy }
      ]
    },
    {
      items: [
        {
          href: "https://digitalcratedjs.com/members",
          label: "DJ Portal",
          icon: ArrowLeft,
          external: true
        }
      ]
    }
  ];

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
