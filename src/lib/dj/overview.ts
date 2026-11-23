import type { ActionGroup, ActivityItem, DashEvent, TrendRow } from "@/lib/dashboard/overview";
import type { MyGig } from "@/lib/data/my-gigs";

/**
 * DJ dashboard numbers, from what a DJ's pages already load: their bookings
 * (/api/admin/events, scoped to them), payouts (/api/dj/payouts), recurring
 * gigs (/api/dj/gigs), open tasks and My gigs (/api/me/gigs, which adds the
 * shared Google Calendar). Nothing here changes any rule; it only counts.
 */

export interface DjPayout {
  id: string;
  amount_cents: number;
  status: "pending" | "paid";
  paid_at: string | null;
  created_at: string;
  events: { title: string | null; starts_at: string | null } | null;
}
export interface DjTask {
  id: string;
  event_id: string;
  title: string;
  due_date: string | null;
}
export interface DjResidency {
  awaiting: unknown[];
  upcoming: unknown[];
  recapDue: unknown[];
}

const DAY = 86400000;
const gigTime = (g: MyGig) => Date.parse(g.starts_at ?? `${g.date}T12:00:00`);

export function djMetrics(gigs: MyGig[], events: DashEvent[], payouts: DjPayout[], now: Date) {
  const t = now.getTime();
  const soon = (days: number) => gigs.filter((g) => g.status !== "inquiry" && !g.away && gigTime(g) >= t - 6 * 3600000 && gigTime(g) <= t + days * DAY).length;
  const year = now.getFullYear();
  return {
    next30: soon(30),
    thisWeek: soon(7),
    openLeads: events.filter((e) => e.status === "inquiry").length,
    pendingCents: payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount_cents, 0),
    paidThisYearCents: payouts.filter((p) => p.status === "paid" && p.paid_at && new Date(p.paid_at).getFullYear() === year).reduce((s, p) => s + p.amount_cents, 0)
  };
}

/** What needs the DJ, most urgent first; only groups with something in them. */
export function djActionGroups(events: DashEvent[], residency: DjResidency, tasks: DjTask[], now: Date): ActionGroup[] {
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const toConfirm = events.filter((e) => e.status === "pending_confirmation" && (!e.starts_at || Date.parse(e.starts_at) >= now.getTime() - DAY));
  const leads = events.filter((e) => e.status === "inquiry");
  const firstTask = [...tasks].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))[0];
  const groups: ActionGroup[] = [
    { key: "dj", title: "Confirm bookings", count: toConfirm.length, detail: `${plural(toConfirm.length, "booking")} waiting for your yes or no`, next: "Accept or decline", href: "/dj-dashboard/bookings" },
    { key: "contract", title: "Confirm recurring gigs", count: residency.awaiting.length, detail: `${plural(residency.awaiting.length, "venue night")} asking if you can cover`, next: "Confirm or pass", href: "/dj-dashboard/gigs" },
    { key: "music", title: "Send gig recaps", count: residency.recapDue.length, detail: `${plural(residency.recapDue.length, "night")} played without a recap yet`, next: "Write a quick recap", href: "/dj-dashboard/gigs" },
    {
      key: "balance",
      title: "Finish tasks",
      count: tasks.length,
      detail: `${plural(tasks.length, "open task")}${firstTask?.due_date ? `, next due ${new Date(`${firstTask.due_date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}`,
      next: "Open the project",
      href: firstTask ? `/dj-dashboard/projects/${firstTask.event_id}` : "/dj-dashboard/bookings"
    },
    { key: "inquiries", title: "Follow up on leads", count: leads.length, detail: `${plural(leads.length, "lead")} you added or were given`, next: "Check where each one stands", href: "/dj-dashboard/leads" }
  ];
  return groups.filter((g) => g.count > 0);
}

/** Payouts per month: "pending" by when it was added, "paid" by when it was paid. */
export function payoutTrend(payouts: DjPayout[]): TrendRow[] {
  const by = new Map<string, TrendRow>();
  const key = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const row = (m: string) => by.get(m) ?? (by.set(m, { month: m, bookedCents: 0, collectedCents: 0 }), by.get(m)!);
  for (const p of payouts) {
    if (p.status === "paid" && p.paid_at) row(key(p.paid_at)).collectedCents += p.amount_cents;
    else if (p.status === "pending") row(key(p.created_at)).bookedCents += p.amount_cents;
  }
  return [...by.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Calendar entries that aren't projects, shaped for the month calendar (dots and the day list). */
export function calendarItems(gigs: MyGig[], events: DashEvent[]): DashEvent[] {
  const extra: DashEvent[] = gigs
    .filter((g) => g.source !== "project")
    .map((g) => ({
      id: g.key,
      title: g.title,
      status: g.away ? "away" : "confirmed",
      event_type: null,
      event_category: null,
      starts_at: g.starts_at ?? new Date(`${g.date}T12:00:00`).toISOString(),
      created_at: g.starts_at ?? g.date,
      quoted_amount: null,
      final_amount: null,
      paid_cents: 0,
      contract_status: "none",
      djs: null,
      venues: g.venue ? { name: g.venue } : null,
      clients: null,
      all_day: !g.starts_at,
      ends_at: g.ends_at,
      calendar_source: g.source === "venue_night" ? ("venue_night" as const) : ("google" as const)
    }));
  return [...events, ...extra];
}

export function djActivity(events: DashEvent[], payouts: DjPayout[], limit = 30): ActivityItem[] {
  const items: ActivityItem[] = events.map((e) =>
    e.status === "inquiry"
      ? { key: `lead-${e.id}`, kind: "lead" as const, title: "Lead", detail: e.title, at: e.created_at, href: `/dj-dashboard/projects/${e.id}` }
      : { key: `b-${e.id}`, kind: "project" as const, title: "Booking added", detail: e.title, at: e.created_at, href: `/dj-dashboard/projects/${e.id}` }
  );
  for (const p of payouts) {
    if (p.status === "paid" && p.paid_at) items.push({ key: `pay-${p.id}`, kind: "payment", title: "Payout paid", detail: p.events?.title ?? "Gig", at: p.paid_at, href: "/dj-dashboard/payouts", amountCents: p.amount_cents });
  }
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}
