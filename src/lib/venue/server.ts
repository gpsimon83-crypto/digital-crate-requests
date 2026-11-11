// Venue Partner Portal: server-only access control and helpers.
//
// Who may see a venue is decided here, on the server, on every request:
//   * a venue manager sees only venues where they have an ACTIVE
//     venue_managers row AND the venue is active with its portal enabled
//   * staff (owner/admin/manager) may preview any venue read-only
// Nothing about access is trusted from the browser.

import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { staffSessionMeetsMfa } from "@/lib/security/mfa";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffRole, accountRole } from "@/lib/roles";
import { normalizeFocus, normalizeNights, type VenueRecord } from "./types";

export const VENUE_COLUMNS =
  "id, name, slug, location, address_line1, city, state, postal_code, contact_name, contact_phone, is_active, portal_enabled, logo_url, cover_url, cover_focus, dcdjs_contact_name, dcdjs_contact_email, dcdjs_contact_phone, recurring_nights, scheduling_prefs, calendar_names, updated_at";

export function toVenue(row: Record<string, unknown>): VenueRecord {
  return {
    ...(row as unknown as VenueRecord),
    cover_focus: normalizeFocus(row.cover_focus),
    recurring_nights: normalizeNights(row.recurring_nights),
    scheduling_prefs: (row.scheduling_prefs as VenueRecord["scheduling_prefs"]) ?? {},
    calendar_names: (row.calendar_names as string[] | null) ?? []
  };
}

/** Venue logins carry role "venue" in app_metadata, which only the server can set. */
export function isVenueUser(user: Pick<User, "app_metadata"> | null | undefined) {
  return user?.app_metadata?.role === "venue";
}

export async function currentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
}

export type VenueAccess = {
  user: User;
  /** Venues this person may switch between in the venue selector. */
  venues: Pick<VenueRecord, "id" | "name" | "slug">[];
  venue: VenueRecord;
  /** True when staff is previewing; the portal is read-only then. */
  preview: boolean;
};

/**
 * Resolves which venue the request may see. Returns a NextResponse on
 * failure so API routes can `return` it directly.
 */
export async function requireVenueAccess(requestedId?: string | null): Promise<VenueAccess | NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = createAdminClient();
  const wanted = requestedId && /^[0-9a-f-]{36}$/i.test(requestedId) ? requestedId : null;

  // Staff: read-only preview of any venue.
  if (isStaffRole(accountRole(user)) && !isVenueUser(user)) {
    const { data: list, error } = await db.from("venues").select("id, name, slug").order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 503 });
    const id = wanted ?? list?.[0]?.id;
    if (!id) return NextResponse.json({ error: "No venues yet. Add one in Admin → Venues." }, { status: 404 });
    const { data: row } = await db.from("venues").select(VENUE_COLUMNS).eq("id", id).maybeSingle();
    if (!row) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    return { user, venues: list ?? [], venue: toVenue(row), preview: true };
  }

  const { data: links, error: linkErr } = await db.from("venue_managers").select("venue_id").eq("user_id", user.id).eq("is_active", true);
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 503 });
  const ids = (links ?? []).map((l) => l.venue_id as string);
  if (!ids.length) return NextResponse.json({ error: "This login isn't connected to a venue yet. Contact Digital Crate DJs." }, { status: 403 });

  const { data: rows, error } = await db
    .from("venues")
    .select(VENUE_COLUMNS)
    .in("id", ids)
    .eq("is_active", true)
    .eq("portal_enabled", true)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  const venues = (rows ?? []).map(toVenue);
  if (!venues.length) return NextResponse.json({ error: "Your venue portal isn't switched on yet. Contact Digital Crate DJs." }, { status: 403 });

  const venue = wanted ? venues.find((v) => v.id === wanted) : venues[0];
  if (!venue) return NextResponse.json({ error: "You don't have access to that venue." }, { status: 403 });

  await db.from("venue_managers").update({ last_seen_at: new Date().toISOString() }).eq("user_id", user.id).eq("venue_id", venue.id);
  return { user, venues: venues.map(({ id, name, slug }) => ({ id, name, slug })), venue, preview: false };
}

/** Staff-only gate for venue management routes; returns the acting user. */
export async function requireVenueAdmin(): Promise<User | NextResponse> {
  const user = await currentUser();
  if (!user || !isStaffRole(accountRole(user)) || isVenueUser(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  if (!(await staffSessionMeetsMfa(await createClient()))) {
    return NextResponse.json({ error: "Two-factor verification required", mfa: true }, { status: 403 });
  }
  return user;
}

export async function audit(venueId: string | null, actor: User | null, action: string, detail: Record<string, unknown> = {}) {
  try {
    await createAdminClient()
      .from("venue_audit_log")
      .insert({ venue_id: venueId, actor_id: actor?.id ?? null, actor_label: actor?.email ?? null, action, detail });
  } catch {
    // Never let logging break the action itself.
  }
}

/** Checks the file's actual bytes, not the type the browser claims. */
export function sniffImage(buf: Uint8Array): { mime: string; ext: string } | null {
  const b = buf;
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return { mime: "image/webp", ext: "webp" };
  return null;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function cleanText(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
}
