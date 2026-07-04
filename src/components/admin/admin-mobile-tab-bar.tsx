"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Disc3, MapPin, KeyRound, Settings } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/djs", label: "DJs", icon: Disc3 },
  { href: "/admin/venues", label: "Venues", icon: MapPin },
  { href: "/admin/invite-codes", label: "Codes", icon: KeyRound },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminMobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 flex border-t border-white/10 bg-panel/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] md:hidden">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium min-h-[56px] justify-center",
              active ? "text-gold" : "text-muted"
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
