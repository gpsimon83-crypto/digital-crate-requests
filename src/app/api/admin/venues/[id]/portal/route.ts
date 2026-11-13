import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { audit, cleanText, requireVenueAdmin, slugify, toVenue, VENUE_COLUMNS } from "@/lib/venue/server";
import { normalizeFocus, normalizeNights } from "@/lib/venue/types";
import { loadLocations, normalizeLocations } from "@/lib/venue/locations";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const admin = await requireVenueAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  try {
    const db = createAdminClient();
    const { data: row, error } = await db.from("venues").select(VENUE_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!row) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    const [{ data: managers }, { data: log }] = await Promise.all([
      db.from("venue_managers").select("id, venue_id, user_id, email, full_name, title, phone, is_active, invited_at, last_seen_at").eq("venue_id", id).order("invited_at"),
      db.from("venue_audit_log").select("id, actor_label, action, detail, created_at").eq("venue_id", id).order("created_at", { ascending: false }).limit(30)
    ]);
    const locs = await loadLocations(db, id);
    return NextResponse.json({ venue: toVenue(row), locations: locs.locations, locationsReady: locs.ready, managers: managers ?? [], log: log ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** Saves venue details, branding positions, nights and preferences. Only listed fields are accepted. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireVenueAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const text: [string, number][] = [
    ["location", 120], ["address_line1", 160], ["city", 80], ["state", 40], ["postal_code", 20],
    ["contact_name", 120], ["contact_phone", 40], ["dcdjs_contact_name", 120], ["dcdjs_contact_email", 160], ["dcdjs_contact_phone", 40]
  ];
  for (const [k, max] of text) if (k in b) update[k] = cleanText(b[k], max);
  if ("name" in b) {
    const name = cleanText(b.name, 120);
    if (!name) return NextResponse.json({ error: "Venue name can't be empty." }, { status: 400 });
    update.name = name;
  }
  if ("slug" in b) update.slug = typeof b.slug === "string" && b.slug.trim() ? slugify(b.slug) || null : null;
  if ("is_active" in b) update.is_active = !!b.is_active;
  if ("portal_enabled" in b) update.portal_enabled = !!b.portal_enabled;
  if ("cover_focus" in b) update.cover_focus = normalizeFocus(b.cover_focus);
  if ("recurring_nights" in b) update.recurring_nights = normalizeNights(b.recurring_nights);
  if ("calendar_names" in b && Array.isArray(b.calendar_names)) {
    update.calendar_names = [...new Set(b.calendar_names.map((s) => cleanText(s, 80)).filter((s): s is string => !!s))].slice(0, 20);
  }
  if ("scheduling_prefs" in b && b.scheduling_prefs && typeof b.scheduling_prefs === "object") {
    const p = b.scheduling_prefs as Record<string, unknown>;
    const lead = Number(p.request_lead_days);
    update.scheduling_prefs = {
      music_notes: cleanText(p.music_notes, 1000) ?? undefined,
      setup_notes: cleanText(p.setup_notes, 1000) ?? undefined,
      other: cleanText(p.other, 1000) ?? undefined,
      request_lead_days: Number.isFinite(lead) && lead >= 0 && lead <= 365 ? Math.round(lead) : undefined
    };
  }
  for (const k of ["logo_url", "cover_url"] as const) if (k in b && b[k] === null) update[k] = null;
  if (typeof update.dcdjs_contact_email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(update.dcdjs_contact_email)) {
    return NextResponse.json({ error: "DCDJs contact email doesn't look right." }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { data, error } = await db.from("venues").update(update).eq("id", id).select(VENUE_COLUMNS).maybeSingle();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Another venue already uses that web address." }, { status: 409 });
      throw error;
    }
    if (!data) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    // Locations live in their own column (migration 0049); saved separately so the rest still saves without it.
    let locations: ReturnType<typeof normalizeLocations> | undefined;
    if ("locations" in b) {
      locations = normalizeLocations(b.locations);
      const { error: locErr } = await db.from("venues").update({ locations }).eq("id", id);
      if (locErr) return NextResponse.json({ error: "Locations need a one-time database update (migration 0049). Everything else was saved.", venue: toVenue(data) }, { status: 503 });
      update.locations = locations;
    }
    const changed = Object.keys(update).filter((k) => k !== "updated_at");
    await audit(id, admin, "venue.updated", { fields: changed });
    return NextResponse.json({ venue: toVenue(data), ...(locations ? { locations } : {}) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
