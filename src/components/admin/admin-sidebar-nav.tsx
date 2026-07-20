"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/logo";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, CalendarDays, Disc3, MapPin, KeyRound, Settings, ListMusic, BarChart3, DollarSign, LogOut, LayoutTemplate, ArrowLeft } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/djs", label: "DJs", icon: Disc3 },
  { href: "/admin/venues", label: "Venues", icon: MapPin },
  { href: "/admin/crate-templates", label: "Crate Templates", icon: LayoutTemplate },
  { href: "/admin/monetization", label: "Monetization", icon: DollarSign },
  { href: "/admin/invite-codes", label: "Invite Codes", icon: KeyRound },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebarNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/dj-dashboard/login");
    router.refresh();
  }

  return (
    <nav className="hidden w-60 shrink-0 flex-col gap-1 border-r border-white/10 bg-panel/60 p-4 md:flex">
      <div className="mb-4 flex items-center gap-2 px-2">
        <Logo variant="icon" color="white" size={26} />
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

      <div className="my-2 h-px bg-white/10" />

      <a
        href="https://digitalcratedjs.com/members"
        className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground"
      >
        <ArrowLeft size={18} />
        DJ Portal
      </a>
      <Link
        href="/dj-dashboard/bookings"
        className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground"
      >
        <ListMusic size={18} />
        All Bookings
      </Link>
      <Link
        href="/analytics"
        className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground"
      >
        <BarChart3 size={18} />
        Analytics
      </Link>
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground"
      >
        <LogOut size={18} />
        Sign Out
      </button>
    </nav>
  );
}
