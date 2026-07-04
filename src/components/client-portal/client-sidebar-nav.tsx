"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/logo";
import { LayoutDashboard, CalendarClock, ListMusic, Sliders, CreditCard, FileText, ClipboardList } from "lucide-react";

export function ClientSidebarNav() {
  const pathname = usePathname();
  const params = useParams<{ eventId: string }>();
  const base = `/client-portal/${params.eventId}`;

  const items = [
    { href: base, label: "Event Details", icon: LayoutDashboard },
    { href: `${base}/timeline`, label: "Timeline", icon: CalendarClock },
    { href: `${base}/song-lists`, label: "Song Lists", icon: ListMusic },
    { href: `${base}/guest-settings`, label: "Guest Requests", icon: Sliders },
    { href: `${base}/payments`, label: "Payments", icon: CreditCard },
    { href: `${base}/contracts`, label: "Contracts", icon: FileText },
    { href: `${base}/planning`, label: "Planning Forms", icon: ClipboardList },
  ];

  return (
    <nav className="hidden w-60 shrink-0 flex-col gap-1 border-r border-white/10 bg-panel/60 p-4 md:flex">
      <div className="mb-4 flex items-center gap-2 px-2">
        <Logo variant="icon" color="gold" size={26} />
        <div>
          <p className="text-[10px] uppercase tracking-[2px] text-muted">Digital Crate DJs</p>
          <p className="text-sm font-semibold">Client Portal</p>
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
