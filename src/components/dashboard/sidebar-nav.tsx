"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/logo";
import {
  LayoutDashboard,
  ListMusic,
  Radio,
  Activity,
  CreditCard,
  Users,
  Disc3,
  BarChart3,
  Settings,
} from "lucide-react";

export function SidebarNav() {
  const pathname = usePathname();
  const params = useParams<{ eventId: string }>();
  const base = `/dj-dashboard/${params.eventId}`;

  const items = [
    { href: base, label: "Overview", icon: LayoutDashboard },
    { href: `${base}/queue`, label: "Live Queue", icon: ListMusic },
    { href: `${base}/feed`, label: "Live Feed", icon: Radio },
    { href: `${base}/pulse`, label: "Party Pulse", icon: Activity },
    { href: `${base}/payments`, label: "Payments", icon: CreditCard },
    { href: `${base}/crm`, label: "Guest CRM", icon: Users },
    { href: `${base}/crate-match`, label: "Crate Match", icon: Disc3 },
    { href: `${base}/analytics`, label: "Analytics", icon: BarChart3 },
    { href: `${base}/settings`, label: "Settings", icon: Settings },
  ];

  return (
    <nav className="hidden w-60 shrink-0 flex-col gap-1 border-r border-white/10 bg-panel/60 p-4 md:flex">
      <div className="mb-4 flex items-center gap-2 px-2">
        <Logo variant="icon" color="gold" size={26} />
        <div>
          <p className="text-[10px] uppercase tracking-[2px] text-muted">Digital Crate DJs</p>
          <p className="text-sm font-semibold">DJ Dashboard</p>
        </div>
      </div>
      {items.map(({ href, label, icon: Icon }) => {
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
