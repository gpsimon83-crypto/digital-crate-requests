import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flyerActor, flyerError, uuidOk } from "@/lib/flyers/server";
import { eventValues, loadEvent } from "@/lib/flyers/data";
import { instantiate, parseTemplateContent } from "@/lib/flyers/scene";
import { FORMATS, type FormatKey } from "@/lib/flyers/types";

/**
 * Start a flyer from a published template version. Placeholders are filled
 * from the DJ's profile and, when given, one of the DJ's bookings. The
 * booking itself is only read, never changed.
 */
export async function POST(req: NextRequest) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  const b = (await req.json().catch(() => ({}))) as { templateId?: string; format?: string; eventId?: string | null; djId?: string | null; title?: string };
  if (!uuidOk(b.templateId)) return NextResponse.json({ error: "Pick a template." }, { status: 400 });
  if (!b.format || !(b.format in FORMATS)) return NextResponse.json({ error: "Pick a size." }, { status: 400 });
  const format = b.format as FormatKey;

  try {
    const db = createAdminClient();
    // Whose flyer: a DJ makes their own; staff may make one for any DJ.
    let dj = actor.dj;
    if (b.djId && b.djId !== actor.dj?.id) {
      if (!actor.staff || !uuidOk(b.djId)) return NextResponse.json({ error: "You can only make your own flyers." }, { status: 403 });
      const { data } = await db.from("djs").select("id, display_name, photo_url").eq("id", b.djId).maybeSingle();
      dj = (data as typeof dj) ?? null;
    }
    if (!dj) return NextResponse.json({ error: "Choose which DJ this flyer is for." }, { status: 400 });

    const { data: t, error: tErr } = await db.from("flyer_templates").select("id, name, status, venue_id, current_version_id").eq("id", b.templateId).maybeSingle();
    if (tErr) throw tErr;
    if (!t || t.status !== "published" || !t.current_version_id) return NextResponse.json({ error: "That template isn't available." }, { status: 404 });
    const { data: v, error: vErr } = await db.from("flyer_template_versions").select("id, content").eq("id", t.current_version_id).single();
    if (vErr) throw vErr;
    const content = parseTemplateContent(v.content);
    if (!content.ok) return NextResponse.json({ error: content.error }, { status: 500 });
    const layout = content.value.formats[format];
    if (!layout) return NextResponse.json({ error: `This template has no ${FORMATS[format].label.toLowerCase()} layout.` }, { status: 400 });

    let event = null;
    if (b.eventId) {
      if (!uuidOk(b.eventId)) return NextResponse.json({ error: "Unknown booking." }, { status: 400 });
      event = await loadEvent(db, b.eventId);
      if (!event || (event.dj_id !== dj.id && !actor.staff)) return NextResponse.json({ error: "That booking isn't yours." }, { status: 403 });
      if (event.dj_id !== dj.id) return NextResponse.json({ error: "That booking is for a different DJ." }, { status: 400 });
    }

    const scene = instantiate(layout, { values: eventValues(event, dj.display_name), djId: dj.id, venueId: event?.venue_id ?? t.venue_id ?? null });
    const title = (b.title?.trim() || [event?.title, t.name].filter(Boolean).join(" · ") || "Untitled flyer").slice(0, 80);
    const { data: row, error } = await db
      .from("flyer_designs")
      .insert({
        dj_id: dj.id,
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
      })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ id: row.id });
  } catch (err) {
    return flyerError(err);
  }
}
