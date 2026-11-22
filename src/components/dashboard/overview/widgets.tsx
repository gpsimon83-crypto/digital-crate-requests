"use client";

import { createContext, useContext, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Disc3,
  FileSignature,
  FileText,
  Inbox,
  MapPin,
  Music2,
  Plus,
  Sparkles,
  UserPlus,
  Users,
  type LucideIcon
} from "lucide-react";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { cn } from "@/lib/utils";
import { money, clientName } from "@/lib/format";
import {
  PERIODS,
  dayKey,
  eventsByDay,
  monthGrid,
  relativeTime,
  typeLabel,
  type ActionGroup,
  type ActionGroupKey,
  type ActivityItem,
  type DashEvent,
  type Metrics,
  type Period,
  type TrendRow,
  type TypeRow
} from "@/lib/dashboard/overview";
import type { DashLayout } from "@/lib/dashboard-layout";

/* ---------------- shared bits ---------------- */

/**
 * Where dashboard items open. The admin home uses the defaults; the DJ
 * dashboard passes its own (a DJ's project page, their bookings list…).
 */
export type DashLinks = {
  project: (id: string) => string;
  allProjects: string;
  calendar: string;
  category: (key: "wedding" | "club") => string;
};
export const ADMIN_LINKS: DashLinks = {
  project: (id) => `/admin/events/${id}`,
  allProjects: "/admin/events",
  calendar: "/admin/calendar",
  category: (k) => `/admin/events?category=${k}`
};
const LinksContext = createContext<DashLinks>(ADMIN_LINKS);
export const DashLinksProvider = LinksContext.Provider;
const useLinks = () => useContext(LinksContext);

export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

/** Card shell. Studio: soft, roomy. Command: elevated slate panel. */
export function Panel({ layout, className, children, as: As = "section", ...rest }: { layout: DashLayout; className?: string; children: React.ReactNode; as?: "section" | "div" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As
      {...rest}
      className={cn(
        "min-w-0 rounded-[18px] border border-border bg-card",
        layout === "studio" ? "p-4 shadow-[var(--shadow-card)] sm:p-5" : "p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:p-5",
        className
      )}
    >
      {children}
    </As>
  );
}

export function PanelTitle({ children, action, layout, id }: { children: React.ReactNode; action?: React.ReactNode; layout: DashLayout; id?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 id={id} className={cn("font-display font-light leading-tight", layout === "studio" ? "text-[22px]" : "text-[21px]")}>
        {children}
      </h2>
      {action}
    </div>
  );
}

function StateBox({ kind, title, body, icon: Icon }: { kind: "loading" | "empty" | "error"; title: string; body?: string; icon?: LucideIcon }) {
  const I = Icon ?? (kind === "error" ? AlertTriangle : Inbox);
  return (
    <div role={kind === "error" ? "alert" : "status"} className="flex min-h-[120px] flex-col items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-border px-4 py-6 text-center">
      {kind === "loading" ? <span className="h-5 w-5 rounded-full border-2 border-gold/30 border-t-gold motion-safe:animate-spin" aria-hidden /> : <I size={18} className={kind === "error" ? "text-status-declined" : "text-muted"} aria-hidden />}
      <p className="text-sm font-medium">{title}</p>
      {body && <p className="max-w-xs text-xs text-muted">{body}</p>}
    </div>
  );
}

const shortMoney = (cents: number) => {
  const d = cents / 100;
  if (Math.abs(d) >= 1_000_000) return `$${(d / 1_000_000).toFixed(d % 1_000_000 ? 1 : 0)}M`;
  if (Math.abs(d) >= 1000) return `$${(d / 1000).toFixed(d % 1000 ? 1 : 0)}k`;
  return `$${Math.round(d)}`;
};

/* ---------------- banners ---------------- */

export type Focal = { x: number; y: number };
export type BannerPhotos = { wedding: { url: string | null; focal: Focal }; club: { url: string | null; focal: Focal } };
export const FALLBACK_PHOTOS = { wedding: "/project/reception.jpg", club: "/flyers/dj-night/concert-photo.jpg" };

/** A decorative photo, cropped (never stretched or tiled) around its focal point. */
export function BannerPhoto({ src, focal, sizes, priority, className }: { src: string; focal: Focal; sizes: string; priority?: boolean; className?: string }) {
  return <Image src={src} alt="" fill sizes={sizes} priority={priority} className={cn("object-cover", className)} style={{ objectPosition: `${focal.x}% ${focal.y}%` }} />;
}

/** Studio: two photo panels (weddings, club nights), each opening that kind of project. */
export function StudioBanner({ photos }: { photos: BannerPhotos }) {
  const links = useLinks();
  const panels = [
    { key: "wedding", label: "Weddings", href: links.category("wedding"), src: photos.wedding.url ?? FALLBACK_PHOTOS.wedding, focal: photos.wedding.url ? photos.wedding.focal : { x: 70, y: 60 } },
    { key: "club", label: "Club & Bar Nights", href: links.category("club"), src: photos.club.url ?? FALLBACK_PHOTOS.club, focal: photos.club.url ? photos.club.focal : { x: 50, y: 40 } }
  ];
  return (
    <div className="grid h-[148px] grid-cols-2 gap-2 overflow-hidden rounded-[18px] sm:h-[176px] lg:h-[188px]" data-tour="dash-banner">
      {panels.map((p) => (
        <Link key={p.key} href={p.href} className={cn("group relative block overflow-hidden rounded-[14px] bg-panel", FOCUS)} aria-label={`${p.label}: open these projects`}>
          <BannerPhoto src={p.src} focal={p.focal} sizes="(min-width: 1024px) 40vw, 50vw" priority className="transition-transform duration-500 motion-safe:group-hover:scale-[1.03]" />
          {/* Just enough shade behind the label to read it. */}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/25 to-transparent" aria-hidden />
          <span className="absolute bottom-3 left-3 right-3 font-display text-lg leading-tight text-white sm:bottom-4 sm:left-4 sm:text-[22px]">
            {p.label}
            <span className="mt-1.5 block h-[2px] w-9 rounded-full bg-gold" aria-hidden />
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ---------------- quick actions ---------------- */

export type QuickAction = { href: string; label: string; icon: LucideIcon; primary?: boolean };
export const ADMIN_QUICK_ACTIONS: QuickAction[] = [
  { href: "/admin/events?new=1", label: "New project", icon: Plus, primary: true },
  { href: "/admin/calendar", label: "View calendar", icon: CalendarDays },
  { href: "/admin/reports", label: "View reports", icon: BarChart3 }
];

export function QuickActions({ layout, className, actions = ADMIN_QUICK_ACTIONS }: { layout: DashLayout; className?: string; actions?: QuickAction[] }) {
  const base = cn("inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-sm font-semibold transition-colors", FOCUS);
  return (
    <div className={cn("flex flex-wrap gap-2", className)} data-tour="dash-quick">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={cn(base, a.primary ? "bg-gold text-[var(--on-gold,#1a140a)] hover:brightness-[1.06]" : "border border-border bg-card/70 hover:border-gold", !a.primary && layout === "command" && "backdrop-blur")}
        >
          <a.icon size={16} aria-hidden /> {a.label}
        </Link>
      ))}
    </div>
  );
}

/* ---------------- metrics ---------------- */

export type MetricItem = { key: string; icon: LucideIcon; value: string; label: string; help: string; sub?: string; href: string };

export function MetricCards({ m, loading, error, layout, items: given }: { m: Metrics | null; loading: boolean; error: boolean; layout: DashLayout; items?: MetricItem[] }) {
  const v = (n: number | undefined, f: (n: number) => string = String) => (loading ? "…" : error || n === undefined ? "—" : f(n));
  const items: MetricItem[] = given ?? [
    { key: "leads", icon: Users, value: v(m?.newLeads), label: "New leads", help: "Open inquiries waiting for a reply", href: "/admin/events?stage=inquiries" },
    { key: "contracts", icon: FileText, value: v(m?.pendingContracts), label: "Pending contracts", help: "Sent and not signed yet", href: "/admin/events?need=contract" },
    { key: "week", icon: CalendarClock, value: v(m?.upcomingThisWeek), label: "Upcoming this week", help: "Events in the next 7 days, inquiries included", href: "/admin/calendar" },
    {
      key: "booked",
      icon: CircleDollarSign,
      value: v(m?.bookedThisYearCents, money),
      label: `Booked ${m?.year ?? "this year"}`,
      help: "Agreed value of confirmed, live and completed events dated this year",
      sub: m && !loading && !error ? `${money(m.collectedThisYearCents)} collected this year · ${money(m.outstandingCents)} still owed` : undefined,
      href: "/admin/finance"
    }
  ];
  if (layout === "command")
    return (
      <div className="grid grid-cols-2 overflow-hidden rounded-[18px] border border-border bg-card shadow-[0_10px_30px_rgba(0,0,0,0.18)] lg:grid-cols-4" data-tour="dash-metrics" aria-label="Key numbers">
        {items.map((it, i) => (
          <Link
            key={it.key}
            href={it.href}
            title={it.help}
            className={cn("group flex min-w-0 items-center gap-3 px-4 py-4 hover:bg-black/5 sm:px-5", FOCUS, i % 2 === 1 && "border-l border-border", i >= 2 && "border-t border-border lg:border-t-0", i === 2 && "lg:border-l")}
          >
            <it.icon size={26} strokeWidth={1.5} className="shrink-0 text-gold" aria-hidden />
            <span className="min-w-0">
              <span className="block font-display text-[26px] leading-none tabular-nums sm:text-[30px]">{it.value}</span>
              <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[1.5px] text-muted">{it.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted lg:truncate">{it.sub ?? it.help}</span>
            </span>
          </Link>
        ))}
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="dash-metrics" aria-label="Key numbers">
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          title={it.help}
          className={cn("group flex min-w-0 items-start gap-3 rounded-[16px] border border-border bg-card p-3.5 shadow-[var(--shadow-card)] transition-colors hover:border-gold sm:p-4", FOCUS)}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold" aria-hidden>
            <it.icon size={19} strokeWidth={1.7} />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[26px] leading-none tabular-nums sm:text-[28px]">{it.value}</span>
            <span className="mt-1 block text-sm font-medium">{it.label}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted">{it.sub ?? it.help}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ---------------- revenue ---------------- */

/** The chart's words: admin shows booked vs collected; the DJ dashboard shows their payouts. */
export type ChartCopy = { title: string; a: string; b: string; empty: string; emptyBody: string; footnote: React.ReactNode };
export const ADMIN_CHART_COPY: ChartCopy = {
  title: "Revenue",
  a: "Booked",
  b: "Collected",
  empty: "Nothing booked or collected",
  emptyBody: "Amounts show here once events are priced or payments come in.",
  footnote: (
    <>
      <b className="font-semibold">Booked</b> is the agreed or quoted value of events by the month they happen (open inquiries included, as in Reports).{" "}
      <b className="font-semibold">Collected</b> is payments received, by payment date.{" "}
      <Link href="/admin/reports" className={cn("text-gold underline-offset-2 hover:underline", FOCUS)}>
        Full report
      </Link>
    </>
  )
};

export function PeriodSelect({ period, onChange, id }: { period: Period; onChange: (p: Period) => void; id: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted" htmlFor={id}>
      <span className="sr-only sm:not-sr-only">Period</span>
      <select
        id={id}
        value={period}
        onChange={(e) => onChange(e.target.value as Period)}
        className={cn("h-8 rounded-[8px] border border-border bg-card px-2 text-xs text-foreground", FOCUS)}
        aria-label="Reporting period"
      >
        {PERIODS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const monthName = (key: string, withYear: boolean) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", ...(withYear ? { year: "2-digit" } : {}) });
};

export function RevenueChart({
  trend,
  loading,
  error,
  period,
  onPeriod,
  layout,
  copy = ADMIN_CHART_COPY
}: {
  trend: TrendRow[] | null;
  loading: boolean;
  error: boolean;
  period: Period;
  onPeriod: (p: Period) => void;
  layout: DashLayout;
  copy?: ChartCopy;
}) {
  const spansYears = trend ? new Set(trend.map((t) => t.month.slice(0, 4))).size > 1 : false;
  const data = (trend ?? []).map((t) => ({ ...t, label: monthName(t.month, spansYears), booked: t.bookedCents / 100, collected: t.collectedCents / 100 }));
  const totals = (trend ?? []).reduce((a, t) => ({ b: a.b + t.bookedCents, c: a.c + t.collectedCents }), { b: 0, c: 0 });
  const allZero = !!trend && totals.b === 0 && totals.c === 0;
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "";
  return (
    <Panel layout={layout} aria-labelledby="dash-rev" data-tour="dash-revenue">
      <PanelTitle layout={layout} id="dash-rev" action={<PeriodSelect id="dash-period" period={period} onChange={onPeriod} />}>
        {copy.title}
      </PanelTitle>
      {loading ? (
        <StateBox kind="loading" title="Loading…" />
      ) : error ? (
        <StateBox kind="error" title={`${copy.title} couldn't load`} body="The rest of the dashboard is fine. Try again in a moment." />
      ) : !trend || trend.length === 0 || allZero ? (
        <StateBox kind="empty" icon={BarChart3} title={`${copy.empty} · ${periodLabel}`} body={copy.emptyBody} />
      ) : (
        <>
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legend">
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-gold" aria-hidden /> {copy.a} <span className="tabular-nums text-muted">{money(totals.b)}</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-status-approved" aria-hidden /> {copy.b} <span className="tabular-nums text-muted">{money(totals.c)}</span>
            </li>
          </ul>
          <div className="h-[190px] w-full" role="img" aria-label={`${copy.a} ${money(totals.b)} and ${copy.b.toLowerCase()} ${money(totals.c)}, ${periodLabel}, by month`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fill: "var(--muted)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  tickFormatter={(v: number) => shortMoney(v * 100)}
                  domain={[0, "auto"]}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--gold-soft)" }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="rounded-[10px] border border-border bg-card px-3 py-2 text-xs text-foreground shadow-lg">
                        <p className="mb-1 font-semibold">{label}</p>
                        <p>{copy.a}: {money(Math.round(Number(payload[0]?.payload?.bookedCents ?? 0)))}</p>
                        <p>{copy.b}: {money(Math.round(Number(payload[0]?.payload?.collectedCents ?? 0)))}</p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="booked" name={copy.a} fill="var(--gold)" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false} />
                <Bar dataKey="collected" name={copy.b} fill="var(--status-approved)" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted">{copy.footnote}</p>
        </>
      )}
    </Panel>
  );
}

/* ---------------- event types ---------------- */

export function EventTypeBars({ types, loading, error, period, layout }: { types: { total: number; rows: (TypeRow & { share: number })[] } | null; loading: boolean; error: boolean; period: Period; layout: DashLayout }) {
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "";
  return (
    <Panel layout={layout} aria-labelledby="dash-types" data-tour="dash-types">
      <PanelTitle
        layout={layout}
        id="dash-types"
        action={types && types.total > 0 ? <span className="text-right text-xs text-muted"><span className="block font-display text-xl leading-none text-foreground tabular-nums">{money(types.total)}</span>booked · {periodLabel.toLowerCase()}</span> : undefined}
      >
        By event type
      </PanelTitle>
      {loading ? (
        <StateBox kind="loading" title="Loading…" />
      ) : error ? (
        <StateBox kind="error" title="Event types couldn't load" />
      ) : !types || types.rows.length === 0 ? (
        <StateBox kind="empty" icon={Sparkles} title={`No booked value · ${periodLabel}`} />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {types.rows.map((r) => (
              <li key={r.type}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{r.type}</span>
                  <span className="shrink-0 tabular-nums">
                    {money(r.revenueCents)} <span className="text-xs text-muted">· {Math.round(r.share * 100)}%</span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-black/5" aria-hidden>
                  <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(2, r.share * 100)}%` }} />
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  {r.count} {r.count === 1 ? "event" : "events"}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted">Same basis as Booked revenue: event value by event date in the period. Types with no value aren&apos;t shown.</p>
        </>
      )}
    </Panel>
  );
}

/* ---------------- action hub ---------------- */

const GROUP_ICON: Record<ActionGroupKey, LucideIcon> = { dj: Disc3, inquiries: UserPlus, contract: FileSignature, balance: CircleDollarSign, music: Music2 };

export function ActionHub({ groups, loading, error, layout, className, limit }: { groups: ActionGroup[]; loading: boolean; error: boolean; layout: DashLayout; className?: string; limit?: number }) {
  const [more, setMore] = useState(false);
  const shown = limit && !more ? groups.slice(0, limit) : groups;
  return (
    <Panel layout={layout} aria-labelledby="dash-actions" className={className} data-tour="dash-actions">
      <PanelTitle
        layout={layout}
        id="dash-actions"
        action={!loading && !error && groups.length > 0 ? <span className="rounded-full bg-gold-soft px-2.5 py-1 text-xs font-semibold text-foreground">{groups.length} {groups.length === 1 ? "area" : "areas"}</span> : undefined}
      >
        Action hub
      </PanelTitle>
      {loading ? (
        <StateBox kind="loading" title="Checking what needs you…" />
      ) : error ? (
        <StateBox kind="error" title="Couldn't load projects" body="Refresh the page to try again." />
      ) : groups.length === 0 ? (
        <StateBox kind="empty" title="All caught up" body="No DJs to assign, inquiries, contracts or balances waiting." />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {shown.map((g) => {
              const Icon = GROUP_ICON[g.key];
              return (
                <li key={g.key}>
                  <Link href={g.href} className={cn("group flex items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-2.5 transition-colors hover:border-gold", FOCUS)}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold" aria-hidden>
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{g.title}</span>
                        <span className="shrink-0 rounded-full border border-border px-1.5 text-[11px] font-semibold tabular-nums" aria-label={`${g.count} records`}>
                          {g.count}
                        </span>
                      </span>
                      <span className="block text-xs leading-snug text-muted">
                        {g.detail}
                        {g.amountCents ? ` · ${money(g.amountCents)}` : ""}
                      </span>
                      <span className="block text-[11px] text-gold">{g.next}</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-muted group-hover:text-gold" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          {limit && groups.length > limit && (
            <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className={cn("mt-2 w-full rounded-[10px] border border-gold/60 py-2 text-xs font-semibold text-gold hover:bg-gold-soft", FOCUS)}>
              {more ? "Show fewer" : `Show ${groups.length - limit} more`}
            </button>
          )}
          <p className="mt-2 text-[11px] text-muted">Counts are per workflow; one event can show up in more than one group.</p>
        </>
      )}
    </Panel>
  );
}

/* ---------------- upcoming events ---------------- */

const STATUS: Record<string, { label: string; cls: string; dashed?: boolean }> = {
  inquiry: { label: "Inquiry", cls: "text-muted", dashed: true },
  pending_confirmation: { label: "Pending", cls: "text-status-pending" },
  confirmed: { label: "Confirmed", cls: "text-status-approved" },
  live: { label: "Live", cls: "text-status-played" },
  ended: { label: "Completed", cls: "text-muted" },
  declined: { label: "Declined", cls: "text-status-declined" }
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "text-muted" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", s.dashed ? "border-dashed border-border" : "border-current/30 border-border")}>
      <span className={cn("h-2 w-2 rounded-full", s.dashed ? "border border-current" : "bg-current", s.cls)} aria-hidden />
      <span>{s.label}</span>
    </span>
  );
}

function DateBadge({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[10px] border border-border bg-panel leading-none">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">{d.toLocaleDateString(undefined, { month: "short" })}</span>
      <span className="mt-0.5 font-display text-xl tabular-nums">{d.getDate()}</span>
    </span>
  );
}

function Thumb({ e }: { e: DashEvent }) {
  const src = e.hero_image_url || e.venues?.cover_url || null;
  return (
    <span className="relative hidden h-11 w-[60px] shrink-0 overflow-hidden rounded-[10px] border border-border bg-panel sm:block" aria-hidden>
      {src ? <Image src={src} alt="" fill sizes="60px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gold-soft to-transparent text-gold"><Sparkles size={16} /></span>}
    </span>
  );
}

function DjCell({ e }: { e: DashEvent }) {
  return e.djs ? (
    <span className="flex min-w-0 items-center gap-2">
      <DjAvatar name={e.djs.display_name} photoUrl={e.djs.photo_url} size={34} />
      <span className="truncate text-sm">{e.djs.display_name}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-status-declined/50 px-2 py-0.5 text-xs font-semibold text-status-declined">
      <Disc3 size={12} aria-hidden /> Unassigned
    </span>
  );
}

export function UpcomingEvents({ events, loading, error, layout, title = "Upcoming events", showDj = true }: { events: DashEvent[]; loading: boolean; error: boolean; layout: DashLayout; title?: string; showDj?: boolean }) {
  const links = useLinks();
  const rows = events.slice(0, 6);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return (
    <Panel layout={layout} aria-labelledby="dash-upcoming" data-tour="dash-upcoming">
      <PanelTitle
        layout={layout}
        id="dash-upcoming"
        action={
          <Link href={links.allProjects} className={cn("text-xs font-semibold text-gold hover:underline", FOCUS)}>
            View all{events.length ? ` (${events.length})` : ""}
          </Link>
        }
      >
        {title}
      </PanelTitle>
      {loading ? (
        <StateBox kind="loading" title="Loading events…" />
      ) : error ? (
        <StateBox kind="error" title="Events couldn't load" body="Refresh the page to try again." />
      ) : rows.length === 0 ? (
        <StateBox kind="empty" icon={CalendarClock} title="Nothing coming up" body="New events show here as soon as they're dated." />
      ) : (
        <>
          {/* Wide panel: table. Narrow panel (phone, or a side-by-side layout): cards. Decided by the panel's own width. */}
          <div className="@container">
          <div className="hidden @3xl:block">
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Next {rows.length} upcoming events</caption>
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-[1.2px] text-muted">
                  <th scope="col" className="w-[60px] pb-2 font-semibold">Date</th>
                  <th scope="col" className="pb-2 font-semibold">Event</th>
                  <th scope="col" className="hidden w-[15%] pb-2 font-semibold @6xl:table-cell">Venue</th>
                  {showDj && <th scope="col" className="w-[22%] pb-2 font-semibold @5xl:w-[19%]">DJ</th>}
                  <th scope="col" className="hidden w-[14%] pb-2 font-semibold @5xl:table-cell">Type</th>
                  <th scope="col" className="w-[108px] pb-2 font-semibold">Status</th>
                  <th scope="col" className="w-[76px] pb-2 text-right font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-b-0">
                    <td className="py-2.5 pr-2"><DateBadge iso={e.starts_at as string} /></td>
                    <td className="py-2.5 pr-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <Thumb e={e} />
                        <span className="min-w-0">
                          <Link href={links.project(e.id)} className={cn("block truncate font-semibold hover:text-gold", FOCUS)}>{e.title}</Link>
                          <span className="block truncate text-xs text-muted">
                            {time(e.starts_at as string)} · {clientName(e.clients, "No contact") ?? "No contact"}
                          </span>
                          <span className="block truncate text-xs text-muted @6xl:hidden">
                            {e.venues?.name ?? "No venue"}
                            <span className="@5xl:hidden"> · {typeLabel(e)}</span>
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="hidden py-2.5 pr-3 @6xl:table-cell">
                      {e.venues?.name ? (
                        <span className="flex min-w-0 items-center gap-1.5 text-muted"><MapPin size={13} className="shrink-0" aria-hidden /><span className="truncate">{e.venues.name}</span></span>
                      ) : (
                        <span className="text-muted">No venue</span>
                      )}
                    </td>
                    {showDj && <td className="py-2.5 pr-3"><DjCell e={e} /></td>}
                    <td className="hidden truncate py-2.5 pr-3 text-muted @5xl:table-cell">{typeLabel(e)}</td>
                    <td className="py-2.5 pr-2"><StatusPill status={e.status} /></td>
                    <td className="py-2.5 text-right">
                      <Link href={links.project(e.id)} className={cn("inline-flex h-8 items-center rounded-[8px] border border-border px-2.5 text-xs font-semibold hover:border-gold", FOCUS)} aria-label={`${e.djs ? "Open" : "Assign a DJ to"} ${e.title}`}>
                        {e.djs ? "Open" : "Assign"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-2 @xl:grid-cols-2 @3xl:hidden">
            {rows.map((e) => (
              <li key={e.id}>
                <Link href={links.project(e.id)} className={cn("flex gap-3 rounded-[14px] border border-border p-3 hover:border-gold", FOCUS)}>
                  <DateBadge iso={e.starts_at as string} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold">{e.title}</span>
                      <StatusPill status={e.status} />
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {time(e.starts_at as string)} · {typeLabel(e)}
                      {e.venues?.name ? ` · ${e.venues.name}` : ""}
                    </span>
                    {showDj && <span className="mt-2 block"><DjCell e={e} /></span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          </div>
        </>
      )}
    </Panel>
  );
}

/* ---------------- calendar ---------------- */

export function MiniCalendar({
  events,
  loading,
  error,
  layout,
  now,
  onMonth,
  monthNote
}: {
  events: DashEvent[];
  loading: boolean;
  error?: boolean;
  layout: DashLayout;
  now: Date;
  /** Told the first day of the month on screen whenever it changes (to load that month's dates). */
  onMonth?: (first: Date) => void;
  /** A line under the grid about the month on screen (e.g. "Loading this month…"). */
  monthNote?: React.ReactNode;
}) {
  const links = useLinks();
  const [cursor, setCursorState] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const setCursor = (d: Date) => {
    setCursorState(d);
    onMonth?.(d);
  };
  const [picked, setPicked] = useState<string | null>(null);
  const byDay = useMemo(() => eventsByDay(events), [events]);
  const grid = monthGrid(cursor);
  const todayKey = dayKey(now);
  const list = picked ? (byDay.get(picked) ?? []) : [];
  const fmtLong = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  };
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i)); // 2023-01-01 is a Sunday
  return (
    <Panel layout={layout} aria-labelledby="dash-cal" data-tour="dash-calendar">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="dash-cal" className="font-display text-[21px] font-light" aria-live="polite">
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className={cn("flex h-8 w-8 items-center justify-center rounded-[8px] border border-border hover:border-gold", FOCUS)} aria-label="Previous month">
            <ChevronLeft size={15} />
          </button>
          <button type="button" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))} className={cn("h-8 rounded-[8px] border border-border px-2 text-xs hover:border-gold", FOCUS)}>
            Today
          </button>
          <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className={cn("flex h-8 w-8 items-center justify-center rounded-[8px] border border-border hover:border-gold", FOCUS)} aria-label="Next month">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center">
        {weekdays.map((d) => (
          <div key={d.getDay()} aria-hidden className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            <abbr title={d.toLocaleDateString(undefined, { weekday: "long" })} className="no-underline">{d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)}</abbr>
          </div>
        ))}
        {grid.map((d) => {
          const k = dayKey(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const evs = byDay.get(k) ?? [];
          const isToday = k === todayKey;
          const isPicked = k === picked;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setPicked(isPicked ? null : k)}
              aria-pressed={isPicked}
              aria-label={`${fmtLong(k)}${isToday ? ", today" : ""}: ${evs.length ? `${evs.length} ${evs.length === 1 ? "event" : "events"}` : "no events"}`}
              className={cn("relative flex h-10 flex-col items-center justify-center rounded-[10px] text-sm tabular-nums hover:bg-black/5", FOCUS, !inMonth && "text-muted/50", isPicked && "bg-gold-soft")}
            >
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", isToday && "bg-gold font-semibold text-[var(--on-gold,#1a140a)]")}>{d.getDate()}</span>
              {evs.length > 0 && (
                <span className="absolute bottom-0.5 flex gap-0.5" aria-hidden>
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full", e.status === "away" ? "bg-muted/60" : e.status === "inquiry" ? "border border-gold" : "bg-gold")} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />Booked</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full border border-gold" aria-hidden />Inquiry</span>
          {events.some((e) => e.status === "away") && (
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-muted/60" aria-hidden />Away</span>
          )}
        </span>
        <Link href={links.calendar} className={cn("font-semibold text-gold hover:underline", FOCUS)}>Full calendar</Link>
      </div>
      {loading && <p className="mt-2 text-xs text-muted">Loading events…</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs text-status-declined">
          Events couldn&apos;t load, so the days show no events. Refresh to try again.
        </p>
      )}
      {monthNote && <div className="mt-2 text-xs text-muted">{monthNote}</div>}
      {picked && (
        <div className="mt-3 border-t border-border pt-3" aria-live="polite">
          <p className="mb-1.5 text-xs font-semibold">{fmtLong(picked)}</p>
          {list.length === 0 ? (
            <p className="text-xs text-muted">No events this day.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {list.map((e) => (
                <li key={e.id}>
                  <Link href={links.project(e.id)} className={cn("flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-sm hover:bg-black/5", FOCUS)}>
                    <span className="min-w-0 truncate">{e.title}</span>
                    <span className="shrink-0 text-xs text-muted">{e.all_day ? "All day" : new Date(e.starts_at as string).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ---------------- activity ---------------- */

const ACT_ICON: Record<ActivityItem["kind"], LucideIcon> = { lead: UserPlus, payment: CircleDollarSign, project: CalendarDays };

export function RecentActivity({ items, loading, error, layout, now }: { items: ActivityItem[]; loading: boolean; error: boolean; layout: DashLayout; now: Date }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 5);
  return (
    <Panel layout={layout} aria-labelledby="dash-activity" data-tour="dash-activity">
      <PanelTitle layout={layout} id="dash-activity">Recent activity</PanelTitle>
      {loading ? (
        <StateBox kind="loading" title="Loading…" />
      ) : error ? (
        <StateBox kind="error" title="Activity couldn't load" />
      ) : items.length === 0 ? (
        <StateBox kind="empty" title="No activity yet" />
      ) : (
        <>
          <ul className={cn("flex flex-col divide-y divide-border", all && "max-h-[420px] overflow-y-auto pr-1")}>
            {shown.map((a) => {
              const Icon = ACT_ICON[a.kind];
              return (
                <li key={a.key}>
                  <Link href={a.href} className={cn("flex items-start gap-3 py-2.5 hover:text-gold", FOCUS)}>
                    <Icon size={17} className="mt-0.5 shrink-0 text-gold" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {a.title}
                        {a.amountCents ? ` · ${money(a.amountCents)}` : ""}
                      </span>
                      <span className="block truncate text-xs text-muted">{a.detail}</span>
                    </span>
                    <time dateTime={a.at} title={new Date(a.at).toLocaleString()} className="shrink-0 text-[11px] text-muted">
                      {relativeTime(a.at, now)}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ul>
          {items.length > 5 && (
            <button type="button" onClick={() => setAll((v) => !v)} className={cn("mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline", FOCUS)} aria-expanded={all}>
              {all ? "Show less" : `View all (${items.length})`} <ArrowRight size={12} className={cn(all && "-rotate-90")} aria-hidden />
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
