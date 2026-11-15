import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flyerActor, flyerError, uuidOk } from "@/lib/flyers/server";
import { djOnEvent, loadEvent, loadFlyerContext } from "@/lib/flyers/data";
import { resolveTemplate } from "@/lib/flyers/activation";
import { linkScene, resolveScene } from "@/lib/flyers/links";
import { parseTemplateContent } from "@/lib/flyers/scene";
import { FORMATS, FORMAT_KEYS, type FormatKey } from "@/lib/flyers/types";

/**
 * Start a flyer. With an event, the template is the active one for it
 * (event override → venue default → company default) unless one is picked;
 * its linked layers fill from the event's venue and DJs. The event, venue
 * and DJ records are only read.
 */
export async function POST(req: NextRequest) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  const b = (await req.json().catch(() => ({}))) as { templateId?: string | null; format?: string; eventId?: string | null; djId?: string | null; venueId?: string | null; title?: string };
  try {
    const db = createAdminClient();
    let event = null;
    if (b.eventId) {
      if (!uuidOk(b.eventId)) return NextResponse.json({ error: "Unknown event." }, { status: 400 });
      event = await loadEvent(db, b.eventId);
      if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
      if (!actor.staff && !(actor.dj && (await djOnEvent(db, event.id, actor.dj.id)))) return NextResponse.json({ error: "That booking isn't yours." }, { status: 403 });
    }

    // Whose flyer: a DJ makes their own; staff may pick any DJ (default: the event's lead DJ).
    let ownerId = actor.dj?.id ?? null;
    if (b.djId && b.djId !== actor.dj?.id) {
      if (!actor.staff || !uuidOk(b.djId)) return NextResponse.json({ error: "You can only make your own flyers." }, { status: 403 });
      ownerId = b.djId;
    }
    if (actor.staff && !b.djId && event?.dj_id) ownerId = event.dj_id;
    if (!ownerId) return NextResponse.json({ error: "Choose which DJ this flyer is for." }, { status: 400 });
    if (event && b.djId && actor.staff && event.dj_id !== b.djId && !(await djOnEvent(db, event.id, b.djId))) return NextResponse.json({ error: "That DJ isn't on this event." }, { status: 400 });

    const venueId = event?.venue_id ?? (b.venueId && uuidOk(b.venueId) ? b.venueId : null);
    const templateId = b.templateId && uuidOk(b.templateId) ? b.templateId : (await resolveTemplate(db, { eventId: event?.id, venueId })).templateId;
    if (!templateId) return NextResponse.json({ error: "No template is published yet." }, { status: 400 });

    const { data: t, error: tErr } = await db.from("flyer_templates").select("id, name, status, venue_id, current_version_id").eq("id", templateId).maybeSingle();
    if (tErr) throw tErr;
    if (!t || t.status !== "published" || !t.current_version_id) return NextResponse.json({ error: "That template isn't available." }, { status: 404 });
    const { data: v, error: vErr } = await db.from("flyer_template_versions").select("id, content").eq("id", t.current_version_id).single();
    if (vErr) throw vErr;
    const content = parseTemplateContent(v.content);
    if (!content.ok) return NextResponse.json({ error: content.error }, { status: 500 });
    const wanted = b.format && b.format in FORMATS ? (b.format as FormatKey) : null;
    const format = wanted && content.value.formats[wanted] ? wanted : FORMAT_KEYS.find((k) => content.value.formats[k]);
    if (!format) return NextResponse.json({ error: "This template has no layouts." }, { status: 400 });
    if (wanted && wanted !== format) return NextResponse.json({ error: `This template has no ${FORMATS[wanted].label.toLowerCase()} layout.` }, { status: 400 });

    const ctx = await loadFlyerContext(db, { eventId: event?.id ?? null, venueId: venueId ?? t.venue_id ?? null, fallbackDjId: ownerId });
    const scene = resolveScene(linkScene(content.value.formats[format]!), { values: ctx.values, slots: ctx.slots, venueId: ctx.venue?.id ?? null, hasEvent: ctx.hasEvent });
    const title = (b.title?.trim() || [event?.title, t.name].filter(Boolean).join(" · ") || "Untitled flyer").slice(0, 80);
    const row: Record<string, unknown> = {
      dj_id: ownerId,
      template_id: t.id,
      template_version_id: v.id,
      event_id: event?.id ?? null,
      title,
      format,
      width: scene.width,
      height: scene.height,
      scene,
      created_by: actor.user.id,
      updated_by: actor.user.id
    };
    if (!event && venueId) row.venue_id = venueId;
    let { data: made, error } = await db.from("flyer_designs").insert(row).select("id").single();
    if (error && "venue_id" in row) {
      // Before migration 0052 (no venue_id column): save without it.
      delete row.venue_id;
      ({ data: made, error } = await db.from("flyer_designs").insert(row).select("id").single());
    }
    if (error) throw error;
    return NextResponse.json({ id: made!.id });
  } catch (err) {
    return flyerError(err);
  }
}

/** Which template a new flyer for this event would start from (for the New flyer dialog). */
export async function GET(req: NextRequest) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  const eventId = req.nextUrl.searchParams.get("event");
  const venueParam = req.nextUrl.searchParams.get("venue");
  try {
    const db = createAdminClient();
    const event = eventId && uuidOk(eventId) ? await loadEvent(db, eventId) : null;
    return NextResponse.json(await resolveTemplate(db, { eventId: event?.id, venueId: event?.venue_id ?? (venueParam && uuidOk(venueParam) ? venueParam : null) }));
  } catch (err) {
    return flyerError(err);
  }
}
