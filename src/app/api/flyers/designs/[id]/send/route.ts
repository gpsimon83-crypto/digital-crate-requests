import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { FLYER_BUCKET, flyerActor, flyerError, setupMissing, uuidOk } from "@/lib/flyers/server";
import { checkUpload } from "@/lib/flyers/image-check";
import { eventDate, loadEvent } from "@/lib/flyers/data";
import type { CalendarNightRef } from "@/lib/flyers/calendar-nights";

type Params = { params: Promise<{ id: string }> };
type Design = { id: string; dj_id: string; title: string; event_id: string | null; venue_id?: string | null; calendar_night?: CalendarNightRef | null };

/** Which venue a flyer is for, and its night: the event's venue, else the calendar night's, else the flyer's own venue. */
async function venueOf(db: ReturnType<typeof createAdminClient>, d: Design): Promise<{ venueId: string | null; date: string | null }> {
  if (d.event_id) {
    const ev = await loadEvent(db, d.event_id);
    if (ev) return { venueId: ev.venue_id, date: eventDate(ev) };
  }
  if (d.calendar_night) return { venueId: d.calendar_night.venue_id, date: d.calendar_night.date };
  return { venueId: d.venue_id ?? null, date: null };
}

async function load(id: string) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  if (!uuidOk(id)) return NextResponse.json({ error: "Flyer not found" }, { status: 404 });
  const db = createAdminClient();
  const { data } = await db.from("flyer_designs").select("*").eq("id", id).maybeSingle();
  const d = data as Design | null;
  if (!d || (!actor.staff && d.dj_id !== actor.dj?.id)) return NextResponse.json({ error: "Flyer not found" }, { status: 404 });
  return { actor, db, d };
}

/** Copies of this flyer already sent to the venue portal. */
export async function GET(_req: NextRequest, { params }: Params) {
  const l = await load((await params).id);
  if (l instanceof NextResponse) return l;
  try {
    const { venueId } = await venueOf(l.db, l.d);
    const { data: v } = venueId ? await l.db.from("venues").select("id, name, portal_enabled").eq("id", venueId).maybeSingle() : { data: null };
    const { data, error } = await l.db.from("venue_flyers").select("id, venue_id, title, night_date, sent_at, width, height").eq("design_id", l.d.id).eq("hidden", false).order("sent_at", { ascending: false });
    const venue = v as { id: string; name: string; portal_enabled: boolean } | null;
    return NextResponse.json({ venue: venue ? { id: venue.id, name: venue.name, portal: !!venue.portal_enabled } : null, sent: error ? [] : (data ?? []), ready: !error });
  } catch (err) {
    return flyerError(err);
  }
}

/**
 * Send the finished flyer (the PNG the editor rendered, identical to the
 * export) to the venue's portal, where the venue can view and download it.
 * The flyer's DJ or staff only. The venue's copy doesn't change if the
 * flyer is edited later: send again to update it.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const l = await load((await params).id);
  if (l instanceof NextResponse) return l;
  const { actor, db, d } = l;
  try {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "The flyer image is missing." }, { status: 400 });
    if (file.size > 16 * 1024 * 1024) return NextResponse.json({ error: "That flyer image is too large." }, { status: 413 });
    const note = String(form?.get("note") ?? "").replace(/\s+/g, " ").trim().slice(0, 500) || null;
    const replace = form?.get("replace") === "1";

    const { venueId, date } = await venueOf(db, d);
    if (!venueId) return NextResponse.json({ error: "Link this flyer to an event or venue night first, so we know which venue gets it." }, { status: 400 });
    const { data: v } = await db.from("venues").select("id, name, portal_enabled").eq("id", venueId).maybeSingle();
    const venue = v as { id: string; name: string; portal_enabled: boolean } | null;
    if (!venue) return NextResponse.json({ error: "Venue not found." }, { status: 404 });
    if (!venue.portal_enabled) return NextResponse.json({ error: `${venue.name} doesn't have a venue portal yet. Turn it on in Admin → Venue Portals.` }, { status: 400 });

    const buf = new Uint8Array(await file.arrayBuffer());
    const check = checkUpload(buf, "template");
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    if (check.info.mime !== "image/png") return NextResponse.json({ error: "Send the flyer as a PNG." }, { status: 400 });

    const path = `venue/${venue.id}/${randomUUID()}.png`;
    const { error: upErr } = await db.storage.from(FLYER_BUCKET).upload(path, buf, { contentType: "image/png", upsert: false });
    if (upErr) throw upErr;
    const { data: row, error } = await db
      .from("venue_flyers")
      .insert({ venue_id: venue.id, design_id: d.id, title: (d.title || "Flyer").slice(0, 120), night_date: date, note, storage_path: path, width: check.info.width, height: check.info.height, bytes: buf.length, sent_by: actor.user.id })
      .select("id, venue_id, title, night_date, sent_at, width, height")
      .single();
    if (error) {
      await db.storage.from(FLYER_BUCKET).remove([path]);
      if (setupMissing(error)) return NextResponse.json({ error: "Sending to venues needs migration 0053_flyer_calendar_nights.sql in Supabase.", setup: true }, { status: 503 });
      throw error;
    }
    // "Replace" hides this flyer's earlier copies, so the venue sees one current version.
    if (replace) await db.from("venue_flyers").update({ hidden: true }).eq("design_id", d.id).neq("id", (row as { id: string }).id);
    await db.from("flyer_designs").update({ exported_at: new Date().toISOString() }).eq("id", d.id);
    return NextResponse.json({ ok: true, sent: row, venue: { id: venue.id, name: venue.name } });
  } catch (err) {
    return flyerError(err);
  }
}
