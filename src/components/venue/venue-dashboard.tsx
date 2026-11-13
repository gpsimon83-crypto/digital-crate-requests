/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
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
interface Ev {
  id: string;
  date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  label: string;
  status: Status;
  dj: { name: string; photo_url: string | null } | null;
}
interface Holiday {
  key: string;
  name: string;
  date: string;
  note?: string;
  status: "none" | "pending" | "confirmed";
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
  lineup: { id: string; name: string; photo_url: string | null; specialties: string[]; upcoming_dates: string[] }[];
  messages: never[];
  contact: { name: string | null; email: string | null; phone: string | null };
}

const TZ = "America/Chicago";
const C = {
  card: "rounded-[14px] border border-[#c99428]/20 bg-[#141414] shadow-[0_6px_24px_rgba(0,0,0,0.35)]",
  eyebrow: "text-[10px] font-semibold uppercase tracking-[0.22em] text-[#e5b647]",
  muted: "text-[#a59d8f]"
};

const NAV = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "lineup", label: "DJ Lineup", icon: Headphones },
  { id: "holidays", label: "Holidays", icon: Sparkles },
  { id: "messages", label: "Messages", icon: MessageSquare }
];

const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", opts);
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }) : "");
const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (m: string) => fmtDay(`${m}-01`, { month: "long", year: "numeric" });

function StatusPill({ status }: { status: Status | Holiday["status"] }) {
  const map = {
    confirmed: ["Confirmed", "bg-[#4f9b73]/15 text-[#7fcfa2] border-[#4f9b73]/40"],
    pending: ["Pending", "bg-[#d79a32]/15 text-[#f0bd62] border-[#d79a32]/40"],
    cancelled: ["Cancelled", "bg-[#c85b52]/15 text-[#e58b84] border-[#c85b52]/40"],
    none: ["Not requested", "bg-white/5 text-[#a59d8f] border-white/10"]
  } as const;
  const [label, cls] = map[status];
  return <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", cls)}>{label}</span>;
}

function Avatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  const initials = name.replace(/^dj\s+/i, "").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return url ? (
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full border border-[#c99428]/40 object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full border border-[#c99428]/40 bg-[#1d1a14] text-[11px] font-semibold text-[#e5b647]" style={{ width: size, height: size }}>
      {initials || "DJ"}
    </span>
  );
}

function Empty({ icon: Icon, title, body }: { icon: typeof Bell; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <Icon size={22} className="text-[#c99428]/70" />
      <p className="text-sm text-[#efe7d8]">{title}</p>
      <p className={cn("max-w-[260px] text-xs", C.muted)}>{body}</p>
    </div>
  );
}

function Section({ id, title, action, children, className }: { id?: string; title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn(C.card, "min-w-0 scroll-mt-20 p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={C.eyebrow}>{title}</h2>
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
  const [detail, setDetail] = useState<Ev | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const venueParam = params.get("venue") ?? "";
  const monthParam = params.get("month") ?? "";

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
    setPickedDay(null);
    router.replace(`${pathname}?${qs}`, { scroll: false });
  }

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
          <button onClick={signOut} className="mt-5 text-xs text-[#e5b647] hover:underline">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const month = data?.month ?? monthParam;

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
            <a key={n.id} href={`#${n.id}`} className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-[#cfc6b6] hover:bg-[#c99428]/10 hover:text-[#f6efe2]">
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
          <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 py-2.5 sm:gap-3 lg:px-6">
            <span className="lg:hidden">
              <Logo variant="icon" brand="crates-djs" size={28} />
            </span>
            {data && data.venues.length > 1 ? (
              <select
                aria-label="Venue"
                value={data.venue.id}
                onChange={(e) => setQuery({ venue: e.target.value })}
                className="min-w-0 max-w-[180px] truncate rounded-[10px] border border-[#c99428]/30 bg-[#141414] px-2.5 py-1.5 text-sm sm:max-w-[260px]"
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
            {month && (
              <div className="flex items-center rounded-[10px] border border-[#c99428]/30 bg-[#141414]">
                <button aria-label="Previous month" className="p-1.5 hover:text-[#e5b647]" onClick={() => setQuery({ month: shiftMonth(month, -1) })}>
                  <ChevronLeft size={16} />
                </button>
                <span className="w-[92px] text-center text-xs sm:w-[120px] sm:text-sm">{monthLabel(month)}</span>
                <button aria-label="Next month" className="p-1.5 hover:text-[#e5b647]" onClick={() => setQuery({ month: shiftMonth(month, 1) })}>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            <a href="#messages" aria-label="Notifications" className="relative rounded-full p-2 hover:bg-white/5">
              <Bell size={17} />
            </a>
            <div className="relative">
              <button
                aria-label="Account menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="grid h-8 w-8 place-items-center rounded-full border border-[#c99428]/40 bg-[#1d1a14] text-[11px] font-semibold text-[#e5b647]"
              >
                {(data?.venue.name ?? "V").slice(0, 1)}
              </button>
              {menuOpen && (
                <div className={cn(C.card, "absolute right-0 top-10 w-48 p-1.5 text-sm")} role="menu">
                  <button role="menuitem" onClick={signOut} className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left hover:bg-white/5">
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-4 lg:px-6">
          {data?.preview && (
            <p className="flex items-center gap-2 rounded-[10px] border border-[#4c86ff]/40 bg-[#4c86ff]/10 px-3 py-2 text-xs text-[#a9c4ff]">
              <Eye size={14} /> Admin preview: this is what the venue sees. Read-only.
            </p>
          )}
          {data?.preview && data.calendarFeed && data.calendarFeed.status !== "ok" && (
            <p className="rounded-[10px] border border-[#d79a32]/40 bg-[#d79a32]/10 px-3 py-2 text-xs text-[#f0bd62]">
              {data.calendarFeed.status === "no-names"
                ? "Admin note: add this venue's names under “Names on the DCDJ calendar” (Admin → Venue Portals → Manage) so its nights show up here."
                : data.calendarFeed.status === "off"
                  ? "Admin note: the DCDJ calendar link isn't set up yet (the partner key must be set on both the CRM and the WordPress site)."
                  : "Admin note: the DCDJ calendar couldn't be reached just now, so only CRM bookings are shown."}
            </p>
          )}
          {error && <p className="text-xs text-[#e58b84]">{error}</p>}

          {!data ? (
            <div className="grid gap-4">
              <div className="aspect-[27/8] animate-pulse rounded-[14px] bg-[#141414] md:aspect-[4/1]" />
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-[14px] bg-[#141414]" />
                ))}
              </div>
            </div>
          ) : (
            <div className={cn("flex flex-col gap-4 transition-opacity", loading && "opacity-60")}>
              <div id="overview" className="scroll-mt-20">
                <VenueBanner
                  name={data.venue.name}
                  subtitle={[data.venue.city, data.venue.state].filter(Boolean).join(", ") || data.venue.location}
                  logoUrl={data.venue.logo_url}
                  coverUrl={data.venue.cover_url}
                  focus={data.venue.cover_focus}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat icon={CalendarDays} label="Upcoming nights" value={data.overview.upcomingNights} />
                <Stat icon={Users} label="Assigned DJs" value={data.overview.assignedDjs} />
                <Stat icon={Clock} label="Pending confirmation" value={data.overview.pendingApprovals} />
                <Stat icon={Sparkles} label="Holiday requests" value={data.overview.holidayRequests} />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Section title="Upcoming events">
                  {data.upcoming.length ? (
                    <ul className="flex flex-col divide-y divide-white/5">
                      {data.upcoming.map((e) => (
                        <EventRow key={e.id} e={e} onOpen={() => setDetail(e)} />
                      ))}
                    </ul>
                  ) : (
                    <Empty icon={CalendarDays} title="No upcoming events yet" body="Booked entertainment nights will show here as soon as they're on the schedule." />
                  )}
                </Section>

                <Section id="calendar" title={monthLabel(data.month)}>
                  <MonthGrid data={data} picked={pickedDay} onPick={setPickedDay} />
                  {pickedDay && (
                    <div className="mt-3 border-t border-white/5 pt-3">
                      <p className="text-xs font-medium">{fmtDay(pickedDay, { weekday: "long", month: "long", day: "numeric" })}</p>
                      {data.monthHolidays.filter((h) => h.date === pickedDay).map((h) => (
                        <p key={h.key} className="mt-1 flex items-center gap-1.5 text-xs text-[#e5b647]">
                          <Star size={12} /> {h.name}
                        </p>
                      ))}
                      {data.monthEvents.filter((e) => e.date === pickedDay).length ? (
                        <ul className="mt-1 divide-y divide-white/5">
                          {data.monthEvents.filter((e) => e.date === pickedDay).map((e) => (
                            <EventRow key={e.id} e={e} onOpen={() => setDetail(e)} compact />
                          ))}
                        </ul>
                      ) : (
                        <p className={cn("mt-1 text-xs", C.muted)}>Nothing scheduled.</p>
                      )}
                    </div>
                  )}
                </Section>

                <Section id="lineup" title="DJ lineup">
                  {data.lineup.length ? (
                    <ul className="flex flex-col gap-3">
                      {data.lineup.map((d) => (
                        <li key={d.id} className="flex items-center gap-3">
                          <Avatar name={d.name} url={d.photo_url} size={44} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{d.name}</p>
                            {d.specialties.length > 0 && <p className={cn("truncate text-xs", C.muted)}>{d.specialties.join(" · ")}</p>}
                            <p className="text-[11px] text-[#e5b647]/90">
                              {d.upcoming_dates.length ? `Next: ${d.upcoming_dates.map((x) => fmtDay(x, { month: "short", day: "numeric" })).join(", ")}` : "No dates scheduled"}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty icon={Headphones} title="Your DJ lineup is coming" body="The DJs who play your venue will appear here." />
                  )}
                </Section>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Section id="holidays" title="Holiday planning">
                  <ul className="flex flex-col divide-y divide-white/5">
                    {data.holidays.map((h) => (
                      <li key={h.key} className="flex items-center gap-3 py-2">
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
                        <StatusPill status={h.status} />
                      </li>
                    ))}
                  </ul>
                  <p className={cn("mt-2 text-[11px]", C.muted)}>Holidays book up first. Talk to your DCDJs contact to plan these nights early.</p>
                </Section>

                <Section id="messages" title="Recent messages">
                  <Empty icon={MessageSquare} title="No messages yet" body="Schedule updates and notes from Digital Crate DJs will appear here." />
                </Section>

                <Section title="Your entertainment nights">
                  {data.venue.recurring_nights.length ? (
                    <ul className="flex flex-col gap-2">
                      {data.venue.recurring_nights.map((n, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded-[10px] border border-white/5 bg-black/20 px-3 py-2">
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
                          <a href={`tel:${data.contact.phone}`} className="inline-flex items-center gap-1.5 rounded-full border border-[#c99428]/30 px-3 py-1.5 text-xs">
                            <Phone size={12} /> Call
                          </a>
                        )}
                        {data.contact.email && (
                          <a href={`mailto:${data.contact.email}`} className="inline-flex items-center gap-1.5 rounded-full border border-[#c99428]/30 px-3 py-1.5 text-xs">
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
          <a key={n.id} href={`#${n.id}`} className="flex flex-col items-center gap-1 py-2.5 text-[10px] text-[#cfc6b6] active:text-[#e5b647]">
            <n.icon size={18} className="text-[#c99428]" />
            {n.label === "DJ Lineup" ? "DJs" : n.label === "Dashboard" ? "Home" : n.label}
          </a>
        ))}
      </nav>

      {detail && <EventDetail e={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Bell; label: string; value: number }) {
  return (
    <div className={cn(C.card, "flex items-center gap-3 p-3 sm:p-4")}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#c99428]/35 bg-[#c99428]/10 text-[#e5b647]">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="font-display text-2xl leading-none">{value}</p>
        <p className={cn("mt-1 truncate text-[11px]", C.muted)}>{label}</p>
      </div>
    </div>
  );
}

function EventRow({ e, onOpen, compact }: { e: Ev; onOpen: () => void; compact?: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      {!compact && e.date && (
        <div className="w-11 shrink-0 text-center">
          <p className="text-[10px] uppercase text-[#c99428]">{fmtDay(e.date, { weekday: "short" })}</p>
          <p className="font-display text-xl leading-none">{fmtDay(e.date, { day: "numeric" })}</p>
          <p className="text-[9px] uppercase text-[#a59d8f]">{fmtDay(e.date, { month: "short" })}</p>
        </div>
      )}
      {e.dj && <Avatar name={e.dj.name} url={e.dj.photo_url} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{e.dj?.name ?? "DJ to be assigned"}</p>
        <p className="truncate text-[11px] text-[#a59d8f]">
          {e.label}
          {e.starts_at ? ` · ${fmtTime(e.starts_at)}${e.ends_at ? `–${fmtTime(e.ends_at)}` : ""}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusPill status={e.status} />
        <button onClick={onOpen} className="text-[11px] text-[#e5b647] hover:underline">
          Details
        </button>
      </div>
    </li>
  );
}

function MonthGrid({ data, picked, onPick }: { data: Dashboard; picked: string | null; onPick: (d: string | null) => void }) {
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

  return (
    <div>
      <div className="grid grid-cols-7 text-center text-[10px] uppercase text-[#a59d8f]">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, i) => {
          if (!iso) return <span key={i} />;
          const evs = data.monthEvents.filter((e) => e.date === iso);
          const hol = data.monthHolidays.some((h) => h.date === iso);
          const dow = new Date(`${iso}T12:00:00`).getDay();
          const isToday = iso === data.today;
          return (
            <button
              key={iso}
              onClick={() => onPick(picked === iso ? null : iso)}
              aria-label={fmtDay(iso, { weekday: "long", month: "long", day: "numeric" })}
              aria-pressed={picked === iso}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-[8px] border text-xs transition-colors",
                picked === iso ? "border-[#e5b647] bg-[#c99428]/20" : "border-transparent hover:border-[#c99428]/30",
                nightDays.has(dow) && "bg-white/[0.03]",
                isToday && "font-semibold text-[#e5b647]"
              )}
            >
              {Number(iso.slice(8))}
              <span className="absolute bottom-1 flex gap-0.5">
                {evs.slice(0, 3).map((e) => (
                  <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full", e.status === "confirmed" ? "bg-[#7fcfa2]" : e.status === "pending" ? "bg-[#f0bd62]" : "bg-[#e58b84]")} />
                ))}
              </span>
              {hol && <Star size={8} className="absolute right-1 top-1 fill-[#e5b647] text-[#e5b647]" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#a59d8f]">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#7fcfa2]" /> Confirmed</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#f0bd62]" /> Pending</span>
        <span className="flex items-center gap-1"><Star size={9} className="fill-[#e5b647] text-[#e5b647]" /> Holiday</span>
        {nightDays.size > 0 && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-white/10" /> Regular night</span>}
      </div>
    </div>
  );
}

function EventDetail({ e, onClose }: { e: Ev; onClose: () => void }) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Event details" className={cn(C.card, "w-full max-w-sm p-5")} onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={C.eyebrow}>Event details</p>
            <p className="mt-1 font-display text-2xl font-light">{e.date ? fmtDay(e.date, { weekday: "long", month: "long", day: "numeric" }) : "Date to be set"}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-[#a59d8f] hover:text-[#efe7d8]">
            <X size={18} />
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-[90px_1fr] gap-y-2 text-sm">
          <dt className="text-[#a59d8f]">Event</dt>
          <dd>{e.label}</dd>
          <dt className="text-[#a59d8f]">Time</dt>
          <dd>{e.starts_at ? `${fmtTime(e.starts_at)}${e.ends_at ? ` – ${fmtTime(e.ends_at)}` : ""}` : "To be set"}</dd>
          <dt className="text-[#a59d8f]">DJ</dt>
          <dd className="flex items-center gap-2">
            {e.dj ? (
              <>
                <Avatar name={e.dj.name} url={e.dj.photo_url} size={26} /> {e.dj.name}
              </>
            ) : (
              "To be assigned"
            )}
          </dd>
          <dt className="text-[#a59d8f]">Status</dt>
          <dd>
            <StatusPill status={e.status} />
          </dd>
        </dl>
      </div>
    </div>
  );
}
