"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, LayoutGrid, LogOut, Search } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { ADMIN_NAV_GROUPS } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";
import { DASH_LAYOUTS, setDashLayout, type DashLayout } from "@/lib/dashboard-layout";
import { useAdminSignOut, useUnreadNotifications } from "@/components/admin/admin-sidebar-nav";
import { SiteThemeList } from "@/components/admin/site-theme";
import {
  ActionHub,
  BannerPhoto,
  EventTypeBars,
  FALLBACK_PHOTOS,
  FOCUS,
  MetricCards,
  MiniCalendar,
  Panel,
  QuickActions,
  RecentActivity,
  RevenueChart,
  StudioBanner,
  UpcomingEvents,
  type BannerPhotos
} from "./widgets";
import { MyGigs, type MyGigsState } from "./my-gigs";
import type { ActionGroup, ActivityItem, DashEvent, Metrics, Period, TrendRow, TypeRow } from "@/lib/dashboard/overview";

/** Everything both layouts show: the same data, worked out once by the page. */
export interface DashboardData {
  greeting: string;
  dateLine: string;
  hero: { heading: string | null; subheading: string | null };
  photos: BannerPhotos;
  metrics: Metrics | null;
  groups: ActionGroup[];
  upcoming: DashEvent[];
  calendarEvents: DashEvent[];
  activity: ActivityItem[];
  trend: TrendRow[] | null;
  types: { total: number; rows: (TypeRow & { share: number })[] } | null;
  period: Period;
  onPeriod: (p: Period) => void;
  loading: boolean;
  error: boolean;
  reportLoading: boolean;
  reportError: boolean;
  now: Date;
  /** Only when the signed-in admin's login is linked to a DJ profile. */
  myGigs: MyGigsState | null;
}

/** Modern Studio / Midnight Command switch (arrangement only; colors follow the site theme). */
export function LayoutSwitch({ layout, className }: { layout: DashLayout; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Dashboard layout" className={cn("inline-flex rounded-[10px] border border-border bg-card/70 p-0.5 text-xs backdrop-blur", className)} data-tour="dash-layout">
      {DASH_LAYOUTS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={layout === l.id}
          title={l.hint}
          onClick={() => setDashLayout(l.id)}
          className={cn("rounded-[8px] px-2.5 py-1.5 font-semibold transition-colors", FOCUS, layout === l.id ? "bg-gold text-[var(--on-gold,#1a140a)]" : "text-muted hover:text-foreground")}
        >
          {l.name}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Modern Studio ---------------- */

export function StudioLayout({ d }: { d: DashboardData }) {
  return (
    // Phone: one column in a sensible order. Desktop: action column on the left, photos, numbers and charts on the right.
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:grid lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] lg:items-start lg:gap-5 lg:p-7">
      <div className="contents lg:flex lg:flex-col lg:gap-5">
        <Panel layout="studio" className="order-1 lg:order-none" aria-labelledby="dash-greet">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-xs text-muted">{d.dateLine}</p>
            <LayoutSwitch layout="studio" />
          </div>
          <h1 id="dash-greet" className="mt-2 font-display text-[32px] font-light leading-[1.05] sm:text-[36px]">
            {d.greeting}
          </h1>
          <p className="mt-1.5 text-sm text-muted">{d.hero.subheading ?? "Here's what needs your attention today."}</p>
          <QuickActions layout="studio" className="mt-4" />
        </Panel>
        <ActionHub layout="studio" groups={d.groups} loading={d.loading} error={d.error} className="order-4 lg:order-none" />
        {d.myGigs && (
          <div className="order-4 lg:order-none">
            <MyGigs layout="studio" s={d.myGigs} />
          </div>
        )}
      </div>
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
        <div className="order-2 lg:order-none">
          <StudioBanner photos={d.photos} />
        </div>
        <div className="order-3 lg:order-none">
          <MetricCards layout="studio" m={d.metrics} loading={d.loading} error={d.error} />
        </div>
        <div className="order-7 grid gap-4 lg:order-none xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:gap-5">
          <RevenueChart layout="studio" trend={d.trend} loading={d.reportLoading} error={d.reportError} period={d.period} onPeriod={d.onPeriod} />
          <EventTypeBars layout="studio" types={d.types} loading={d.reportLoading} error={d.reportError} period={d.period} />
        </div>
        <div className="order-9 lg:order-none">
          <RecentActivity layout="studio" items={d.activity} loading={d.loading} error={d.error} now={d.now} />
        </div>
      </div>
      <div className="order-5 lg:col-span-2 lg:order-none">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-5">
          <UpcomingEvents layout="studio" events={d.upcoming} loading={d.loading} error={d.error} />
          <MiniCalendar layout="studio" events={d.calendarEvents} loading={d.loading} error={d.error} now={d.now} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Midnight Command ---------------- */

const TOP_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/events", label: "Projects" },
  { href: "/admin/events?stage=inquiries", label: "Inquiries" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/finance", label: "Finance" },
  { href: "/admin/reports", label: "Reports" }
];

/**
 * Top menu for Midnight Command (desktop). It stands in for the side rail on
 * this page, so it keeps every destination: the main links up top, the rest
 * (and Theme, Sign Out) under "All pages". Phones keep the bottom tab bar.
 */
export function CommandTopNav() {
  const pathname = usePathname();
  const unread = useUnreadNotifications();
  const signOut = useAdminSignOut();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <header className="sticky top-0 z-30 hidden border-b border-border bg-[color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur md:block" data-tour="dash-topnav">
      <div className="flex h-14 items-center gap-4 px-5 lg:px-7">
        <Link href="/admin" className={cn("flex shrink-0 items-center gap-2", FOCUS)} aria-label="Admin home">
          <Logo variant="icon" brand="crates-djs" size={28} />
          <span className="hidden text-sm font-semibold lg:inline">Admin</span>
        </Link>
        <nav aria-label="Main" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
          {TOP_LINKS.map((l) => {
            const active = l.href === "/admin" ? pathname === "/admin" : false;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn("relative whitespace-nowrap rounded-[8px] px-3 py-2 text-sm font-medium transition-colors", FOCUS, active ? "text-gold" : "text-muted hover:text-foreground")}
              >
                {l.label}
                {active && <span className="absolute inset-x-3 -bottom-[9px] h-[2px] rounded-full bg-gold" aria-hidden />}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            // The global search lives with the side menu (Ctrl/⌘ K); this opens the same search.
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true, bubbles: true }))}
            className={cn("flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-black/5 hover:text-foreground", FOCUS)}
            aria-label="Search (Ctrl or ⌘ K)"
          >
            <Search size={18} />
          </button>
          <Link href="/admin/notifications" className={cn("relative flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-black/5 hover:text-foreground", FOCUS)} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
            <Bell size={18} />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-gold" aria-hidden />}
          </Link>
          <div ref={ref} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={cn("flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-medium hover:border-gold", FOCUS)}
            >
              <LayoutGrid size={15} /> All pages <ChevronDown size={14} />
            </button>
            {open && (
              <div role="menu" className="absolute right-0 top-full z-50 mt-2 max-h-[75vh] w-[min(560px,90vw)] overflow-y-auto rounded-[14px] border border-border bg-card p-3 text-foreground shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
                <div className="grid gap-3 sm:grid-cols-2">
                  {ADMIN_NAV_GROUPS.map((g, i) => (
                    <div key={g.label ?? i}>
                      {g.label && <p className="px-2 pb-1 text-[10px] uppercase tracking-[2px] text-muted">{g.label}</p>}
                      {g.items.map((it) => (
                        <Link
                          key={it.href}
                          role="menuitem"
                          href={it.href}
                          target={it.external ? "_blank" : undefined}
                          rel={it.external ? "noopener noreferrer" : undefined}
                          onClick={() => setOpen(false)}
                          className={cn("flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-sm hover:bg-black/5", FOCUS)}
                        >
                          <it.icon size={15} className="shrink-0 text-muted" aria-hidden />
                          {it.label}
                          {it.external && <span className="text-muted">↗</span>}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                  <div>
                    <p className="px-2 pb-1 text-[10px] uppercase tracking-[2px] text-muted">Site theme</p>
                    <SiteThemeList compact />
                  </div>
                  <div className="flex flex-col justify-end">
                    <button type="button" onClick={signOut} className={cn("flex items-center gap-2.5 rounded-[8px] px-2 py-2 text-left text-sm text-muted hover:bg-black/5 hover:text-foreground", FOCUS)}>
                      <LogOut size={15} aria-hidden /> Sign Out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function CommandLayout({ d }: { d: DashboardData }) {
  const photo = d.photos.wedding.url ?? FALLBACK_PHOTOS.wedding;
  const focal = d.photos.wedding.url ? d.photos.wedding.focal : { x: 70, y: 60 };
  return (
    <>
      <CommandTopNav />
      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:gap-5 lg:px-7 lg:py-6">
        {/* Hero: words and actions on the left, photo on the right, shaded only where the text sits. */}
        <section className="relative isolate overflow-hidden rounded-[20px] border border-border bg-card" aria-labelledby="dash-greet" data-tour="dash-banner">
          <div className="absolute inset-y-0 right-0 -z-10 w-full sm:w-[68%]" aria-hidden>
            <BannerPhoto src={photo} focal={focal} sizes="(min-width: 640px) 68vw, 100vw" priority />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--card)] via-[color-mix(in_srgb,var(--card)_55%,transparent)] to-transparent sm:via-[color-mix(in_srgb,var(--card)_25%,transparent)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_srgb,var(--card)_70%,transparent)] to-transparent sm:hidden" />
          </div>
          <div className="flex min-h-[210px] flex-col justify-center gap-1 p-5 sm:min-h-[232px] sm:p-7 sm:pr-[38%] lg:pr-[45%]">
            <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-start sm:gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[3px] text-muted">{d.hero.heading ?? "Digital Crate DJs CRM"}</p>
              <LayoutSwitch layout="command" />
            </div>
            <h1 id="dash-greet" className="mt-1 font-display text-[34px] font-light leading-[1.05] sm:text-[42px]">
              {d.greeting}
            </h1>
            <p className="text-sm text-muted sm:text-base">
              {d.hero.subheading ?? "Your event business command center."} <span className="whitespace-nowrap">{d.dateLine}</span>
            </p>
            <QuickActions layout="command" className="mt-4" />
          </div>
        </section>
        <MetricCards layout="command" m={d.metrics} loading={d.loading} error={d.error} />
        {/* Phone: actions and upcoming events first, charts after. Desktop: the reference arrangement. */}
        <div className="contents lg:grid lg:grid-cols-2 lg:gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
          <div className="order-4 min-w-0 lg:order-none lg:[&>*]:h-full">
            <RevenueChart layout="command" trend={d.trend} loading={d.reportLoading} error={d.reportError} period={d.period} onPeriod={d.onPeriod} />
          </div>
          <div className="order-5 min-w-0 lg:order-none lg:[&>*]:h-full">
            <EventTypeBars layout="command" types={d.types} loading={d.reportLoading} error={d.reportError} period={d.period} />
          </div>
          <ActionHub layout="command" limit={3} groups={d.groups} loading={d.loading} error={d.error} className="order-1 lg:order-none lg:col-span-2 xl:col-span-1" />
        </div>
        <div className="contents lg:grid lg:grid-cols-[minmax(0,1.9fr)_minmax(300px,1fr)] lg:items-start lg:gap-5">
          <div className="order-2 min-w-0 lg:order-none">
            <UpcomingEvents layout="command" events={d.upcoming} loading={d.loading} error={d.error} />
          </div>
          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
            {d.myGigs && (
              <div className="order-2 min-w-0 lg:order-none">
                <MyGigs layout="command" s={d.myGigs} />
              </div>
            )}
            <div className="order-3 min-w-0 lg:order-none">
              <MiniCalendar layout="command" events={d.calendarEvents} loading={d.loading} error={d.error} now={d.now} />
            </div>
            <div className="order-6 min-w-0 lg:order-none">
              <RecentActivity layout="command" items={d.activity} loading={d.loading} error={d.error} now={d.now} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
