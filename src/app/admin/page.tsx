"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { EventTypeDonut } from "@/components/charts/event-type-donut";
import { cn } from "@/lib/utils";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
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
  Music2
} from "lucide-react";

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

function clientName(c: EventRow["clients"]) {
  if (!c) return "No contact";
  return c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed contact";
}

function eventName(e: PaymentRow["events"]) {
  const row = Array.isArray(e) ? e[0] : e;
  return row?.title ?? "Event";
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const DASHBOARD_SECTIONS = [
  { key: "stats", label: "Stat tiles" },
  { key: "upcoming", label: "Upcoming Events" },
  { key: "tasks", label: "Tasks Needing Attention" },
  { key: "calendar", label: "Calendar" },
  { key: "activity", label: "Recent Activity" },
  { key: "dj-assignment", label: "DJ Assignment" },
  { key: "contracts", label: "Contracts Needing Action" },
  { key: "balances", label: "Outstanding Balances" }
] as const;
type SectionKey = (typeof DASHBOARD_SECTIONS)[number]["key"];

const TEXT_SCALE_OPTIONS = ["compact", "default", "large"] as const;
type TextScale = (typeof TEXT_SCALE_OPTIONS)[number];
const TEXT_SCALE_ZOOM: Record<TextScale, number> = { compact: 0.9, default: 1, large: 1.15 };

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading...</div>}>
      <AdminOverviewPageInner />
    </Suspense>
  );
}

function AdminOverviewPageInner() {
  const searchParams = useSearchParams();
  const designMode = searchParams.has("design");
  const [hiddenSections, setHiddenSections] = useState<Set<SectionKey>>(new Set());
  const [textScale, setTextScale] = useState<TextScale>("default");
  const [titles, setTitles] = useState<Record<string, string>>({});

  function toggleSection(key: SectionKey) {
    setHiddenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function isHidden(key: SectionKey) {
    return hiddenSections.has(key);
  }

  function titleFor(key: string, fallback: string) {
    return titles[key] ?? fallback;
  }

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
      <div style={designMode ? { zoom: TEXT_SCALE_ZOOM[textScale] } : undefined} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-display text-3xl font-light"
            contentEditable={designMode}
            suppressContentEditableWarning
            onBlur={(e) => setTitles((prev) => ({ ...prev, greeting: e.currentTarget.textContent ?? "" }))}
          >
            {titleFor("greeting", `${timeOfDayGreeting()}${me ? `, ${greetingName(me)}` : ""}`)}
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

      {!isHidden("stats") && (
        <div className="flex flex-wrap border border-border">
          <StatTile icon={Magnet} label="New Leads" value={loading ? "…" : leads.length} href="/admin/leads" />
          <StatTile icon={FileText} label="Pending Contracts" value={loading ? "…" : pendingContracts.length} href="/admin/events" />
          <StatTile icon={CalendarClock} label="Upcoming This Week" value={loading ? "…" : upcomingThisWeek.length} href="/admin/calendar" />
          <StatTile icon={Sparkles} label="Bookings This Year" value={loading ? "…" : money(bookingsThisYear)} href="/admin/finance" />
        </div>
      )}

      {/* Row 1: Upcoming Events (8) + Tasks Needing Attention (4) */}
      {(!isHidden("upcoming") || !isHidden("tasks")) && (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {!isHidden("upcoming") && (
        <section className="lg:col-span-8">
          <SectionHeader
            title={titleFor("upcoming", "Upcoming Events")}
            href="/admin/events"
            editable={designMode}
            onTitleChange={(v) => setTitles((prev) => ({ ...prev, upcoming: v }))}
          />
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
                        <div className="text-xs font-normal text-muted">{clientName(e.clients)}</div>
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
        )}

        {!isHidden("tasks") && (
        <section className="lg:col-span-4">
          <SectionHeader
            title={titleFor("tasks", "Tasks Needing Attention")}
            editable={designMode}
            onTitleChange={(v) => setTitles((prev) => ({ ...prev, tasks: v }))}
          />
          <div className="flex flex-col divide-y divide-border">
            <TaskRow icon={FileText} label="Contracts awaiting signature" count={pendingContracts.length} href="/admin/events" tone={pendingContracts.length > 0 ? "urgent" : "default"} />
            <TaskRow icon={Magnet} label="New leads to follow up" count={leads.length} href="/admin/leads" tone={leads.length > 0 ? "urgent" : "default"} />
            <TaskRow icon={UserX} label="Upcoming events missing a DJ" count={unassigned.length} href="/admin/events" tone={unassigned.length > 0 ? "urgent" : "default"} />
            <TaskRow icon={DollarSign} label="Events with a balance due" count={outstanding.length} href="/admin/finance" tone={outstanding.length > 0 ? "urgent" : "default"} />
            <TaskRow
              icon={Music2}
              label="Weddings ready for their music plan"
              count={weddingsReadyForMusicPlan.length}
              href="/admin/events"
              tone={weddingsReadyForMusicPlan.length > 0 ? "urgent" : "default"}
            />
          </div>
        </section>
        )}
      </div>
      )}

      {/* Row 2: Calendar (8) + Recent Activity (4) */}
      {(!isHidden("calendar") || !isHidden("activity")) && (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {!isHidden("calendar") && (
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
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-[2px]", isToday && "bg-gold text-black")}>
                    {d.getDate()}
                  </span>
                  {dayEvents.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
                </Link>
              );
            })}
          </div>
        </section>
        )}

        {!isHidden("activity") && (
        <section className="lg:col-span-4">
          <SectionHeader
            title={titleFor("activity", "Recent Activity")}
            editable={designMode}
            onTitleChange={(v) => setTitles((prev) => ({ ...prev, activity: v }))}
          />
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
        )}
      </div>
      )}

      {/* Row 3: DJ coverage / Contracts / Payments — three balanced columns */}
      {(!isHidden("dj-assignment") || !isHidden("contracts") || !isHidden("balances")) && (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {!isHidden("dj-assignment") && (
        <section>
          <SectionHeader
            title={titleFor("dj-assignment", "DJ Assignment")}
            count={unassigned.length}
            editable={designMode}
            onTitleChange={(v) => setTitles((prev) => ({ ...prev, "dj-assignment": v }))}
          />
          {unassigned.length === 0 ? (
            <EmptyState icon={UserX} title="Fully staffed" body="Every upcoming event has a DJ." />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {unassigned.slice(0, 5).map((e) => (
                <Link key={e.id} href={`/admin/events/${e.id}`} className="group flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <span className="text-sm group-hover:text-gold">{e.title}</span>
                  <span className="text-xs text-muted">{new Date(e.starts_at as string).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
        )}

        {!isHidden("contracts") && (
        <section>
          <SectionHeader
            title={titleFor("contracts", "Contracts Needing Action")}
            count={pendingContracts.length}
            editable={designMode}
            onTitleChange={(v) => setTitles((prev) => ({ ...prev, contracts: v }))}
          />
          {pendingContracts.length === 0 ? (
            <EmptyState icon={FileText} title="All caught up" body="No contracts waiting on a signature." />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {pendingContracts.slice(0, 5).map((e) => (
                <Link key={e.id} href={`/admin/events/${e.id}`} className="group flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <span className="text-sm group-hover:text-gold">{e.title}</span>
                  <StatusChip tone="pending" variant="dot">Awaiting</StatusChip>
                </Link>
              ))}
            </div>
          )}
        </section>
        )}

        {!isHidden("balances") && (
        <section>
          <SectionHeader
            title={titleFor("balances", "Outstanding Balances")}
            count={outstanding.length}
            href="/admin/finance"
            editable={designMode}
            onTitleChange={(v) => setTitles((prev) => ({ ...prev, balances: v }))}
          />
          {outstanding.length === 0 ? (
            <EmptyState icon={DollarSign} title="Nothing outstanding" body="Every booked event is paid in full." />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {outstanding.slice(0, 5).map((e) => {
                const total = Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100);
                return (
                  <Link key={e.id} href={`/admin/events/${e.id}`} className="group flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <span className="text-sm group-hover:text-gold">{e.title}</span>
                    <span className="text-xs font-semibold tabular-nums">{money(total - e.paid_cents)} due</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        )}
      </div>
      )}
      </div>

      {designMode && (
        <div className="fixed bottom-4 right-4 z-50 flex max-h-[85vh] w-64 flex-col gap-3 overflow-y-auto rounded-[2px] border border-gold/40 bg-white p-4 text-xs shadow-[0_8px_30px_rgba(0,0,0,0.15)]">
          <p className="font-semibold uppercase tracking-wide text-muted">Design Controls</p>

          <div>
            <p className="mb-1.5 text-muted">Text size — {textScale}</p>
            <div className="flex flex-wrap gap-1">
              {TEXT_SCALE_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTextScale(t)}
                  className={cn(
                    "rounded-[2px] border px-2 py-1 text-[11px] capitalize",
                    textScale === t ? "border-gold bg-gold/10 text-gold" : "border-black/15 text-muted hover:border-black/30"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-muted">Sections</p>
            <div className="flex flex-col gap-1">
              {DASHBOARD_SECTIONS.map((s) => {
                const hidden = isHidden(s.key);
                return (
                  <div key={s.key} className={cn("flex items-center justify-between gap-1 rounded-[2px] border px-2 py-1", hidden ? "border-black/10 opacity-50" : "border-black/15")}>
                    <span>{s.label}</span>
                    <button onClick={() => toggleSection(s.key)}>{hidden ? "Show" : "Hide"}</button>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="border-t border-border pt-2 text-[10px] leading-snug text-muted">
            Only visible with ?design=1 in the URL. Click any heading to rename it in place. Tell me the layout you
            land on and I&rsquo;ll make it permanent.
          </p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  count,
  href,
  editable,
  onTitleChange
}: {
  title: string;
  count?: number;
  href?: string;
  editable?: boolean;
  onTitleChange?: (value: string) => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <span
          contentEditable={editable}
          suppressContentEditableWarning
          onBlur={(e) => onTitleChange?.(e.currentTarget.textContent ?? "")}
        >
          {title}
        </span>
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

function TaskRow({
  icon: Icon,
  label,
  count,
  href,
  tone
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  count: number;
  href: string;
  tone: "default" | "urgent";
}) {
  return (
    <Link href={href} className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <Icon size={15} className={tone === "urgent" ? "text-status-urgent" : "text-muted"} />
      <span className="flex-1 text-sm group-hover:text-gold">{label}</span>
      <span
        className={cn(
          "flex h-5 min-w-5 items-center justify-center rounded-[2px] px-1 text-xs font-semibold tabular-nums",
          tone === "urgent" ? "bg-status-urgent/10 text-status-urgent" : "bg-panel text-muted"
        )}
      >
        {count}
      </span>
    </Link>
  );
}
