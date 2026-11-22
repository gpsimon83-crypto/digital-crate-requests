"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarDays, Image as ImageIcon, Inbox, UserPlus, Wallet } from "lucide-react";
import { useDashLayout } from "@/lib/dashboard-layout";
import { fillTrend, upcomingEvents, type DashEvent, type Period } from "@/lib/dashboard/overview";
import { calendarItems, djActionGroups, djActivity, djMetrics, payoutTrend, type DjPayout, type DjResidency, type DjTask } from "@/lib/dj/overview";
import { DJ_LINKS } from "@/lib/dj/links";
import { DJ_NAV_GROUPS } from "@/lib/dj-nav";
import { money } from "@/lib/format";
import type { MyGig } from "@/lib/data/my-gigs";
import { CommandLayout, CommandTopNav, StudioLayout, type DashboardData } from "@/components/dashboard/overview/layouts";
import { DashLinksProvider, type BannerPhotos, type ChartCopy, type Focal, type MetricItem, type QuickAction } from "@/components/dashboard/overview/widgets";
import { MyGigs } from "@/components/dashboard/overview/my-gigs";

const QUICK: QuickAction[] = [
  { href: "/dj-dashboard/leads?new=1", label: "Add a lead", icon: UserPlus, primary: true },
  { href: "/dj-dashboard/calendar", label: "My calendar", icon: CalendarDays },
  { href: "/dj-dashboard/flyers", label: "Make a flyer", icon: ImageIcon }
];

const CHART: ChartCopy = {
  title: "Earnings",
  a: "Pending",
  b: "Paid",
  empty: "No payouts",
  emptyBody: "Your pay for each gig shows here once the office adds it.",
  footnote: (
    <>
      <b className="font-semibold">Paid</b> is money sent to you, by the date it was paid. <b className="font-semibold">Pending</b> is pay the office has added for a gig and not sent yet, by the date it was added.
    </>
  )
};

const TOP_LINKS = [
  { href: "/dj-dashboard", label: "Home" },
  { href: "/dj-dashboard/bookings", label: "Bookings" },
  { href: "/dj-dashboard/leads", label: "Leads" },
  { href: "/dj-dashboard/calendar", label: "Calendar" },
  { href: "/dj-dashboard/payouts", label: "Payouts" },
  { href: "/dj-dashboard/flyers", label: "Flyers" }
];

const tod = (d: Date) => (d.getHours() < 12 ? "Good morning" : d.getHours() < 18 ? "Good afternoon" : "Good evening");
const focal = (f: Focal | null | undefined): Focal => (f && Number.isFinite(f.x) && Number.isFinite(f.y) ? f : { x: 50, y: 50 });

/**
 * The DJ portal home, in the same two layouts as the admin home (and the
 * same site themes): greeting and quick actions, four numbers, what needs
 * doing, earnings, My gigs, upcoming bookings, the month and activity.
 */
export function DjOverview({ djId, djName }: { djId: string; djName: string }) {
  const layout = useDashLayout();
  const [now] = useState(() => new Date());
  const [events, setEvents] = useState<DashEvent[] | null>(null);
  const [eventsError, setEventsError] = useState(false);
  const [payouts, setPayouts] = useState<DjPayout[] | null>(null);
  const [payoutsError, setPayoutsError] = useState(false);
  const [residency, setResidency] = useState<DjResidency>({ awaiting: [], upcoming: [], recapDue: [] });
  const [tasks, setTasks] = useState<DjTask[]>([]);
  const [gigs, setGigs] = useState<{ gigs: MyGig[]; calendarConnected: boolean; loading: boolean; error: boolean }>({ gigs: [], calendarConnected: true, loading: true, error: false });
  const [branding, setBranding] = useState<{ adminHero?: { imageUrl: string | null }; adminDashboard?: { weddingFocal?: Focal | null; clubUrl?: string | null; clubFocal?: Focal | null } | null } | null>(null);
  const [period, setPeriod] = useState<Period>("last_6_months");

  useEffect(() => {
    fetch("/api/admin/events")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const mine: DashEvent[] = (d.events ?? []).filter((e: DashEvent & { dj_id: string | null }) => e.dj_id === djId);
        setEvents(mine);
        // Open tasks on the next few confirmed bookings (same as the portal did before).
        const next = upcomingEvents(mine, now)
          .filter((e) => e.status === "confirmed")
          .slice(0, 5);
        Promise.all(next.map((e) => fetch(`/api/events/${e.id}/tasks`).then((r) => (r.ok ? r.json() : { tasks: [] })).then((x) => (x.tasks ?? []) as (DjTask & { completed_at: string | null })[]).catch(() => [])))
          .then((lists) => setTasks(lists.flat().filter((t) => !t.completed_at)))
          .catch(() => {});
      })
      .catch(() => {
        setEventsError(true);
        setEvents([]);
      });
    fetch("/api/dj/payouts")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setPayouts(d.payouts ?? []))
      .catch(() => {
        setPayoutsError(true);
        setPayouts([]);
      });
    fetch("/api/dj/gigs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setResidency({ awaiting: d.awaiting ?? [], upcoming: d.upcoming ?? [], recapDue: d.recapDue ?? [] }))
      .catch(() => {});
    fetch("/api/me/gigs")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((g) => setGigs({ gigs: g.gigs ?? [], calendarConnected: !!g.calendarConnected, loading: false, error: false }))
      .catch(() => setGigs({ gigs: [], calendarConnected: true, loading: false, error: true }));
    fetch("/api/branding")
      .then((r) => (r.ok ? r.json() : null))
      .then(setBranding)
      .catch(() => {});
  }, [djId, now]);

  // Midnight Command brings its own top menu: hide the side rail on this page only.
  useEffect(() => {
    const el = document.documentElement;
    if (layout === "command") el.dataset.dashLayout = "command";
    else delete el.dataset.dashLayout;
    return () => {
      delete el.dataset.dashLayout;
    };
  }, [layout]);

  const loading = events === null;
  const data: DashboardData = useMemo(() => {
    const ev = events ?? [];
    const pay = payouts ?? [];
    const m = djMetrics(gigs.gigs, ev, pay, now);
    const v = (n: number, f: (n: number) => string = String) => (loading ? "…" : eventsError ? "—" : f(n));
    const metricItems: MetricItem[] = [
      { key: "30", icon: CalendarClock, value: gigs.loading ? "…" : String(m.next30), label: "Gigs, next 30 days", help: "Bookings and calendar nights with your name, not counting open leads", href: "/dj-dashboard/calendar" },
      { key: "7", icon: CalendarDays, value: gigs.loading ? "…" : String(m.thisWeek), label: "This week", help: "Gigs in the next 7 days", href: "/dj-dashboard/calendar" },
      { key: "leads", icon: Inbox, value: v(m.openLeads), label: "Open leads", help: "Client inquiries assigned to you", href: "/dj-dashboard/leads" },
      {
        key: "pay",
        icon: Wallet,
        value: payouts === null ? "…" : payoutsError ? "—" : money(m.pendingCents),
        label: "Payouts pending",
        help: "Pay added for your gigs and not sent yet",
        sub: payouts && !payoutsError ? `${money(m.paidThisYearCents)} paid to you this year` : undefined,
        href: "/dj-dashboard/payouts"
      }
    ];
    const photos: BannerPhotos = {
      wedding: { url: branding?.adminHero?.imageUrl ?? null, focal: focal(branding?.adminDashboard?.weddingFocal) },
      club: { url: branding?.adminDashboard?.clubUrl ?? null, focal: focal(branding?.adminDashboard?.clubFocal) }
    };
    return {
      greeting: `${tod(now)}, ${djName}`,
      dateLine: now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
      hero: { heading: null, subheading: null },
      photos,
      metrics: null,
      groups: loading || eventsError ? [] : djActionGroups(ev, residency, tasks, now),
      upcoming: upcomingEvents(ev, now),
      calendarEvents: calendarItems(gigs.gigs, ev),
      activity: djActivity(ev, pay),
      trend: payouts === null ? null : fillTrend(period, now, payoutTrend(pay)),
      types: null,
      period,
      onPeriod: setPeriod,
      loading,
      error: eventsError,
      reportLoading: payouts === null,
      reportError: payoutsError,
      now,
      myGigs: null,
      custom: {
        metricItems,
        quickActions: QUICK,
        chartCopy: CHART,
        sidePanel: <MyGigs layout={layout ?? "studio"} s={{ djName, ...gigs }} />,
        topNav: <CommandTopNav links={TOP_LINKS} groups={DJ_NAV_GROUPS} home={{ href: "/dj-dashboard", label: "DJ Portal" }} search={false} notificationsHref="/dj-dashboard/notifications" />,
        upcomingTitle: "Upcoming bookings",
        hideDjColumn: true,
        eyebrow: "Digital Crate DJs · DJ Portal",
        studioSub: "Here's what's on deck.",
        commandSub: "Your gigs, leads and pay in one place."
      }
    };
  }, [events, eventsError, payouts, payoutsError, residency, tasks, gigs, branding, period, now, djName, loading, layout]);

  if (!layout) return <div className="min-h-[60vh]" aria-busy="true" />;
  return <DashLinksProvider value={DJ_LINKS}>{layout === "command" ? <CommandLayout d={data} /> : <StudioLayout d={data} />}</DashLinksProvider>;
}
