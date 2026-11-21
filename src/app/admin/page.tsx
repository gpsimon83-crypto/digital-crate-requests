"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDashLayout } from "@/lib/dashboard-layout";
import {
  actionGroups,
  fillTrend,
  isPeriod,
  metrics as computeMetrics,
  recentActivity,
  typeBreakdown,
  upcomingEvents,
  type DashEvent,
  type DashPayment,
  type Period,
  type TrendRow,
  type TypeRow
} from "@/lib/dashboard/overview";
import { CommandLayout, StudioLayout, type DashboardData } from "@/components/dashboard/overview/layouts";
import type { BannerPhotos, Focal } from "@/components/dashboard/overview/widgets";
import type { MyGigsState } from "@/components/dashboard/overview/my-gigs";

interface Me {
  user: { email: string | null };
  dj: { id: string; display_name: string } | null;
}

interface Branding {
  adminHero?: { imageUrl: string | null; heading: string | null; subheading: string | null };
  adminDashboard?: { weddingFocal?: Focal | null; clubUrl?: string | null; clubFocal?: Focal | null };
}

function greetingName(me: Me | null) {
  if (!me) return "";
  if (me.dj?.display_name) return me.dj.display_name;
  const local = me.user.email?.split("@")[0] ?? "";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function timeOfDayGreeting(d: Date) {
  const hour = d.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const focal = (f: Focal | null | undefined, d: Focal): Focal => (f && Number.isFinite(f.x) && Number.isFinite(f.y) ? f : d);

/**
 * Admin home. Loads the dashboard's records once and hands the same numbers
 * to whichever layout is picked (Modern Studio or Midnight Command); the
 * reporting period lives in the address (?range=), so switching layouts
 * keeps it.
 */
function AdminOverview() {
  const layout = useDashLayout();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rangeParam = params.get("range");
  const period: Period = isPeriod(rangeParam) ? rangeParam : "last_6_months";

  const [me, setMe] = useState<Me | null>(null);
  const [events, setEvents] = useState<DashEvent[] | null>(null);
  const [payments, setPayments] = useState<DashPayment[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [report, setReport] = useState<{ period: Period; trend: TrendRow[]; types: TypeRow[] } | null>(null);
  const [reportError, setReportError] = useState<Period | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [now] = useState(() => new Date());
  const [gigs, setGigs] = useState<Omit<MyGigsState, "djName"> | null>(null);

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setBranding(data))
      .catch(() => {});
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setMe(data);
        // An admin who also DJs (login linked to their DJ profile) sees their own gigs too.
        if (!data.dj) return;
        setGigs({ gigs: [], calendarConnected: true, loading: true, error: false });
        fetch("/api/me/gigs")
          .then(async (r) => {
            const g = await r.json().catch(() => null);
            if (!r.ok || !g) throw new Error("gigs");
            setGigs({ gigs: g.gigs ?? [], calendarConnected: !!g.calendarConnected, loading: false, error: false });
          })
          .catch(() => setGigs({ gigs: [], calendarConnected: true, loading: false, error: true }));
      })
      .catch(() => {});
    Promise.all([fetch("/api/admin/events"), fetch("/api/admin/payments")])
      .then(async ([e, p]) => {
        const ej = await e.json().catch(() => ({}));
        const pj = await p.json().catch(() => ({}));
        if (!e.ok) throw new Error(ej.error || "events");
        setEvents(ej.events ?? []);
        // Payments only feed "collected" and activity; if they fail, the rest still shows.
        setPayments(p.ok ? (pj.payments ?? []) : []);
      })
      .catch(() => {
        setLoadError(true);
        setEvents([]);
        setPayments([]);
      });
  }, []);

  useEffect(() => {
    let live = true;
    fetch(`/api/admin/reports?range=${period}`)
      .then(async (r) => {
        const data = r.ok ? await r.json() : null;
        if (!live) return;
        if (!data?.summary) {
          setReportError(period);
          return;
        }
        setReportError(null);
        setReport({ period, trend: data.summary.revenueTrend ?? [], types: data.summary.eventTypes ?? [] });
      })
      .catch(() => live && setReportError(period));
    return () => {
      live = false;
    };
  }, [period]);

  // Midnight Command brings its own top menu: hide the side rail on this page only.
  useEffect(() => {
    const el = document.documentElement;
    if (layout === "command") el.dataset.dashLayout = "command";
    else delete el.dataset.dashLayout;
    return () => {
      delete el.dataset.dashLayout;
    };
  }, [layout]);

  const setPeriod = (p: Period) => {
    const q = new URLSearchParams(params.toString());
    if (p === "last_6_months") q.delete("range");
    else q.set("range", p);
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const loading = events === null;
  const data: DashboardData = useMemo(() => {
    const ev = events ?? [];
    const pay = payments ?? [];
    const photos: BannerPhotos = {
      wedding: { url: branding?.adminHero?.imageUrl ?? null, focal: focal(branding?.adminDashboard?.weddingFocal, { x: 50, y: 50 }) },
      club: { url: branding?.adminDashboard?.clubUrl ?? null, focal: focal(branding?.adminDashboard?.clubFocal, { x: 50, y: 50 }) }
    };
    const reportReady = report?.period === period;
    return {
      greeting: `${timeOfDayGreeting(now)}${me ? `, ${greetingName(me)}` : ""}`,
      dateLine: now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
      hero: { heading: branding?.adminHero?.heading ?? null, subheading: branding?.adminHero?.subheading ?? null },
      photos,
      metrics: loading || loadError ? null : computeMetrics(ev, pay, now),
      groups: loading || loadError ? [] : actionGroups(ev, now),
      upcoming: upcomingEvents(ev, now),
      calendarEvents: ev,
      activity: recentActivity(ev, pay),
      trend: reportReady ? fillTrend(period, now, report.trend) : null,
      types: reportReady ? typeBreakdown(report.types) : null,
      period,
      onPeriod: setPeriod,
      loading,
      error: loadError,
      reportLoading: !reportReady && reportError !== period,
      reportError: reportError === period,
      now,
      myGigs: me?.dj && gigs ? { djName: me.dj.display_name, ...gigs } : null
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, payments, loadError, report, reportError, period, branding, me, now, loading, gigs]);

  // Until the browser says which layout was picked, show a quiet placeholder (never the wrong layout).
  if (!layout) return <div className="min-h-[60vh]" aria-busy="true" />;
  return layout === "command" ? <CommandLayout d={data} /> : <StudioLayout d={data} />;
}

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
      <AdminOverview />
    </Suspense>
  );
}
