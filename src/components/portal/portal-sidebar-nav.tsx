"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, type SidebarNavItem } from "@/components/ui/sidebar";
import { Home, FolderOpen, Sparkles, Wallet } from "lucide-react";

export function PortalSidebarNav({ primaryEventId }: { primaryEventId: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentTab = searchParams.get("tab");
  const onEventPage = pathname.startsWith("/portal/events");

  const items: SidebarNavItem[] = [
    { href: "/portal", label: "Home", icon: Home, isActive: (p) => p === "/portal" },
    {
      href: primaryEventId ? `/portal/events/${primaryEventId}?tab=files` : "#",
      label: "Files",
      icon: FolderOpen,
      disabled: !primaryEventId,
      isActive: () => onEventPage && currentTab === "files"
    },
    {
      href: primaryEventId ? `/portal/events/${primaryEventId}?tab=services` : "#",
      label: "Services",
      icon: Sparkles,
      disabled: !primaryEventId,
      isActive: () => onEventPage && currentTab === "services"
    },
    {
      href: primaryEventId ? `/portal/events/${primaryEventId}?tab=payment` : "#",
      label: "Payments",
      icon: Wallet,
      disabled: !primaryEventId,
      isActive: () => onEventPage && currentTab === "payment"
    }
  ];

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <Sidebar
      brandHref="/portal"
      brandTitle="Events Portal"
      brandSubtitle="Digital Crate DJs"
      groups={[{ items }]}
      onSignOut={handleSignOut}
      variant="rail"
    />
  );
}
