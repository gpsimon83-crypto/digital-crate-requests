"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { EventTypeDonut } from "@/components/charts/event-type-donut";
import { cn } from "@/lib/utils";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
import { money, clientName } from "@/lib/format";
import {
  Magnet,
  FileText,
  CalendarClock,
  Sparkles,
  Plus,
  ChevronLeft,
  ChevronRight,
  UserX,
  DollarSign,
  Activity as ActivityIcon,
  Music2,
  Inbox
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface EventRow {
  id: string;
  title: string;
  status: string;
  event_type: string | null;
  starts_at: string | null;
  created_at: string;
  quoted_amount: number | null;
  final_amount: number | null;
  paid_cents: number;
  contract_status: "none" | "draft" | "sent" | "signed" | "void";
  wedding_music_plan_sent_at: string | null;
  djs: { display_name: string; photo_url: string | null } | null;
  venues: { name: string } | null;
  clients: { company_name: string | null; first_name: string | null; last_name: string | null } | null;
}

interface PaymentRow {
  id: string;
  amount_cents: number;
  paid_at: string | null;
  events: { title: string } | { title: string }[] | null;
}

interface Me {
  user: { email: string | null };
  dj: { display_name: string } | null;
}

interface PerformanceSummary {
  revenueTrend: { month: string; bookedCents: number; collectedCents: number }[];
  eventTypes: { type: string; count: number; revenueCents: number }[];
}

interface ActionItem {
  key: string;
  icon: LucideIcon;
  label: string;
  eventTitle: string;
  href: string;
  detail?: string;
}

const STATUS_DOT: Record<string, string> = {
  inquiry: "muted",
  pending_confirmation: "pending",
  confirmed: "approved",
  live: "played",
  ended: "approved",
  declined: "declined"
};

const STATUS_LABEL: Record<string, string> = {
  inquiry: "Inquiry",
  pending_confirmation: "Pending",
  confirmed: "Confirmed",
  live: "Live",
  ended: "Completed",
  declined: "Declined"
};

function greetingName(me: Me | null) {
  if (!me) return "";
  if (me.dj?.display_name) return me.dj.display_name;
  const local = me.user.email?.split("@")[0] ?? "";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function eventName(e: PaymentRow["events"]) {
  const row = Array.isArray(e) ? e[0] : e;
  return row?.title ?? "Event";
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function AdminOverviewPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [cursor, setCursor] = useState(() => new Date());
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null);

  useEffect(() => {
    fetch("/api/admin/reports?range=last_6_months")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPerformance(data?.summary ?? null))
      .catch(() => setPerformance(null));
  }, []);

  useEffect(() => {
    async function load() {
      const [meRes, eventsRes, paymentsRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/admin/events"),
        fetch("/api/admin/payments")
      ]);
      if (meRes.ok) setMe(await meRes.json());
      const eventsData = await eventsRes.json();
      setEvents(eventsRes.ok ? eventsData.events : []);
      const paymentsData = await paymentsRes.json();
      setPayments(paymentsRes.ok ? paymentsData.payments : []);
    }
    load();
  }, []);

  const loading = events === null;
  const today = useMemo(() => new Date(), []);

  const upcoming = useMemo(
    () =>
      (events ?? [])
        .filter((e) => e.starts_at && e.status !== "declined" && new Date(e.starts_at).getTime() >= today.getTime())
        .sort((a, b) => new Date(a.starts_at as string).getTime() - new Date(b.starts_at as string).getTime()),
    [events, today]
  );

  const leads = useMemo(() => (events ?? []).filter((e) => e.status === "inquiry"), [events]);
  const pendingContracts = useMemo(() => (events ?? []).filter((e) => e.contract_status === "sent"), [events]);
  const unassigned = useMemo(() => upcoming.filter((e) => !e.djs), [upcoming]);
  const weddingsReadyForMusicPlan = useMemo(
    () =>
      (events ?? []).filter(
        (e) => e.event_type?.toLowerCase() === "wedding" && e.paid_cents > 0 && !e.wedding_music_plan_sent_at
      ),
    [events]
  );
  const outstanding = useMemo(
    () =>
      (events ?? []).filter((e) => {
        if (e.status === "inquiry" || e.status === "declined") return false;
        const total = Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100);
        return total - e.paid_cents > 0;
      }),
    [events]
  );

  const actionItems = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];
    for (const e of pendingContracts) {
      items.push({ key: `contract-${e.id}`, icon: FileText, label: "Contract awaiting signature", eventTitle: e.title, href: `/admin/events/${e.id}` });
    }
    for (const e of outstanding) {
      const total = Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100);
      items.push({ key: `balance-${e.id}`, icon: DollarSign, label: "Balance due", eventTitle: e.title, href: `/admin/events/${e.id}`, detail: `${money(total - e.paid_cents)} due` });
    }
    for (const e of unassigned) {
      items.push({ key: `unassigned-${e.id}`, icon: UserX, label: "Needs a DJ assigned", eventTitle: e.title, href: `/admin/events/${e.id}` });
    }
    for (const e of leads) {
      items.push({ key: `lead-${e.id}`, icon: Magnet, label: "New lead to follow up", eventTitle: e.title, href: `/admin/events/${e.id}` });
    }
    for (const e of weddingsReadyForMusicPlan) {
      items.push({ key: `music-${e.id}`, icon: Music2, label: "Music plan ready to send", eventTitle: e.title, href: `/admin/events/${e.id}` });
    }
    return items;
  }, [pendingContracts, outstanding, unassigned, leads, weddingsReadyForMusicPlan]);

  const weekOut = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingThisWeek = upcoming.filter((e) => new Date(e.starts_at as string) <= weekOut);
  const bookingsThisYear = (events ?? [])
    .filter((e) => e.starts_at && e.status !== "declined" && e.status !== "inquiry" && new Date(e.starts_at).getFullYear() === today.getFullYear())
    .reduce((sum, e) => sum + Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100), 0);

  const activity = useMemo(() => {
    const items: { label: string; at: string; href: string }[] = [];
    for (const e of events ?? []) {
      if (e.status === "inquiry") items.push({ label: `New lead — ${e.title}`, at: e.created_at, href: "/admin/leads" });
    }
    for (const p of payments ?? []) {
      if (p.paid_at) items.push({ label: `${money(p.amount_cents)} paid — ${eventName(p.events)}`, at: p.paid_at, href: "/admin/finance" });
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 7);
  }, [events, payments]);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const startOffset = new Date(year, month, 1).getDay();
    const gridStart = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [cursor]);

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-3xl font-light">
            {timeOfDayGreeting()}
            {me ? `, ${greetingName(me)}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted">
            {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <Link href="/admin/events">
          <Button variant="primary">
            <Plus size={15} /> New Project
          </Button>
        </Link>
      </div>

      {performance && (performance.revenueTrend.length > 0 || performance.eventTypes.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <GlassCard>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Revenue — last 6 months</p>
              <Link href="/admin/reports" className="text-xs text-gold hover:underline">
                Full report
              </Link>
            </div>
            <RevenueAreaChart
              data={performance.revenueTrend.map((m) => ({ label: monthLabel(m.month), bookedCents: m.bookedCents, collectedCents: m.collectedCents }))}
            />
          </GlassCard>
          <GlassCard className="flex items-center">
            {performance.eventTypes.length > 0 && (
              <EventTypeDonut
                data={performance.eventTypes.map((t) => ({ label: t.type, value: t.revenueCents }))}
                centerLabel="Revenue"
                centerValue={money(performance.eventTypes.reduce((s, t) => s + t.revenueCents, 0))}
              />
            )}
          </GlassCard>
        </div>
      )}

      <div className="flex flex-wrap border border-border">
        <StatTile icon={Magnet} label="New Leads" value={loading ? "…" : leads.length} href="/admin/leads" />
        <StatTile icon={FileText} label="Pending Contracts" value={loading ? "…" : pendingContracts.length} href="/admin/events" />
        <StatTile icon={CalendarClock} label="Upcoming This Week" value={loading ? "…" : upcomingThisWeek.length} href="/admin/calendar" />
        <StatTile icon={Sparkles} label="Bookings This Year" value={loading ? "…" : money(bookingsThisYear)} href="/admin/finance" />
      </div>

      {/* Row 1: Upcoming Events (8) + Tasks Needing Attention (4) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-8">
          <SectionHeader title="Upcoming Events" href="/admin/events" />
          {loading && <p className="py-4 text-sm text-muted">Loading…</p>}
          {!loading && upcoming.length === 0 && (
            <EmptyState icon={CalendarClock} title="Nothing on the books" body="New confirmed events will show up here." />
          )}
          {!loading && upcoming.length > 0 && (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Event</th>
                    <th>Venue</th>
                    <th>DJ</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.slice(0, 6).map((e) => (
                    <tr key={e.id} className="is-linked" onClick={() => (window.location.href = `/admin/events/${e.id}`)}>
                      <td className="whitespace-nowrap tabular-nums text-muted">
                        {new Date(e.starts_at as string).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </td>
                      <td className="font-medium">
                        {e.title}
                        <div className="text-xs font-normal text-muted">{clientName(e.clients, "Unnamed contact") ?? "No contact"}</div>
                      </td>
                      <td className="text-muted">{e.venues?.name ?? "—"}</td>
                      <td>
                        {e.djs ? (
                          <span className="flex items-center gap-1.5">
                            <DjAvatar name={e.djs.display_name} photoUrl={e.djs.photo_url} size={18} />
                            <span className="text-xs">{e.djs.display_name}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-status-urgent">Unassigned</span>
                        )}
                      </td>
                      <td className="capitalize text-muted">{e.event_type ?? "—"}</td>
                      <td>
                        <StatusChip tone={(STATUS_DOT[e.status] as StatusTone) ?? "muted"} variant="dot">
                          {STATUS_LABEL[e.status] ?? e.status}
                        </StatusChip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="lg:col-span-4">
          <SectionHeader title="Action Required" count={actionItems.length} />
          {!loading && actionItems.length === 0 && (
            <EmptyState icon={Inbox} title="All caught up" body="Nothing needs your attention right now." />
          )}
          {actionItems.length > 0 && (
            <div className="flex flex-col divide-y divide-border">
              {actionItems.slice(0, 8).map((item) => (
                <Link key={item.key} href={item.href} className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <item.icon size={15} className="shrink-0 text-status-urgent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm group-hover:text-gold">{item.label}</p>
                    <p className="truncate text-xs text-muted">{item.eventTitle}</p>
                  </div>
                  {item.detail && <span className="shrink-0 text-xs font-semibold tabular-nums">{item.detail}</span>}
                </Link>
              ))}
              {actionItems.length > 8 && (
                <p className="pt-2.5 text-xs text-muted">+ {actionItems.length - 8} more</p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Row 2: Calendar (8) + Recent Activity (4) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-8">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
            <div className="flex items-center gap-1">
              <Button variant="icon" size="sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
                <ChevronLeft size={14} />
              </Button>
              <Link href="/admin/calendar" className="text-xs text-gold hover:underline">
                Full calendar
              </Link>
              <Button variant="icon" size="sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-t border-l border-border text-xs">
            {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
              <div key={i} className="border-b border-r border-border py-1 text-center text-[10px] text-muted">
                {w}
              </div>
            ))}
            {days.map((d) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = sameDay(d, today);
              const dayEvents = (upcoming ?? []).filter((e) => sameDay(new Date(e.starts_at as string), d));
              return (
                <Link
                  key={d.toISOString()}
                  href="/admin/calendar"
                  className={cn(
                    "flex h-14 flex-col items-center gap-0.5 border-b border-r border-border py-1 hover:bg-black/[0.02]",
                    !inMonth && "opacity-30"
                  )}
                >
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-[10px]", isToday && "bg-gold text-black")}>
                    {d.getDate()}
                  </span>
                  {dayEvents.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-4">
          <SectionHeader title="Recent Activity" />
          {loading && <p className="py-4 text-sm text-muted">Loading…</p>}
          {!loading && activity.length === 0 && <EmptyState icon={ActivityIcon} title="No activity yet" />}
          <div className="flex flex-col divide-y divide-border">
            {activity.map((a, i) => (
              <Link key={i} href={a.href} className="group flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="text-sm group-hover:text-gold">{a.label}</span>
                <span className="shrink-0 text-[11px] text-muted">
                  {new Date(a.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  href
}: {
  title: string;
  count?: number;
  href?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <span>{title}</span>
        {count !== undefined && <span className="text-xs font-normal text-muted">({count})</span>}
      </p>
      {href && (
        <Link href={href} className="text-xs text-gold hover:underline">
          View all
        </Link>
      )}
    </div>
  );
}
