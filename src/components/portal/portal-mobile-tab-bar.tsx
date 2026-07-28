"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, FolderOpen, Sparkles, Wallet } from "lucide-react";

export function PortalMobileTabBar({ primaryEventId }: { primaryEventId: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");
  const onEventPage = pathname.startsWith("/portal/events");

  const items = [
    { href: "/portal", label: "Home", icon: Home, tab: null, disabled: false },
    { href: primaryEventId ? `/portal/events/${primaryEventId}?tab=files` : "#", label: "Files", icon: FolderOpen, tab: "files", disabled: !primaryEventId },
    { href: primaryEventId ? `/portal/events/${primaryEventId}?tab=services` : "#", label: "Services", icon: Sparkles, tab: "services", disabled: !primaryEventId },
    { href: primaryEventId ? `/portal/events/${primaryEventId}?tab=payment` : "#", label: "Payments", icon: Wallet, tab: "payment", disabled: !primaryEventId }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-black/10 bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      {items.map(({ href, label, icon: Icon, tab, disabled }, i) => {
        const active = tab === null ? pathname === "/portal" : onEventPage && currentTab === tab;
        return (
          <Link
            key={label}
            href={href}
            aria-disabled={disabled}
            style={{ "--menu-fade-delay": `${i * 40}ms` } as React.CSSProperties}
            className={cn(
              "menu-fade-item flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium",
              disabled ? "pointer-events-none text-muted/40" : active ? "text-gold" : "text-muted"
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
