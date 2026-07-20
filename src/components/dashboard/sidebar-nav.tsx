"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/logo";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import {
  LayoutDashboard,
  ListMusic,
  Radio,
  Activity,
  CreditCard,
  Users,
  Settings,
  ChevronsUpDown,
  ArrowLeft,
} from "lucide-react";
import { isStaffRole } from "@/lib/roles";

export function SidebarNav() {
  const pathname = usePathname();
  const params = useParams<{ eventId: string }>();
  const base = `/dj-dashboard/${params.eventId}`;
  const [djName, setDjName] = useState<string>("Digital Crate DJs");
  const [djPhoto, setDjPhoto] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        const name = data?.dj?.display_name || (isStaffRole(data?.user?.role) ? "Admin" : null);
        if (name) setDjName(name);
        if (data?.dj?.photo_url) setDjPhoto(data.dj.photo_url);
      })
      .catch(() => {});
  }, []);

  const items = [
    { href: base, label: "Overview", icon: LayoutDashboard },
    { href: `${base}/queue`, label: "Live Queue", icon: ListMusic },
    { href: `${base}/feed`, label: "Live Feed", icon: Radio },
    { href: `${base}/pulse`, label: "Party Pulse", icon: Activity },
    { href: `${base}/payments`, label: "Payments", icon: CreditCard },
    { href: `${base}/crm`, label: "Guest CRM", icon: Users },
    { href: `${base}/settings`, label: "Settings", icon: Settings },
  ];

  return (
    <nav className="hidden w-64 shrink-0 flex-col border-r border-black/8 bg-[linear-gradient(180deg,rgba(33,31,26,0.015),rgba(255,255,255,0)_30%),var(--background)] p-4 md:flex">
      <Link href="/dj-dashboard" className="mb-6 flex flex-col items-center gap-2 px-2 pt-2 pb-4 text-center">
        <span className="glow-ring">
          <Logo variant="icon" size={36} />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[3px] text-muted">Digital Crate DJs</p>
          <p className="gold-text-gradient text-lg font-extrabold tracking-tight">DJ Dashboard</p>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1">
        {items.map(({ href, label, icon: Icon }, i) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              style={{ "--menu-fade-delay": `${i * 40}ms` } as React.CSSProperties}
              className={cn(
                "menu-fade-item flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                active ? "sidebar-active" : "text-muted hover:bg-black/5 hover:text-foreground"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </div>

      <a
        href="https://digitalcratedjs.com/members"
        style={{ "--menu-fade-delay": `${items.length * 40}ms` } as React.CSSProperties}
        className="menu-fade-item flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-black/5 hover:text-foreground"
      >
        <ArrowLeft size={18} />
        DJ Portal
      </a>

      <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-black/8 bg-panel/70 px-3 py-2.5">
        <DjAvatar name={djName} photoUrl={djPhoto} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{djName}</p>
          <p className="truncate text-[11px] text-muted">Digital Crate DJs</p>
        </div>
        <ChevronsUpDown size={15} className="shrink-0 text-muted" />
      </div>
    </nav>
  );
}
