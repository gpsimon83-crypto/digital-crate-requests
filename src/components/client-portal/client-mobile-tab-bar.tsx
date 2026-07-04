"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, CalendarClock, ListMusic, CreditCard, FileText } from "lucide-react";

export function ClientMobileTabBar() {
  const pathname = usePathname();
  const params = useParams<{ eventId: string }>();
  const base = `/client-portal/${params.eventId}`;

  const items = [
    { href: base, label: "Details", icon: LayoutDashboard },
    { href: `${base}/timeline`, label: "Timeline", icon: CalendarClock },
    { href: `${base}/song-lists`, label: "Songs", icon: ListMusic },
    { href: `${base}/payments`, label: "Pay", icon: CreditCard },
    { href: `${base}/contracts`, label: "Docs", icon: FileText },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 flex border-t border-white/10 bg-panel/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium min-h-[56px] justify-center",
              active ? "text-neon-cyan" : "text-muted"
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
