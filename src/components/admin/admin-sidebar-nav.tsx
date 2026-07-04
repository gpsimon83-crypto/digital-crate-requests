"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/logo";
import { LayoutDashboard, Disc3, MapPin, KeyRound, Settings } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/djs", label: "DJs", icon: Disc3 },
  { href: "/admin/venues", label: "Venues", icon: MapPin },
  { href: "/admin/invite-codes", label: "Invite Codes", icon: KeyRound },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden w-60 shrink-0 flex-col gap-1 border-r border-white/10 bg-panel/60 p-4 md:flex">
      <div className="mb-4 flex items-center gap-2 px-2">
        <Logo variant="icon" color="gold" size={26} />
        <div>
          <p className="text-[10px] uppercase tracking-[2px] text-muted">Digital Crate DJs</p>
          <p className="text-sm font-semibold">Admin</p>
        </div>
      </div>
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
              active ? "sidebar-active" : "text-muted hover:bg-white/5 hover:text-foreground"
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
