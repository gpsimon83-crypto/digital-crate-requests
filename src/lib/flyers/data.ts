import type { createAdminClient } from "@/lib/supabase/admin";
import { bookingValues } from "./scene";
import type { PlaceholderValues } from "./types";

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
