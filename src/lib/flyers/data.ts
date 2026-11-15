import type { createAdminClient } from "@/lib/supabase/admin";
import { bookingValues } from "./scene";
import type { PlaceholderValues } from "./types";
import { calendarNights, chicagoInstant, type CalendarNightRef } from "./calendar-nights";

type Db = ReturnType<typeof createAdminClient>;

export type VenueRow = { id: string; name: string; location: string | null; address_line1: string | null; city: string | null; state: string | null; postal_code: string | null; logo_url: string | null };
export type EventRow = { id: string; title: string | null; starts_at: string | null; ends_at: string | null; timezone: string | null; dj_id: string | null; venue_id: string | null; venue_name: string | null; status: string | null; venues: VenueRow | null };

export const EVENT_SELECT = "id, title, starts_at, ends_at, timezone, dj_id, venue_id, venue_name, status, venues(id, name, location, address_line1, city, state, postal_code, logo_url)";

export function venueAddress(v: VenueRow | null): string | null {
  if (!v) return null;
  const cityLine = [v.city, [v.state, v.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const full = [v.address_line1, cityLine].filter(Boolean).join(", ");
  return full || v.location || null;
}

/** Placeholder values for a booking. Read only: making a flyer never changes the booking. */
export function eventValues(e: EventRow | null, djName: string): PlaceholderValues {
  return bookingValues(
    e ? { title: e.title, starts_at: e.starts_at, ends_at: e.ends_at, timezone: e.timezone, venue_name: e.venues?.name ?? e.venue_name, venue_address: venueAddress(e.venues) } : null,
    djName
  );
}

export async function loadEvent(db: Db, id: string): Promise<EventRow | null> {
  const { data, error } = await db.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  const row = data as unknown as (EventRow & { venues: VenueRow | VenueRow[] | null }) | null;
  if (!row) return null;
  return { ...row, venues: Array.isArray(row.venues) ? (row.venues[0] ?? null) : row.venues };
}

/* ---------- everything a flyer's linked layers need ---------- */

export type FlyerDj = { id: string; display_name: string; has_photo: boolean; has_cutout: boolean; has_logo: boolean; role: string };
export type FlyerContext = {
  event: { id: string; title: string | null; starts_at: string | null; venue_id: string | null; venue_name: string | null } | null;
  venue: { id: string; name: string; has_logo: boolean } | null;
  /** The event's DJs, lead first (events.dj_id, then event_staff_assignments). */
  eventDjs: FlyerDj[];
  /** DJ for slot 1, 2, … (this flyer's assignment, defaulting to the event's DJs). */
  slots: (string | null)[];
  /** Every DJ a slot points at (event DJs plus any staff assigned by hand). */
  djs: FlyerDj[];
  values: PlaceholderValues;
  drinkSpecials: { text: string | null; from: "night" | "venue" | null };
  hasEvent: boolean;
};

/** The event's own date (YYYY-MM-DD) in its time zone. */
export function eventDate(e: { starts_at: string | null; timezone?: string | null } | null): string | null {
  if (!e?.starts_at) return null;
  const d = new Date(e.starts_at);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: e.timezone || "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

async function djInfo(db: Db, ids: string[]): Promise<Map<string, Omit<FlyerDj, "role">>> {
  const out = new Map<string, Omit<FlyerDj, "role">>();
  if (!ids.length) return out;
  const { data } = await db.from("djs").select("id, display_name, photo_url").in("id", ids);
  // Approved cutouts / name logos (columns exist after migration 0052; before it, nothing is approved).
  const { data: assets, error } = await db.from("flyer_assets").select("owner_dj_id, kind, approved").in("owner_dj_id", ids).in("kind", ["cutout", "name_logo"]);
  const approved = error ? [] : ((assets ?? []) as { owner_dj_id: string; kind: string; approved: boolean }[]).filter((a) => a.approved);
  for (const d of (data ?? []) as { id: string; display_name: string; photo_url: string | null }[]) {
    const cut = approved.some((a) => a.owner_dj_id === d.id && a.kind === "cutout");
    out.set(d.id, { id: d.id, display_name: d.display_name, has_cutout: cut, has_photo: cut || !!d.photo_url, has_logo: approved.some((a) => a.owner_dj_id === d.id && a.kind === "name_logo") });
  }
  return out;
}

/**
 * Loads the event (source of truth for venue and DJs), the venue, the DJs
 * and the night's drink specials, and works out every placeholder value.
 * Only reads: nothing here changes the event, venue or DJ records.
 */
export async function loadFlyerContext(db: Db, opts: { eventId: string | null; venueId?: string | null; djSlots?: (string | null)[] | null; fallbackDjId?: string | null; calendarNight?: CalendarNightRef | null }): Promise<FlyerContext> {
  const loaded = opts.eventId ? await loadEvent(db, opts.eventId) : null;
  // A venue night from the Google Calendar stands in for an event (read only, like events).
  const night = !loaded && opts.calendarNight ? opts.calendarNight : null;
  const event: EventRow | null =
    loaded ??
    (night
      ? { id: night.id, title: night.title, starts_at: night.starts_at, ends_at: night.ends_at, timezone: "America/Chicago", dj_id: night.dj_id, venue_id: night.venue_id, venue_name: night.venue_name, status: "confirmed", venues: null }
      : null);
  const venueId = event?.venue_id ?? opts.venueId ?? null;

  // The event's DJs: lead (events.dj_id), then any extra crew on the event.
  const crew: { dj_id: string; role: string }[] = [];
  if (event?.dj_id) crew.push({ dj_id: event.dj_id, role: "lead_dj" });
  if (loaded) {
    const { data } = await db.from("event_staff_assignments").select("dj_id, role, status, created_at").eq("event_id", loaded.id).order("created_at");
    for (const r of (data ?? []) as { dj_id: string; role: string; status: string }[]) if (r.status !== "declined" && !crew.some((c) => c.dj_id === r.dj_id)) crew.push({ dj_id: r.dj_id, role: r.role });
  }
  if (!event && opts.fallbackDjId) crew.push({ dj_id: opts.fallbackDjId, role: "lead_dj" });

  const slots = (opts.djSlots && opts.djSlots.length ? opts.djSlots : crew.map((c) => c.dj_id)).slice(0, 8);
  const ids = [...new Set([...crew.map((c) => c.dj_id), ...slots.filter((x): x is string => !!x)])];
  const info = await djInfo(db, ids);
  const withRole = (id: string): FlyerDj | null => {
    const d = info.get(id);
    return d ? { ...d, role: crew.find((c) => c.dj_id === id)?.role ?? "assigned" } : null;
  };

  let venue: VenueRow & { default_drink_specials?: string | null } | null = event?.venues ?? null;
  if (venueId) {
    const { data } = await db.from("venues").select("*").eq("id", venueId).maybeSingle();
    if (data) venue = data as VenueRow & { default_drink_specials?: string | null };
  }

  // Drink specials: the night's own (venue_night_plans), else the venue's default list.
  let drink: FlyerContext["drinkSpecials"] = { text: null, from: null };
  let occasion: string | null = null;
  const date = night ? night.date : eventDate(event);
  if (venueId && date) {
    const { data } = await db.from("venue_night_plans").select("drink_specials, occasion, location_id").eq("venue_id", venueId).eq("night_date", date);
    const rows = ((data ?? []) as { drink_specials: string | null; occasion: string | null; location_id?: string | null }[]).sort((a, b) => Number(!!a.location_id) - Number(!!b.location_id));
    const night = rows.find((r) => r.drink_specials) ?? rows[0];
    if (night?.drink_specials) drink = { text: night.drink_specials, from: "night" };
    occasion = rows.find((r) => r.occasion)?.occasion ?? null;
  }
  if (!drink.text && venue?.default_drink_specials) drink = { text: venue.default_drink_specials, from: "venue" };

  const slotDjs = slots.map((id) => (id ? withRole(id) : null));
  // A calendar night with no hours still has its date.
  const forValues = night && !night.starts_at ? { ...event!, starts_at: chicagoInstant(night.date, "12:00") } : event;
  const base = eventValues(forValues ? { ...forValues, venues: venue } : null, slotDjs[0]?.display_name ?? "");
  if (night && !night.starts_at) {
    base.start_time = null;
    base.end_time = null;
    base.event_time_range = null;
  }
  const values: PlaceholderValues = {
    ...base,
    venue_name: venue?.name ?? event?.venue_name ?? null,
    venue_address: venueAddress(venue),
    drink_specials: drink.text,
    event_details: occasion
  };
  slotDjs.forEach((d, i) => {
    if (i > 0) values[`dj${i + 1}_name`] = d?.display_name ?? null;
  });
  // The calendar names a DJ who has no CRM profile yet: their name still fills the text.
  if (!slotDjs[0]) values.dj_name = !opts.djSlots?.length && night?.dj_name && !night.dj_id ? night.dj_name : null;

  return {
    event: event ? { id: event.id, title: event.title, starts_at: event.starts_at, venue_id: event.venue_id, venue_name: venue?.name ?? event.venue_name } : null,
    venue: venue ? { id: venue.id, name: venue.name, has_logo: !!venue.logo_url } : null,
    eventDjs: crew.map((c) => withRole(c.dj_id)).filter((x): x is FlyerDj => !!x),
    slots,
    djs: ids.map(withRole).filter((x): x is FlyerDj => !!x),
    values,
    drinkSpecials: drink,
    hasEvent: !!event
  };
}

/** Is this DJ on the event (lead DJ or extra crew)? */
export async function djOnEvent(db: Db, eventId: string, djId: string): Promise<boolean> {
  const { data: e } = await db.from("events").select("dj_id").eq("id", eventId).maybeSingle();
  if ((e as { dj_id: string | null } | null)?.dj_id === djId) return true;
  const { data } = await db.from("event_staff_assignments").select("dj_id, status").eq("event_id", eventId).eq("dj_id", djId);
  return ((data ?? []) as { status: string }[]).some((r) => r.status !== "declined");
}

/** Event types that never get flyers (private client events). */
const NO_FLYER = new Set(["wedding", "consultation"]);

export type FlyerEventOpt = { id: string; title: string | null; starts_at: string | null; venue_id: string | null; venue_name: string | null; dj_id: string | null; source: "event" | "calendar"; date?: string; dj_name?: string | null; ends_at?: string | null; timed?: boolean };

/**
 * What a flyer can be made for: CRM events (not weddings) and venue nights
 * from the Google Calendar. A DJ sees their own (lead or crew, or named on
 * the calendar night); staff see everything upcoming. `include` keeps the
 * flyer's current event or night in the list.
 */
export async function flyerEvents(db: Db, opts: { djId: string | null; staff: boolean; include?: string | null; calendar?: boolean }): Promise<FlyerEventOpt[]> {
  const since = new Date(Date.now() - 3 * 86400_000).toISOString();
  let ids: string[] | null = null;
  if (!opts.staff) {
    if (!opts.djId) return [];
    const { data: lead } = await db.from("events").select("id").eq("dj_id", opts.djId).gte("starts_at", since);
    const { data: crew } = await db.from("event_staff_assignments").select("event_id, status").eq("dj_id", opts.djId);
    ids = [...new Set([...((lead ?? []) as { id: string }[]).map((r) => r.id), ...((crew ?? []) as { event_id: string; status: string }[]).filter((r) => r.status !== "declined").map((r) => r.event_id)])];
  }
  let q = db.from("events").select("id, title, starts_at, timezone, status, event_category, venue_id, venue_name, dj_id, venues(name)").gte("starts_at", since).order("starts_at").limit(300);
  if (ids) q = q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await q;
  type Row = { id: string; title: string | null; starts_at: string | null; status: string | null; event_category?: string | null; venue_id: string | null; venue_name: string | null; dj_id: string | null; venues: { name: string } | { name: string }[] | null };
  let rows = ((data ?? []) as unknown as Row[]).filter((e) => e.status !== "declined" && e.status !== "cancelled" && e.status !== "inquiry" && !NO_FLYER.has(String(e.event_category ?? "")));
  if (opts.include && !opts.include.startsWith("cal:") && !rows.some((r) => r.id === opts.include)) {
    const extra = await loadEvent(db, opts.include);
    if (extra) rows = [{ ...extra, venues: extra.venues ? { name: extra.venues.name } : null }, ...rows];
  }
  const events: FlyerEventOpt[] = rows.map((e) => {
    const v = Array.isArray(e.venues) ? e.venues[0] : e.venues;
    return { id: e.id, title: e.title, starts_at: e.starts_at, venue_id: e.venue_id, venue_name: v?.name ?? e.venue_name ?? null, dj_id: e.dj_id, source: "event" as const, date: e.starts_at ? (eventDate({ starts_at: e.starts_at }) ?? undefined) : undefined };
  });
  if (opts.calendar === false) return events;

  // Venue nights on the Google Calendar, unless a CRM event already covers that venue and date.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const nights = await calendarNights(db, { fromDate: today, months: 3 }).catch(() => []);
  const covered = new Set(events.map((e) => `${e.venue_id}|${e.date}`));
  const mine = nights.filter((n) => (opts.staff || (opts.djId && n.dj_id === opts.djId) || n.id === opts.include) && !covered.has(`${n.venue_id}|${n.date}`));
  const cal: FlyerEventOpt[] = mine.map((n) => ({ id: n.id, title: n.title, starts_at: n.starts_at ?? chicagoInstant(n.date, "12:00"), venue_id: n.venue_id, venue_name: n.venue_name, dj_id: n.dj_id, source: "calendar", date: n.date, dj_name: n.dj_name, ends_at: n.ends_at, timed: !!n.starts_at }));
  return [...events, ...cal].sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""));
}
