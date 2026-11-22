import { EVENT_CATEGORY_LABELS, type EventCategory } from "@/lib/event-category";

/**
 * Admin dashboard numbers, worked out once from the same records the
 * dashboard already loads (/api/admin/events, /api/admin/payments,
 * /api/admin/reports). Both dashboard layouts (Modern Studio and Midnight
 * Command) and the Projects list's "needs" filters read from here, so a
 * count on the dashboard and the list it opens always agree. The rules are
 * the ones the dashboard used before the redesign; nothing here changes them.
 */

export interface DashEvent {
  id: string;
  /** A calendar entry with no start time (shown as "All day"). */
  all_day?: boolean;
  title: string;
  status: string;
  event_type: string | null;
  event_category: EventCategory | null;
  starts_at: string | null;
  created_at: string;
  quoted_amount: number | null;
  final_amount: number | null;
  paid_cents: number;
  contract_status: "none" | "draft" | "sent" | "signed" | "void";
  wedding_music_plan_sent_at?: string | null;
  hero_image_url?: string | null;
  djs: { display_name: string; photo_url: string | null } | null;
  venues: { name: string; cover_url?: string | null } | null;
  clients: { company_name: string | null; first_name: string | null; last_name: string | null } | null;
}

export interface DashPayment {
  id: string;
  amount_cents: number;
  paid_at: string | null;
  events: { title: string } | { title: string }[] | null;
}

export const dealValueCents = (e: Pick<DashEvent, "final_amount" | "quoted_amount">) => Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100);
export const balanceCents = (e: DashEvent) => dealValueCents(e) - e.paid_cents;

/** Upcoming = starts now or later and not declined (inquiries included), soonest first. */
export function upcomingEvents(events: DashEvent[], now: Date) {
  return events
    .filter((e) => e.starts_at && e.status !== "declined" && new Date(e.starts_at).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.starts_at as string).getTime() - new Date(b.starts_at as string).getTime());
}

/** The Projects list's "needs" filters (?need=…), shared with the dashboard's action groups. */
export type Need = "dj" | "contract" | "balance" | "music";
export const NEEDS: Need[] = ["dj", "contract", "balance", "music"];
export const isNeed = (v: unknown): v is Need => NEEDS.includes(v as Need);

export function matchesNeed(e: DashEvent, need: Need, now: Date): boolean {
  switch (need) {
    case "dj":
      return !e.djs && !!e.starts_at && e.status !== "declined" && new Date(e.starts_at).getTime() >= now.getTime();
    case "contract":
      return e.contract_status === "sent";
    case "balance":
      return e.status !== "inquiry" && e.status !== "declined" && balanceCents(e) > 0;
    case "music":
      return e.event_category === "wedding" && e.paid_cents > 0 && !e.wedding_music_plan_sent_at;
  }
}

export const NEED_LABELS: Record<Need, { title: string; list: string }> = {
  dj: { title: "Upcoming events without a DJ", list: "Upcoming events with no DJ assigned, inquiries included." },
  contract: { title: "Contracts awaiting signature", list: "Contracts sent and not yet signed." },
  balance: { title: "Balances due", list: "Booked events (not inquiries) with a balance still owed." },
  music: { title: "Music plans ready to send", list: "Weddings with a payment in and no music plan sent yet." }
};

export type ActionGroupKey = "inquiries" | Need;
export interface ActionGroup {
  key: ActionGroupKey;
  title: string;
  /** How many records, in plain words. */
  detail: string;
  next: string;
  count: number;
  href: string;
  amountCents?: number;
}

/**
 * Action groups, most urgent first. Each counts records for one workflow;
 * the same event can be in more than one group (an inquiry with no DJ, say),
 * so the groups are never added up into one "actions" total.
 */
export function actionGroups(events: DashEvent[], now: Date): ActionGroup[] {
  const by = (n: Need) => events.filter((e) => matchesNeed(e, n, now));
  const inquiries = events.filter((e) => e.status === "inquiry");
  const dj = by("dj");
  const djInquiries = dj.filter((e) => e.status === "inquiry").length;
  const contract = by("contract");
  const balance = by("balance");
  const music = by("music");
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const groups: ActionGroup[] = [
    {
      key: "dj",
      title: "Assign a DJ",
      count: dj.length,
      detail:
        dj.length === 0
          ? "Every upcoming event has a DJ"
          : `${plural(dj.length, "upcoming event")} without a DJ${djInquiries ? ` (${djInquiries} still ${djInquiries === 1 ? "an inquiry" : "inquiries"})` : ""}`,
      next: "Open the list and assign DJs",
      href: "/admin/events?need=dj"
    },
    {
      key: "inquiries",
      title: "Reply to inquiries",
      count: inquiries.length,
      detail: inquiries.length === 0 ? "No open inquiries" : `${plural(inquiries.length, "open inquiry", "open inquiries")}`,
      next: "Follow up or decline",
      href: "/admin/events?stage=inquiries"
    },
    {
      key: "contract",
      title: "Contracts awaiting signature",
      count: contract.length,
      detail: contract.length === 0 ? "No contracts out for signature" : `${plural(contract.length, "contract")} sent, not signed`,
      next: "Nudge the client to sign",
      href: "/admin/events?need=contract"
    },
    {
      key: "balance",
      title: "Payments to collect",
      count: balance.length,
      amountCents: balance.reduce((s, e) => s + balanceCents(e), 0),
      detail: balance.length === 0 ? "No balances due" : `${plural(balance.length, "booked event")} with a balance due`,
      next: "Send a payment reminder",
      href: "/admin/events?need=balance"
    },
    {
      key: "music",
      title: "Send music plans",
      count: music.length,
      detail: music.length === 0 ? "No music plans waiting" : `${plural(music.length, "wedding")} ready for a music plan`,
      next: "Send the music plan",
      href: "/admin/events?need=music"
    }
  ];
  return groups.filter((g) => g.count > 0);
}

export interface Metrics {
  newLeads: number;
  pendingContracts: number;
  upcomingThisWeek: number;
  bookedThisYearCents: number;
  collectedThisYearCents: number;
  outstandingCents: number;
  year: number;
}

export function metrics(events: DashEvent[], payments: DashPayment[], now: Date): Metrics {
  const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const year = now.getFullYear();
  return {
    newLeads: events.filter((e) => e.status === "inquiry").length,
    pendingContracts: events.filter((e) => e.contract_status === "sent").length,
    upcomingThisWeek: upcomingEvents(events, now).filter((e) => new Date(e.starts_at as string) <= week).length,
    // Booked = agreed value of confirmed, live or completed events dated this year (inquiries and declined left out).
    bookedThisYearCents: events
      .filter((e) => e.starts_at && e.status !== "declined" && e.status !== "inquiry" && new Date(e.starts_at).getFullYear() === year)
      .reduce((s, e) => s + dealValueCents(e), 0),
    // Collected = payments actually received this calendar year.
    collectedThisYearCents: payments.filter((p) => p.paid_at && new Date(p.paid_at).getFullYear() === year).reduce((s, p) => s + p.amount_cents, 0),
    // Outstanding = still owed on booked events (any date).
    outstandingCents: events.filter((e) => matchesNeed(e, "balance", now)).reduce((s, e) => s + balanceCents(e), 0),
    year
  };
}

/* ---------------- charts ---------------- */

export type Period = "last_6_months" | "last_12_months" | "this_year" | "last_year" | "all_time";
export const PERIODS: { key: Period; label: string; short: string }[] = [
  { key: "last_6_months", label: "Last 6 months", short: "6 mo" },
  { key: "last_12_months", label: "Last 12 months", short: "12 mo" },
  { key: "this_year", label: "This year", short: "This yr" },
  { key: "last_year", label: "Last year", short: "Last yr" },
  { key: "all_time", label: "All time", short: "All" }
];
export const isPeriod = (v: unknown): v is Period => PERIODS.some((p) => p.key === v);

const mk = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

/**
 * Every month in the period, oldest first. The report covers the whole
 * period for both series, so a month with no rows is a real $0, not missing.
 * "All time" starts at the earliest month that has any data.
 */
export function monthsOf(period: Period, now: Date, dataMonths: string[]): string[] {
  let y0: number, m0: number, y1 = now.getFullYear(), m1 = now.getMonth();
  if (period === "last_6_months" || period === "last_12_months") {
    const back = period === "last_6_months" ? 5 : 11;
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    y0 = d.getFullYear();
    m0 = d.getMonth();
  } else if (period === "this_year") {
    y0 = y1;
    m0 = 0;
  } else if (period === "last_year") {
    y0 = y1 = now.getFullYear() - 1;
    m0 = 0;
    m1 = 11;
  } else {
    const first = [...dataMonths].sort()[0];
    if (!first) return [];
    const [fy, fm] = first.split("-").map(Number);
    y0 = fy;
    m0 = fm - 1;
  }
  const out: string[] = [];
  for (let y = y0, m = m0; y * 12 + m <= y1 * 12 + m1; m === 11 ? ((m = 0), y++) : m++) out.push(mk(y, m));
  return out;
}

export interface TrendRow {
  month: string;
  bookedCents: number;
  collectedCents: number;
}
export function fillTrend(period: Period, now: Date, rows: TrendRow[]): TrendRow[] {
  const by = new Map(rows.map((r) => [r.month, r]));
  // The report's windows all end today (events dated later aren't in it), so the chart ends this month too.
  const months = monthsOf(period, now, rows.map((r) => r.month));
  return months.map((m) => by.get(m) ?? { month: m, bookedCents: 0, collectedCents: 0 });
}

export interface TypeRow {
  type: string;
  count: number;
  revenueCents: number;
}
/** Event types with value in the period, largest first, with their share of the total. Empty types are left out. */
export function typeBreakdown(rows: TypeRow[]) {
  const withValue = rows.filter((r) => r.revenueCents > 0).sort((a, b) => b.revenueCents - a.revenueCents);
  const total = withValue.reduce((s, r) => s + r.revenueCents, 0);
  return {
    total,
    rows: withValue.map((r) => ({ ...r, share: total ? r.revenueCents / total : 0 }))
  };
}

/* ---------------- activity ---------------- */

export interface ActivityItem {
  key: string;
  kind: "lead" | "payment" | "project";
  title: string;
  detail: string;
  at: string;
  href: string;
  amountCents?: number;
}

/** Recent activity from the loaded records, newest first. Titles are plain text (rendered as text, never HTML). */
export function recentActivity(events: DashEvent[], payments: DashPayment[], limit = 30): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const e of events) {
    items.push(
      e.status === "inquiry"
        ? { key: `lead-${e.id}`, kind: "lead", title: "New inquiry", detail: e.title, at: e.created_at, href: `/admin/events/${e.id}` }
        : { key: `project-${e.id}`, kind: "project", title: "Project added", detail: e.title, at: e.created_at, href: `/admin/events/${e.id}` }
    );
  }
  for (const p of payments) {
    if (!p.paid_at) continue;
    const ev = Array.isArray(p.events) ? p.events[0] : p.events;
    items.push({ key: `pay-${p.id}`, kind: "payment", title: "Payment received", detail: ev?.title ?? "Event", at: p.paid_at, href: "/admin/finance", amountCents: p.amount_cents });
  }
  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, limit);
}

/** "5m ago", "3h ago", "Yesterday", "Nov 12" — in the viewer's own timezone. */
export function relativeTime(iso: string, now: Date) {
  const t = new Date(iso);
  const s = Math.round((now.getTime() - t.getTime()) / 1000);
  if (s < 60 && s > -60) return "Just now";
  if (s > 0 && s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s > 0 && s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (t.toDateString() === y.toDateString()) return "Yesterday";
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(t.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

/* ---------------- calendar ---------------- */

/** A Sunday-first 6-week grid for the month of `cursor`, in the viewer's timezone. */
export function monthGrid(cursor: Date) {
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const start = new Date(y, m, 1 - new Date(y, m, 1).getDay());
  const weeks = Math.ceil((new Date(y, m, 1).getDay() + new Date(y, m + 1, 0).getDate()) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Events by local day (declined left out), for calendar dots and the day list. */
export function eventsByDay(events: DashEvent[]) {
  const map = new Map<string, DashEvent[]>();
  for (const e of events) {
    if (!e.starts_at || e.status === "declined") continue;
    const k = dayKey(new Date(e.starts_at));
    map.set(k, [...(map.get(k) ?? []), e]);
  }
  for (const list of map.values()) list.sort((a, b) => new Date(a.starts_at as string).getTime() - new Date(b.starts_at as string).getTime());
  return map;
}

export const typeLabel = (e: Pick<DashEvent, "event_category" | "event_type">) =>
  (e.event_category && EVENT_CATEGORY_LABELS[e.event_category]) || e.event_type || "—";
