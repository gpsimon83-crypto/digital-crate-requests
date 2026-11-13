/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Headphones,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Phone,
  Sparkles,
  Star,
  Users,
  X
} from "lucide-react";
import { Logo } from "@/components/site/logo";
import { VenueBanner } from "./venue-banner";
import { DAY_NAMES, fmtClock, type CoverFocus, type RecurringNight } from "@/lib/venue/types";
import { cn } from "@/lib/utils";

type Status = "confirmed" | "pending" | "cancelled";
type Focus = { x: number; y: number } | null;
interface EvDj {
  id: string | null;
  name: string;
  photo_url: string | null;
  focus?: Focus;
}
interface Ev {
  id: string;
  date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  label: string;
  status: Status;
  dj: EvDj | null;
  source?: "booking" | "calendar";
}
interface Holiday {
  key: string;
  name: string;
  date: string;
  note?: string;
  status: "none" | "pending" | "confirmed";
}
interface LineupDj {
  id: string;
  profile_id: string | null;
  name: string;
  photo_url: string | null;
  focus: Focus;
  bio: string | null;
  genres: string[];
  event_types: string[];
  upcoming_dates: string[];
}
interface Dashboard {
  preview: boolean;
  calendarFeed?: { names: number; status: "ok" | "off" | "error" | "no-names" };
  today: string;
  month: string;
  venues: { id: string; name: string }[];
  venue: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    location: string | null;
    logo_url: string | null;
    cover_url: string | null;
    cover_focus: CoverFocus;
    recurring_nights: RecurringNight[];
  };
  overview: { upcomingNights: number; assignedDjs: number; pendingApprovals: number; holidayRequests: number };
  upcoming: Ev[];
  monthEvents: Ev[];
  monthHolidays: { key: string; name: string; date: string }[];
  holidays: Holiday[];
  lineup: LineupDj[];
  messages: never[];
  contact: { name: string | null; email: string | null; phone: string | null };
}

/** Venue nights are booked and shown in the venue's local time (all partner venues are in Wisconsin/Illinois). */
const TZ = "America/Chicago";
const C = {
  card: "rounded-[14px] border border-[#c99428]/20 bg-[#141414] shadow-[0_6px_24px_rgba(0,0,0,0.35)]",
  eyebrow: "text-[10px] font-semibold uppercase tracking-[0.22em] text-[#e5b647]",
  muted: "text-[#b3aa9a]",
  link: "inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-xs font-medium text-[#e5b647] hover:text-[#f3cf73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5b647]"
};
const PRESS =
  "transition-[transform,box-shadow,border-color,background-color] duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100";
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5b647] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b]";

const NAV = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "lineup", label: "DJ Lineup", icon: Headphones },
  { id: "holidays", label: "Holidays", icon: Sparkles },
  { id: "messages", label: "Messages", icon: MessageSquare }
];

// Dates are venue-local calendar days ("2026-11-14"); noon avoids any day shift when formatting.
const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", opts);
// Times are real instants; always show them in the venue's time zone, never the viewer's.
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }) : "");
const timeRange = (e: Ev) => (e.starts_at ? `${fmtTime(e.starts_at)}${e.ends_at ? ` – ${fmtTime(e.ends_at)}` : ""}` : "Time to be confirmed");
const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (m: string) => fmtDay(`${m}-01`, { month: "long", year: "numeric" });
const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
};

function StatusPill({ status }: { status: Status | Holiday["status"] }) {
  const map = {
    confirmed: ["Confirmed", "bg-[#4f9b73]/15 text-[#8fdcb0] border-[#4f9b73]/45"],
    pending: ["Pending", "bg-[#d79a32]/15 text-[#f4c56e] border-[#d79a32]/45"],
    cancelled: ["Cancelled", "bg-[#c85b52]/15 text-[#ee9a93] border-[#c85b52]/45"],
    none: ["Not requested", "bg-white/5 text-[#b3aa9a] border-white/15"]
  } as const;
  const [label, cls] = map[status];
  return <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium", cls)}>{label}</span>;
}

/** Initials that keep a DJ's own spelling ("j.Prime" → "JP", "DJ Que" → "Q"). */
function initialsOf(name: string) {
  const parts = name.replace(/^dj\s+/i, "").split(/[\s.]+/).filter(Boolean);
  return (parts.map((p) => p[0]).join("").slice(0, 2) || "DJ").toUpperCase();
}

/** Circular DJ portrait: the real uploaded photo cropped around the face, or an initials badge. */
function Portrait({ name, url, focus, size, ring = true }: { name: string; url: string | null; focus?: Focus; size: number; ring?: boolean }) {
  const [broken, setBroken] = useState(false);
  const pos = focus ? `${focus.x}% ${focus.y}%` : "50% 22%";
  const border = ring ? "border-2 border-[#c99428]/55 shadow-[0_8px_22px_rgba(0,0,0,0.45)]" : "border border-[#c99428]/40";
  return url && !broken ? (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className={cn("shrink-0 rounded-full bg-[#1d1a14] object-cover", border)}
      style={{ width: size, height: size, objectPosition: pos }}
    />
  ) : (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#3a2e17,#17140e_70%)] font-display font-light text-[#f0c766]", border)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initialsOf(name)}
    </span>
  );
}

function Empty({ icon: Icon, title, body, action }: { icon: typeof Bell; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <Icon size={22} className="text-[#c99428]/80" />
      <p className="text-sm text-[#efe7d8]">{title}</p>
      <p className={cn("max-w-[300px] text-xs", C.muted)}>{body}</p>
      {action}
    </div>
  );
}

function Section({ id, title, action, children, className }: { id?: string; title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className={cn(C.card, "min-w-0 scroll-mt-20 p-4 sm:p-5", className)}>
      <div className="mb-3 flex min-h-11 items-center justify-between gap-2">
        <h2 id={id ? `${id}-h` : undefined} className={C.eyebrow}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function VenueDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const [profile, setProfile] = useState<LineupDj | null>(null);

  const venueParam = params.get("venue") ?? "";
  const monthParam = params.get("month") ?? "";
  const eventParam = params.get("event") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (venueParam) qs.set("venue", venueParam);
    if (monthParam) qs.set("month", monthParam);
    try {
      const res = await fetch(`/api/venue/dashboard?${qs}`);
      const json = await res.json();
      if (res.status === 401) {
        router.replace("/venue/login");
        return;
      }
      if (!res.ok) throw new Error(json.error || "Couldn't load your dashboard.");
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, [venueParam, monthParam, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function setQuery(patch: Record<string, string>) {
    const qs = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) qs.set(k, v);
      else qs.delete(k);
    }
    router.replace(`${pathname}${qs.size ? `?${qs}` : ""}`, { scroll: false });
  }

  // The open booking lives in the URL (?event=…), so details can be linked and the back button closes them.
  const allEvents = useMemo(() => {
    const m = new Map<string, Ev>();
    for (const e of [...(data?.upcoming ?? []), ...(data?.monthEvents ?? [])]) m.set(e.id, e);
    return m;
  }, [data]);
  const detail = eventParam ? allEvents.get(eventParam) ?? null : null;
  const openEvent = (e: Ev) => setQuery({ event: e.id });
  const closeEvent = () => setQuery({ event: "" });

  // Calendar: selected day defaults to today (or the 1st of another month).
  const month = data?.month ?? monthParam;
  const selected = pickedDay && pickedDay.startsWith(month) ? pickedDay : data ? (data.today.startsWith(data.month) ? data.today : `${data.month}-01`) : null;
  const goMonth = (m: string) => {
    setPickedDay(null);
    setQuery({ month: m === data?.today.slice(0, 7) ? "" : m, event: "" });
  };
  const goToday = () => {
    if (!data) return;
    setPickedDay(data.today);
    setQuery({ month: "", event: "" });
  };

  // Metric card actions: each opens the matching part of the dashboard.
  const viewSchedule = () => {
    setFilter("all");
    setShowAll(true);
    scrollToId("events");
  };
  const reviewRequests = () => {
    setFilter("pending");
    setShowAll(true);
    scrollToId("events");
  };
  const meetDjs = () => scrollToId("lineup");
  const planHolidays = () => {
    scrollToId("holidays");
    window.setTimeout(() => document.querySelector<HTMLElement>("#holidays [data-holiday-action]")?.focus({ preventScroll: true }), 350);
  };

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/venue/login");
    router.refresh();
  }

  if (error && !data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0b0b0b] px-4 text-[#efe7d8]">
        <div className={cn(C.card, "max-w-sm p-6 text-center")}>
          <Logo variant="icon" brand="crates-djs" size={40} />
          <p className="mt-4 text-sm">{error}</p>
          <button onClick={signOut} className={cn(C.link, "mt-3")}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const listed = (data?.upcoming ?? []).filter((e) => filter === "all" || e.status === "pending");
  const visible = showAll ? listed : listed.slice(0, 3);

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#0b0b0b] text-[#efe7d8]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-[#c99428]/15 bg-[#0e0e0e] px-3 py-5 lg:flex">
        <div className="flex items-center gap-2 px-2">
          <Logo variant="icon" brand="crates-djs" size={30} />
          <div className="leading-tight">
            <p className="text-[13px] font-semibold">Digital Crate DJs</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#c99428]">Venue Partner</p>
          </div>
        </div>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Venue portal">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className={cn("flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm text-[#cfc6b6] hover:bg-[#c99428]/10 hover:text-[#f6efe2]", FOCUS_RING)}>
              <n.icon size={16} className="text-[#c99428]" /> {n.label}
            </a>
          ))}
        </nav>
        {data?.contact.name && (
          <div className="mt-auto rounded-[12px] border border-[#c99428]/20 bg-[#141414] p-3 text-xs">
            <p className={C.eyebrow}>Your DCDJs contact</p>
            <p className="mt-1.5 text-sm">{data.contact.name}</p>
            {data.contact.phone && <a href={`tel:${data.contact.phone}`} className={cn("mt-1 block hover:text-[#e5b647]", C.muted)}>{data.contact.phone}</a>}
            {data.contact.email && <a href={`mailto:${data.contact.email}`} className={cn("block truncate hover:text-[#e5b647]", C.muted)}>{data.contact.email}</a>}
          </div>
        )}
      </aside>

      <div className="pb-24 lg:pb-8 lg:pl-56">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-[#c99428]/15 bg-[#0b0b0b]/90 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 py-2 sm:gap-3 lg:px-6">
            <span className="lg:hidden">
              <Logo variant="icon" brand="crates-djs" size={28} />
            </span>
            {data && data.venues.length > 1 ? (
              <select
                aria-label="Venue"
                value={data.venue.id}
                onChange={(e) => setQuery({ venue: e.target.value, month: "", event: "" })}
                className="min-h-11 min-w-0 max-w-[180px] truncate rounded-[10px] border border-[#c99428]/30 bg-[#141414] px-2.5 text-sm sm:max-w-[260px]"
              >
                {data.venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="min-w-0 truncate text-sm font-medium">{data?.venue.name ?? ""}</span>
            )}
            <span className="flex-1" />
            <a href="#messages" aria-label="Messages" className={cn("grid h-11 w-11 place-items-center rounded-full hover:bg-white/5", FOCUS_RING)}>
              <Bell size={17} />
            </a>
            <div className="relative">
              <button
                aria-label="Account menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className={cn("grid h-11 w-11 place-items-center rounded-full", FOCUS_RING)}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full border border-[#c99428]/40 bg-[#1d1a14] text-[11px] font-semibold text-[#e5b647]">
                  {(data?.venue.name ?? "V").slice(0, 1)}
                </span>
              </button>
              {menuOpen && (
                <div className={cn(C.card, "absolute right-0 top-12 w-48 p-1.5 text-sm")} role="menu">
                  <button role="menuitem" onClick={signOut} className="flex min-h-11 w-full items-center gap-2 rounded-[8px] px-3 text-left hover:bg-white/5">
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-4 lg:gap-5 lg:px-6">
          {data?.preview && (
            <p className="flex items-center gap-2 rounded-[10px] border border-[#4c86ff]/40 bg-[#4c86ff]/10 px-3 py-2 text-xs text-[#b9d0ff]">
              <Eye size={14} /> Admin preview: this is what the venue sees. Read-only.
            </p>
          )}
          {data?.preview && data.calendarFeed && data.calendarFeed.status !== "ok" && (
            <p className="rounded-[10px] border border-[#d79a32]/40 bg-[#d79a32]/10 px-3 py-2 text-xs text-[#f4c56e]">
              {data.calendarFeed.status === "no-names"
                ? "Admin note: add this venue's names under “Names on the DCDJ calendar” (Admin → Venue Portals → Manage) so its nights show up here."
                : data.calendarFeed.status === "off"
                  ? "Admin note: the DCDJ calendar link isn't set up yet (the partner key must be set on both the CRM and the WordPress site)."
                  : "Admin note: the DCDJ calendar couldn't be reached just now, so only CRM bookings are shown."}
            </p>
          )}
          {error && <p className="text-xs text-[#ee9a93]">{error}</p>}

          {!data ? (
            <div className="grid gap-4" aria-busy="true" aria-label="Loading your dashboard">
              <div className="aspect-[27/8] animate-pulse rounded-[14px] bg-[#141414] motion-reduce:animate-none md:aspect-[4/1]" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[132px] animate-pulse rounded-[14px] bg-[#141414] motion-reduce:animate-none" />
                ))}
              </div>
            </div>
          ) : (
            <div className={cn("flex flex-col gap-4 transition-opacity lg:gap-5", loading && "opacity-60")} aria-busy={loading}>
              <div id="overview" className="scroll-mt-20">
                <VenueBanner
                  name={data.venue.name}
                  subtitle={[data.venue.city, data.venue.state].filter(Boolean).join(", ") || data.venue.location}
                  logoUrl={data.venue.logo_url}
                  coverUrl={data.venue.cover_url}
                  focus={data.venue.cover_focus}
                />
              </div>

              {/* Top metrics: each whole card is one button that opens the matching section. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard image="/brand/venue-cards/upcoming-nights.webp" icon={CalendarDays} value={data.overview.upcomingNights} title="Upcoming nights" action="View schedule" onClick={viewSchedule} />
                <MetricCard image="/brand/venue-cards/assigned-djs.webp" icon={Users} value={data.overview.assignedDjs} title="Assigned DJs" action="Meet your DJs" onClick={meetDjs} />
                <MetricCard image="/brand/venue-cards/pending-confirmation.webp" icon={Clock} value={data.overview.pendingApprovals} title="Pending confirmation" action="Review requests" onClick={reviewRequests} />
                <MetricCard image="/brand/venue-cards/holiday-requests.webp" icon={Sparkles} value={data.overview.holidayRequests} title="Holiday requests" action="Plan holiday nights" onClick={planHolidays} />
              </div>

              {/* Events + lineup (≈62%) beside the calendar (≈38%); stacked events → calendar → lineup on smaller screens. */}
              <div className="grid grid-cols-1 gap-4 [grid-template-areas:'events'_'calendar'_'lineup'] lg:gap-5 xl:grid-cols-[minmax(0,62fr)_minmax(0,38fr)] xl:[grid-template-areas:'events_calendar'_'lineup_calendar']">
                <Section
                  id="events"
                  title={filter === "pending" ? "Awaiting confirmation" : "Upcoming events"}
                  className="[grid-area:events]"
                  action={
                    listed.length > 3 ? (
                      <button className={C.link} onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} aria-controls="events-list">
                        {showAll ? "Show fewer" : `View all (${listed.length})`}
                      </button>
                    ) : undefined
                  }
                >
                  {filter === "pending" && (
                    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-[10px] border border-[#d79a32]/30 bg-[#d79a32]/10 px-3 py-1.5 text-xs text-[#f4c56e]">
                      Showing bookings awaiting confirmation.
                      <button className={cn(C.link, "min-h-9")} onClick={() => setFilter("all")}>
                        Show all upcoming
                      </button>
                    </div>
                  )}
                  {visible.length ? (
                    <ul id="events-list" className="flex flex-col gap-2">
                      {visible.map((e) => (
                        <EventRow key={e.id} e={e} onOpen={() => openEvent(e)} />
                      ))}
                    </ul>
                  ) : filter === "pending" ? (
                    <Empty icon={Clock} title="Nothing waiting on confirmation" body="Every upcoming night is confirmed." action={<button className={C.link} onClick={() => setFilter("all")}>See all upcoming nights</button>} />
                  ) : (
                    <Empty
                      icon={CalendarDays}
                      title="No upcoming events yet"
                      body="Booked entertainment nights will show here as soon as they're on the schedule."
                      action={
                        data.contact.email ? (
                          <a className={C.link} href={`mailto:${data.contact.email}?subject=${encodeURIComponent(`Booking a night at ${data.venue.name}`)}`}>
                            <Mail size={14} /> Ask about booking a night
                          </a>
                        ) : undefined
                      }
                    />
                  )}
                </Section>

                <Section id="calendar" title="Calendar" className="self-start [grid-area:calendar] xl:sticky xl:top-20">
                  <CalendarPanel
                    data={data}
                    selected={selected}
                    onSelect={setPickedDay}
                    onPrev={() => goMonth(shiftMonth(month, -1))}
                    onNext={() => goMonth(shiftMonth(month, 1))}
                    onToday={goToday}
                    onOpen={openEvent}
                  />
                </Section>

                <Section id="lineup" title="DJ lineup" className="[grid-area:lineup]">
                  {data.lineup.length ? (
                    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {data.lineup.map((d) => (
                        <DjCard key={d.id} d={d} onOpen={() => setProfile(d)} />
                      ))}
                    </ul>
                  ) : (
                    <Empty icon={Headphones} title="Your DJ lineup is coming" body="The DJs booked at your venue will appear here with their next dates." />
                  )}
                </Section>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5 xl:grid-cols-3">
                <Section id="holidays" title="Holiday planning">
                  <ul className="flex flex-col divide-y divide-white/5">
                    {data.holidays.map((h) => (
                      <li key={h.key} className="flex items-center gap-3 py-2.5">
                        <div className="w-11 shrink-0 text-center">
                          <p className="text-[10px] uppercase text-[#c99428]">{fmtDay(h.date, { month: "short" })}</p>
                          <p className="font-display text-xl leading-none">{fmtDay(h.date, { day: "numeric" })}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{h.name}</p>
                          <p className={cn("text-[11px]", C.muted)}>
                            {fmtDay(h.date, { weekday: "long" })}
                            {h.note ? ` · ${h.note}` : ""}
                          </p>
                        </div>
                        {h.status === "none" && (data.contact.email || data.contact.phone) ? (
                          <a
                            data-holiday-action=""
                            className={cn(C.link, "shrink-0 border border-[#c99428]/35")}
                            href={
                              data.contact.email
                                ? `mailto:${data.contact.email}?subject=${encodeURIComponent(`${h.name} at ${data.venue.name}`)}&body=${encodeURIComponent(`Hi${data.contact.name ? ` ${data.contact.name}` : ""},\n\nWe'd like a DJ for ${h.name} (${fmtDay(h.date, { weekday: "long", month: "long", day: "numeric" })}) at ${data.venue.name}.\n\nThanks!`)}`
                                : `tel:${data.contact.phone}`
                            }
                          >
                            Request
                          </a>
                        ) : (
                          <StatusPill status={h.status} />
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className={cn("mt-2 text-[11px]", C.muted)}>
                    Holidays book up first. {data.contact.email || data.contact.phone ? "Tap Request to ask your DCDJs contact for that night." : "Talk to your DCDJs contact to plan these nights early."}
                  </p>
                </Section>

                <Section id="messages" title="Recent messages">
                  <Empty
                    icon={MessageSquare}
                    title="No messages yet"
                    body="Schedule updates and notes from Digital Crate DJs will appear here."
                    action={
                      data.contact.email ? (
                        <a className={C.link} href={`mailto:${data.contact.email}`}>
                          <Mail size={14} /> Email your DCDJs contact
                        </a>
                      ) : undefined
                    }
                  />
                </Section>

                <Section title="Your entertainment nights" className="md:col-span-2 xl:col-span-1">
                  {data.venue.recurring_nights.length ? (
                    <ul className="flex flex-col gap-2">
                      {data.venue.recurring_nights.map((n, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded-[10px] border border-white/5 bg-black/20 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm">{n.label || `${DAY_NAMES[n.day]} night`}</p>
                            <p className={cn("text-[11px]", C.muted)}>Every {DAY_NAMES[n.day]}</p>
                          </div>
                          <span className="shrink-0 text-xs text-[#e5b647]">
                            {fmtClock(n.start)} – {fmtClock(n.end)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={cn("text-xs", C.muted)}>Your regular DJ nights will be listed here.</p>
                  )}
                  {(data.contact.name || data.contact.phone || data.contact.email) && (
                    <div className="mt-4 border-t border-white/5 pt-3 lg:hidden">
                      <p className={C.eyebrow}>Your DCDJs contact</p>
                      <p className="mt-1 text-sm">{data.contact.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {data.contact.phone && (
                          <a href={`tel:${data.contact.phone}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#c99428]/30 px-4 text-xs">
                            <Phone size={12} /> Call
                          </a>
                        )}
                        {data.contact.email && (
                          <a href={`mailto:${data.contact.email}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#c99428]/30 px-4 text-xs">
                            <Mail size={12} /> Email
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </Section>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#c99428]/20 bg-[#0e0e0e]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Venue portal">
        {NAV.map((n) => (
          <a key={n.id} href={`#${n.id}`} className="flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] text-[#cfc6b6] active:text-[#e5b647]">
            <n.icon size={18} className="text-[#c99428]" />
            {n.label === "DJ Lineup" ? "DJs" : n.label === "Dashboard" ? "Home" : n.label}
          </a>
        ))}
      </nav>

      {detail && <EventDetail e={detail} venue={data?.venue.name ?? ""} onClose={closeEvent} onProfile={(dj) => { const l = data?.lineup.find((x) => (dj.id && x.profile_id === dj.id) || x.name === dj.name); if (l) { closeEvent(); setProfile(l); } }} />}
      {profile && data && <DjProfile d={profile} onClose={() => setProfile(null)} onOpenEvent={(e) => { setProfile(null); openEvent(e); }} events={data.upcoming.filter((e) => e.dj && ((profile.profile_id && e.dj.id === profile.profile_id) || e.dj.name === profile.name))} />}
    </div>
  );
}

/** A metric card: the photo sits on the right, the left stays dark for the live count and its action. */
function MetricCard({ image, icon: Icon, value, title, action, onClick }: { image: string; icon: typeof Bell; value: number; title: string; action: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title}: ${value}. ${action}`}
      className={cn(
        "group relative isolate flex min-h-[132px] cursor-pointer flex-col justify-between overflow-hidden rounded-[14px] border border-[#c99428]/25 bg-[#111] p-4 text-left shadow-[0_6px_24px_rgba(0,0,0,0.35)] hover:border-[#e5b647]/70 hover:shadow-[0_14px_34px_rgba(0,0,0,0.55),0_0_0_1px_rgba(229,182,71,0.25)] active:border-[#f3cf73]",
        PRESS,
        FOCUS_RING
      )}
      style={{ backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "right center" }}
    >
      {/* Keeps the left side dark enough for the text at any card width. */}
      <span aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(10,10,10,0.96)_0%,rgba(10,10,10,0.88)_38%,rgba(10,10,10,0.35)_72%,rgba(10,10,10,0.15)_100%)]" />
      <span className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#c99428]/45 bg-black/50 text-[#e5b647]">
          <Icon size={17} />
        </span>
        <span className="font-display text-[34px] font-light leading-none text-[#f6efe2]">{value}</span>
      </span>
      <span className="mt-3 block">
        <span className="block text-sm font-medium text-[#f1e9da]">{title}</span>
        <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[#e5b647] group-hover:text-[#f3cf73]">
          {action}
          <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
        </span>
      </span>
    </button>
  );
}

function DateTile({ iso }: { iso: string }) {
  return (
    <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-[12px] border border-[#c99428]/30 bg-black/30 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#c99428]">{fmtDay(iso, { weekday: "short" })}</span>
      <span className="font-display text-2xl leading-none text-[#f6efe2]">{fmtDay(iso, { day: "numeric" })}</span>
      <span className="text-[10px] uppercase text-[#b3aa9a]">{fmtDay(iso, { month: "short" })}</span>
    </div>
  );
}

function EventRow({ e, onOpen }: { e: Ev; onOpen: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[12px] border border-white/[0.06] bg-black/20 p-3 sm:flex-nowrap sm:gap-4">
      {e.date && <DateTile iso={e.date} />}
      <span className="hidden sm:block">
        <Portrait name={e.dj?.name ?? "DJ"} url={e.dj?.photo_url ?? null} focus={e.dj?.focus} size={76} />
      </span>
      <span className="sm:hidden">
        <Portrait name={e.dj?.name ?? "DJ"} url={e.dj?.photo_url ?? null} focus={e.dj?.focus} size={56} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-[#f6efe2]">{e.dj?.name ?? "DJ to be assigned"}</p>
        <p className={cn("truncate text-xs", C.muted)}>{e.label}</p>
        <p className="mt-0.5 text-xs text-[#e9dfcd]">
          {e.date ? fmtDay(e.date, { weekday: "short", month: "short", day: "numeric" }) : "Date to be set"} · {timeRange(e)}
        </p>
      </div>
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end">
        <StatusPill status={e.status} />
        <button onClick={onOpen} className={cn(C.link, "border border-[#c99428]/30")} aria-label={`View details for ${e.dj?.name ?? "this night"} on ${e.date ? fmtDay(e.date, { month: "long", day: "numeric" }) : "an unscheduled date"}`}>
          View details <ArrowRight size={13} />
        </button>
      </div>
    </li>
  );
}

function DjCard({ d, onOpen }: { d: LineupDj; onOpen: () => void }) {
  const next = d.upcoming_dates[0];
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`View profile: ${d.name}`}
        className={cn(
          "group flex h-full w-full flex-col items-center gap-2 rounded-[14px] border border-[#c99428]/20 bg-[linear-gradient(180deg,#1a1712,#121212)] px-3 pb-3 pt-4 text-center hover:border-[#e5b647]/60 hover:shadow-[0_12px_28px_rgba(0,0,0,0.5)] active:border-[#f3cf73]",
          PRESS,
          FOCUS_RING
        )}
      >
        <span className="sm:hidden">
          <Portrait name={d.name} url={d.photo_url} focus={d.focus} size={100} />
        </span>
        <span className="hidden sm:block">
          <Portrait name={d.name} url={d.photo_url} focus={d.focus} size={116} />
        </span>
        <span className="mt-1 line-clamp-2 block w-full break-words font-display text-base font-light leading-snug text-[#f6efe2] sm:text-lg">{d.name}</span>
        <span className={cn("block text-xs", next ? "text-[#e5b647]" : C.muted)}>
          {next ? `Next: ${fmtDay(next, { weekday: "short", month: "short", day: "numeric" })}` : "No date scheduled yet"}
        </span>
        <span className="mt-auto inline-flex min-h-11 items-center gap-1 text-xs font-medium text-[#e5b647] group-hover:text-[#f3cf73]">
          View profile <ArrowRight size={13} />
        </span>
      </button>
    </li>
  );
}

function CalendarPanel({
  data,
  selected,
  onSelect,
  onPrev,
  onNext,
  onToday,
  onOpen
}: {
  data: Dashboard;
  selected: string | null;
  onSelect: (d: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpen: (e: Ev) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const cells = useMemo(() => {
    const [y, m] = data.month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const out: (string | null)[] = Array(first).fill(null);
    for (let d = 1; d <= days; d++) out.push(`${data.month}-${String(d).padStart(2, "0")}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [data.month]);
  const nightDays = new Set(data.venue.recurring_nights.map((n) => n.day));
  const isThisMonth = data.today.startsWith(data.month);
  const dayEvents = selected ? data.monthEvents.filter((e) => e.date === selected) : [];
  const dayHolidays = selected ? data.monthHolidays.filter((h) => h.date === selected) : [];

  // Arrow keys move between days (roving focus), Enter/Space selects.
  function onKey(ev: React.KeyboardEvent<HTMLButtonElement>, iso: string) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key as "ArrowLeft"];
    if (!step) return;
    ev.preventDefault();
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + step);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!next.startsWith(data.month)) return;
    onSelect(next);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus();
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button onClick={onPrev} aria-label="Previous month" className={cn("grid h-11 w-11 place-items-center rounded-[10px] border border-[#c99428]/30 hover:border-[#e5b647]/70 hover:text-[#e5b647]", FOCUS_RING)}>
          <ChevronLeft size={16} />
        </button>
        <p className="flex-1 text-center font-display text-lg font-light" aria-live="polite">
          {monthLabel(data.month)}
        </p>
        <button onClick={onNext} aria-label="Next month" className={cn("grid h-11 w-11 place-items-center rounded-[10px] border border-[#c99428]/30 hover:border-[#e5b647]/70 hover:text-[#e5b647]", FOCUS_RING)}>
          <ChevronRight size={16} />
        </button>
        <button
          onClick={onToday}
          disabled={isThisMonth && selected === data.today}
          className={cn("min-h-11 rounded-[10px] border border-[#c99428]/40 px-3 text-xs font-medium text-[#e5b647] hover:border-[#e5b647] disabled:opacity-40", FOCUS_RING)}
        >
          Today
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] uppercase text-[#b3aa9a]" aria-hidden>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <span key={d} className="py-1">
            {d.slice(0, 1)}
          </span>
        ))}
      </div>
      <div ref={gridRef} className="grid grid-cols-7 gap-1" role="grid" aria-label={`${monthLabel(data.month)} calendar`}>
        {cells.map((iso, i) => {
          if (!iso) return <span key={i} aria-hidden />;
          const evs = data.monthEvents.filter((e) => e.date === iso);
          const hol = data.monthHolidays.find((h) => h.date === iso);
          const dow = new Date(`${iso}T12:00:00`).getDay();
          const isToday = iso === data.today;
          const isSel = iso === selected;
          const label = [
            fmtDay(iso, { weekday: "long", month: "long", day: "numeric" }),
            isToday ? "today" : "",
            evs.length ? `${evs.length} night${evs.length > 1 ? "s" : ""} booked` : "",
            hol ? hol.name : ""
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <button
              key={iso}
              data-day={iso}
              role="gridcell"
              tabIndex={isSel ? 0 : -1}
              onClick={() => onSelect(iso)}
              onKeyDown={(ev) => onKey(ev, iso)}
              aria-label={label}
              aria-selected={isSel}
              className={cn(
                "relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-[10px] border text-sm transition-colors motion-reduce:transition-none",
                isSel ? "border-[#e5b647] bg-[#c99428]/25 text-[#fff6e0]" : "border-transparent hover:border-[#c99428]/40",
                !isSel && nightDays.has(dow) && "bg-white/[0.035]",
                isToday && !isSel && "font-semibold text-[#e5b647] ring-1 ring-inset ring-[#e5b647]/50",
                FOCUS_RING
              )}
            >
              {Number(iso.slice(8))}
              <span className="absolute bottom-1.5 flex gap-0.5">
                {evs.slice(0, 3).map((e) => (
                  <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full", e.status === "confirmed" ? "bg-[#8fdcb0]" : e.status === "pending" ? "bg-[#f4c56e]" : "bg-[#ee9a93]")} />
                ))}
              </span>
              {hol && <Star size={9} className="absolute right-1 top-1 fill-[#e5b647] text-[#e5b647]" aria-hidden />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#b3aa9a]" aria-label="Legend">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#8fdcb0]" /> Confirmed</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#f4c56e]" /> Pending</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#ee9a93]" /> Cancelled</span>
        <span className="flex items-center gap-1.5"><Star size={10} className="fill-[#e5b647] text-[#e5b647]" /> Holiday</span>
        {nightDays.size > 0 && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-white/15" /> Regular night</span>}
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm ring-1 ring-[#e5b647]/60" /> Today</span>
      </div>

      {selected && (
        <div className="mt-4 border-t border-white/5 pt-3" aria-live="polite">
          <p className="text-sm font-medium">{fmtDay(selected, { weekday: "long", month: "long", day: "numeric" })}</p>
          {dayHolidays.map((h) => (
            <p key={h.key} className="mt-1 flex items-center gap-1.5 text-xs text-[#e5b647]">
              <Star size={12} /> {h.name}
            </p>
          ))}
          {dayEvents.length ? (
            <ul className="mt-2 flex flex-col gap-2">
              {dayEvents.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => onOpen(e)}
                    className={cn("flex min-h-11 w-full items-center gap-3 rounded-[10px] border border-white/[0.06] bg-black/20 p-2 text-left hover:border-[#e5b647]/50", FOCUS_RING)}
                  >
                    <Portrait name={e.dj?.name ?? "DJ"} url={e.dj?.photo_url ?? null} focus={e.dj?.focus} size={40} ring={false} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{e.dj?.name ?? "DJ to be assigned"}</span>
                      <span className={cn("block truncate text-[11px]", C.muted)}>
                        {e.label} · {timeRange(e)}
                      </span>
                    </span>
                    <StatusPill status={e.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn("mt-1 text-xs", C.muted)}>Nothing scheduled this day.</p>
          )}
        </div>
      )}
    </div>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function Dialog({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  useEscape(onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 sm:items-center" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(C.card, "max-h-[88dvh] w-full max-w-md overflow-y-auto p-5")}
        onClick={(ev) => ev.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function EventDetail({ e, venue, onClose, onProfile }: { e: Ev; venue: string; onClose: () => void; onProfile: (dj: EvDj) => void }) {
  return (
    <Dialog label="Event details" onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={C.eyebrow}>Event details</p>
          <p className="mt-1 font-display text-2xl font-light">{e.date ? fmtDay(e.date, { weekday: "long", month: "long", day: "numeric" }) : "Date to be set"}</p>
          <p className={cn("text-xs", C.muted)}>{venue}</p>
        </div>
        <button data-autofocus onClick={onClose} aria-label="Close" className={cn("grid h-11 w-11 place-items-center rounded-full text-[#b3aa9a] hover:text-[#efe7d8]", FOCUS_RING)}>
          <X size={18} />
        </button>
      </div>
      {e.dj && (
        <div className="mt-4 flex items-center gap-4 rounded-[12px] border border-white/[0.06] bg-black/25 p-3">
          <Portrait name={e.dj.name} url={e.dj.photo_url} focus={e.dj.focus} size={76} />
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-light">{e.dj.name}</p>
            <button className={cn(C.link, "-ml-2")} onClick={() => onProfile(e.dj!)}>
              View profile <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
      <dl className="mt-4 grid grid-cols-[96px_1fr] gap-y-2.5 text-sm">
        <dt className={C.muted}>Event</dt>
        <dd>{e.label}</dd>
        <dt className={C.muted}>Time</dt>
        <dd>
          {timeRange(e)}
          {e.starts_at && <span className={cn("block text-[11px]", C.muted)}>Central Time (venue local)</span>}
        </dd>
        <dt className={C.muted}>DJ</dt>
        <dd>{e.dj ? e.dj.name : "To be assigned"}</dd>
        <dt className={C.muted}>Status</dt>
        <dd>
          <StatusPill status={e.status} />
        </dd>
      </dl>
    </Dialog>
  );
}

function DjProfile({ d, events, onClose, onOpenEvent }: { d: LineupDj; events: Ev[]; onClose: () => void; onOpenEvent: (e: Ev) => void }) {
  return (
    <Dialog label={`${d.name} profile`} onClose={onClose}>
      <div className="flex justify-end">
        <button data-autofocus onClick={onClose} aria-label="Close" className={cn("grid h-11 w-11 place-items-center rounded-full text-[#b3aa9a] hover:text-[#efe7d8]", FOCUS_RING)}>
          <X size={18} />
        </button>
      </div>
      <div className="-mt-6 flex flex-col items-center text-center">
        <Portrait name={d.name} url={d.photo_url} focus={d.focus} size={132} />
        <p className={cn(C.eyebrow, "mt-3")}>Digital Crate DJs</p>
        <p className="font-display text-3xl font-light text-[#f6efe2]">{d.name}</p>
      </div>
      {d.genres.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {d.genres.map((g) => (
            <span key={g} className="rounded-full border border-[#c99428]/30 bg-[#c99428]/10 px-2.5 py-1 text-[11px] text-[#ecd9a8]">
              {g}
            </span>
          ))}
        </div>
      )}
      {d.bio && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#ddd3c2]">{d.bio}</p>}
      {d.event_types.length > 0 && (
        <p className={cn("mt-3 text-xs", C.muted)}>
          Plays: {d.event_types.join(" · ")}
        </p>
      )}
      <div className="mt-5">
        <p className={C.eyebrow}>At your venue</p>
        {events.length ? (
          <ul className="mt-2 flex flex-col gap-2">
            {events.slice(0, 6).map((e) => (
              <li key={e.id}>
                <button onClick={() => onOpenEvent(e)} className={cn("flex min-h-11 w-full items-center justify-between gap-2 rounded-[10px] border border-white/[0.06] bg-black/20 px-3 py-2 text-left text-sm hover:border-[#e5b647]/50", FOCUS_RING)}>
                  <span>
                    {e.date ? fmtDay(e.date, { weekday: "short", month: "short", day: "numeric" }) : "Date to be set"}
                    <span className={cn("block text-[11px]", C.muted)}>{timeRange(e)}</span>
                  </span>
                  <StatusPill status={e.status} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn("mt-1 text-xs", C.muted)}>No upcoming dates here yet.</p>
        )}
      </div>
    </Dialog>
  );
}
