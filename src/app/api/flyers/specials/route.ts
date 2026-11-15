import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flyerActor, flyerError, setupMissing, uuidOk } from "@/lib/flyers/server";
import { eventDate, loadEvent } from "@/lib/flyers/data";
import { cleanPlanText, PLAN_LIMITS } from "@/lib/venue/night-plans";
import { parseCalendarKey } from "@/lib/flyers/calendar-nights";

/** The venue and date behind a CRM event id or a calendar night key. */
async function nightOf(db: ReturnType<typeof createAdminClient>, id: string): Promise<{ venue_id: string | null; date: string | null } | null> {
  const cal = parseCalendarKey(id);
  if (cal) return { venue_id: cal.venueId, date: cal.date };
  if (!uuidOk(id)) return null;
  const ev = await loadEvent(db, id);
  return ev ? { venue_id: ev.venue_id, date: eventDate(ev) } : null;
}

/**
 * An event's drink specials. The night's own list lives in
 * venue_night_plans (the same rows the venue portal edits); the venue's
 * default list (venues.default_drink_specials) is used when a night has none.
 * Staff edit both here; DJs see them on their flyers.
 */
export async function GET(req: NextRequest) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  const eventId = req.nextUrl.searchParams.get("event");
  if (!eventId) return NextResponse.json({ error: "Choose an event." }, { status: 400 });
  try {
    const db = createAdminClient();
    const ev = await nightOf(db, eventId);
    if (!ev) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const date = ev.date;
    let night: string | null = null;
    if (ev.venue_id && date) {
      const { data } = await db.from("venue_night_plans").select("drink_specials, location_id").eq("venue_id", ev.venue_id).eq("night_date", date);
      night = ((data ?? []) as { drink_specials: string | null; location_id?: string }[]).sort((a, b) => Number(!!a.location_id) - Number(!!b.location_id)).find((r) => r.drink_specials)?.drink_specials ?? null;
    }
    const { data: v } = ev.venue_id ? await db.from("venues").select("*").eq("id", ev.venue_id).maybeSingle() : { data: null };
    return NextResponse.json({ venueId: ev.venue_id, venueName: (v as { name?: string } | null)?.name ?? null, date, night, venueDefault: (v as { default_drink_specials?: string | null } | null)?.default_drink_specials ?? null, canEdit: actor.staff });
  } catch (err) {
    return flyerError(err);
  }
}

export async function PUT(req: NextRequest) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  if (!actor.staff) return NextResponse.json({ error: "Drink specials are set by Digital Crate DJs staff or the venue." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { eventId?: string; scope?: string; text?: unknown };
  if (typeof b.eventId !== "string" || !b.eventId) return NextResponse.json({ error: "Choose an event." }, { status: 400 });
  const text = cleanPlanText(b.text, PLAN_LIMITS.drink_specials);
  try {
    const db = createAdminClient();
    const ev = await nightOf(db, b.eventId);
    if (!ev?.venue_id) return NextResponse.json({ error: "This event has no venue." }, { status: 400 });
    if (b.scope === "venue") {
      const { error } = await db.from("venues").update({ default_drink_specials: text }).eq("id", ev.venue_id);
      if (error) {
        if (setupMissing(error)) return NextResponse.json({ error: "Venue default specials need migration 0052_flyer_event_links.sql in Supabase.", setup: true }, { status: 503 });
        throw error;
      }
      return NextResponse.json({ ok: true });
    }
    const date = ev.date;
    if (!date) return NextResponse.json({ error: "This event has no date." }, { status: 400 });
    // The night's plan (venue as a whole): update its specials, keeping the rest of the plan.
    const { data: existing } = await db.from("venue_night_plans").select("id").eq("venue_id", ev.venue_id).eq("night_date", date).eq("location_id", "").maybeSingle();
    const now = new Date().toISOString();
    const { error } = existing
      ? await db.from("venue_night_plans").update({ drink_specials: text, updated_by: actor.user.id, updated_at: now }).eq("id", (existing as { id: string }).id)
      : text
        ? await db.from("venue_night_plans").insert({ venue_id: ev.venue_id, night_date: date, location_id: "", drink_specials: text, created_by: actor.user.id, updated_by: actor.user.id })
        : { error: null };
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return flyerError(err);
  }
}
