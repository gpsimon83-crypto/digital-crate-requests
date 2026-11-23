import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureSampleTemplate, flyerActor, flyerError } from "@/lib/flyers/server";
import { publicAssets } from "@/lib/flyers/server";
import { EVENT_SELECT, eventValues, flyerEvents, type EventRow, type VenueRow } from "@/lib/flyers/data";
import type { TemplateContent } from "@/lib/flyers/types";
import { templateAccess } from "@/lib/flyers/sharing";

/**
 * Everything the Flyer Creator needs to start: published templates, the
 * caller's own flyers and uploads (a DJ never sees another DJ's), shared
 * template assets, and the DJ's upcoming bookings.
 */
export async function GET() {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const db = createAdminClient();
    await ensureSampleTemplate(db, actor.user.id);

    const { data: tRows, error: tErr } = await db
      .from("flyer_templates")
      .select("id, name, description, venue_id, current_version_id, updated_at")
      .eq("status", "published")
      .order("updated_at", { ascending: false });
    if (tErr) throw tErr;
    type TRow = { id: string; name: string; description: string | null; venue_id: string | null; current_version_id: string | null };
    // A DJ only gets the templates shared with them (All DJs, or picked); staff get all.
    const allowed = await templateAccess(db, { staff: actor.staff, djId: actor.dj?.id ?? null });
    const tList = ((tRows ?? []) as TRow[]).filter((t) => allowed(t.id));
    const versionIds = tList.map((t) => t.current_version_id).filter((x): x is string => !!x);
    const { data: vRows, error: vErr } = versionIds.length
      ? await db.from("flyer_template_versions").select("id, version, content, published_at").in("id", versionIds)
      : { data: [], error: null };
    if (vErr) throw vErr;
    const { data: venues } = await db.from("venues").select("id, name, logo_url").order("name");
    const venueList = (venues ?? []) as { id: string; name: string; logo_url: string | null }[];
    const templates = tList
      .map((t) => {
        const v = ((vRows ?? []) as { id: string; version: number; content: TemplateContent }[]).find((x) => x.id === t.current_version_id);
        if (!v) return null;
        return { id: t.id, name: t.name, description: t.description, venue_id: t.venue_id, venue_name: venueList.find((x) => x.id === t.venue_id)?.name ?? null, version_id: v.id, version: v.version, content: v.content, published_at: (v as { published_at?: string }).published_at ?? null };
      })
      .filter(Boolean);

    const djId = actor.dj?.id ?? null;
    const designsQ = db.from("flyer_designs").select("id, dj_id, title, format, width, height, scene, event_id, template_id, updated_at, djs(display_name)").order("updated_at", { ascending: false }).limit(100);
    const { data: designs, error: dErr } = await (djId ? designsQ.eq("dj_id", djId) : designsQ);
    if (dErr) throw dErr;

    const { data: shared, error: aErr } = await db.from("flyer_assets").select("*").eq("scope", "template").order("created_at", { ascending: false }).limit(200);
    if (aErr) throw aErr;
    const { data: uploads, error: uErr } = djId
      ? await db.from("flyer_assets").select("*").eq("scope", "dj").eq("owner_dj_id", djId).order("created_at", { ascending: false }).limit(100)
      : { data: [], error: null };
    if (uErr) throw uErr;

    const djs = actor.staff ? ((await db.from("djs").select("id, display_name, photo_url").order("display_name")).data ?? []) : [];
    const djName = (id: string | null) => (djs as { id: string; display_name: string }[]).find((d) => d.id === id)?.display_name ?? "DJ Name";

    // Upcoming events: a DJ's own (lead or crew), every event for staff. Starting a flyer from one links it.
    let events: unknown[] = [];
    const list = actor.staff || djId ? await flyerEvents(db, { djId, staff: actor.staff }) : [];
    if (list.length) {
      const { data: ev, error: eErr } = await db.from("events").select(EVENT_SELECT).in("id", list.filter((e) => e.source === "event").map((e) => e.id));
      if (eErr) throw eErr;
      const rows = ((ev ?? []) as unknown as (EventRow & { venues: VenueRow | VenueRow[] | null })[]).map((e) => ({ ...e, venues: Array.isArray(e.venues) ? (e.venues[0] ?? null) : e.venues }));
      events = list.flatMap((l) => {
        if (l.source === "calendar") {
          // A venue night from the Google Calendar: its venue, date and usual hours.
          const v = venueList.find((x) => x.id === l.venue_id);
          const values = eventValues({ id: l.id, title: l.title, starts_at: l.starts_at, ends_at: l.ends_at ?? null, timezone: "America/Chicago", dj_id: l.dj_id, venue_id: l.venue_id, venue_name: l.venue_name, status: null, venues: null }, l.dj_name ?? djName(l.dj_id));
          if (!l.timed) values.start_time = values.end_time = values.event_time_range = null;
          return [{ id: l.id, title: l.title, starts_at: l.starts_at, venue_id: l.venue_id, venue_name: v?.name ?? l.venue_name, dj_id: l.dj_id, source: "calendar", values }];
        }
        const e = rows.find((r) => r.id === l.id);
        return e ? [{ id: e.id, title: e.title, starts_at: e.starts_at, venue_id: e.venue_id, venue_name: e.venues?.name ?? e.venue_name, dj_id: l.dj_id, source: "event", values: eventValues(e, actor.dj && !actor.staff ? actor.dj.display_name : djName(l.dj_id)) }] : [];
      });
    }

    return NextResponse.json({
      me: { staff: actor.staff, dj: actor.dj ? { id: actor.dj.id, display_name: actor.dj.display_name, has_photo: !!actor.dj.photo_url } : null },
      templates,
      designs: designs ?? [],
      shared: publicAssets(shared),
      uploads: publicAssets(uploads),
      events,
      venues: venueList.map((v) => ({ id: v.id, name: v.name, has_logo: !!v.logo_url })),
      djs: (djs as { id: string; display_name: string; photo_url: string | null }[]).map((d) => ({ id: d.id, display_name: d.display_name, has_photo: !!d.photo_url }))
    });
  } catch (err) {
    return flyerError(err);
  }
}
