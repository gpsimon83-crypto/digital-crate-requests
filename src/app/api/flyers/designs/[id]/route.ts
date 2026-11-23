import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkSceneSources, flyerActor, flyerError, setupMissing, uuidOk, type FlyerActor } from "@/lib/flyers/server";
import { publicAssets } from "@/lib/flyers/server";
import { checkDjChanges, parseScene, parseTemplateContent } from "@/lib/flyers/scene";
import { djOnEvent, flyerEvents, loadEvent, loadFlyerContext, type FlyerContext } from "@/lib/flyers/data";
import { resolveTemplate } from "@/lib/flyers/activation";
import { templateAccess } from "@/lib/flyers/sharing";
import { findCalendarNight, isCalendarKey, type CalendarNightRef } from "@/lib/flyers/calendar-nights";
import { applyTemplateKeepingOverrides } from "@/lib/flyers/links";
import type { FormatKey, Scene, TemplateContent } from "@/lib/flyers/types";

type Params = { params: Promise<{ id: string }> };
type DesignRow = {
  id: string;
  dj_id: string;
  title: string;
  format: FormatKey;
  width: number;
  height: number;
  scene: Scene;
  event_id: string | null;
  template_id: string | null;
  template_version_id: string | null;
  updated_at: string;
  /** Present after migration 0052. */
  venue_id?: string | null;
  dj_slots?: (string | null)[] | null;
  exported_at?: string | null;
  /** Present after migration 0053: the Google Calendar venue night this flyer is for. */
  calendar_night?: CalendarNightRef | null;
};

const slotsOf = (row: DesignRow) => (Array.isArray(row.dj_slots) ? row.dj_slots : null);
const contextFor = (db: ReturnType<typeof createAdminClient>, row: DesignRow) => loadFlyerContext(db, { eventId: row.event_id, venueId: row.venue_id ?? null, djSlots: slotsOf(row), fallbackDjId: row.dj_id, calendarNight: row.event_id ? null : (row.calendar_night ?? null) });
/** What the browser needs to fill linked layers (the same rules run there). */
const contextJson = (c: FlyerContext) => ({ event: c.event, venue: c.venue, eventDjs: c.eventDjs, slots: c.slots, djs: c.djs, values: c.values, drinkSpecials: c.drinkSpecials, hasEvent: c.hasEvent });

/** A DJ reaches only their own flyers; staff reach every flyer. Anyone else gets "not found". */
async function load(actor: FlyerActor, id: string): Promise<DesignRow | NextResponse> {
  if (!uuidOk(id)) return NextResponse.json({ error: "Flyer not found" }, { status: 404 });
  const { data, error } = await createAdminClient()
    .from("flyer_designs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const row = data as DesignRow | null;
  if (!row || (!actor.staff && row.dj_id !== actor.dj?.id)) return NextResponse.json({ error: "Flyer not found" }, { status: 404 });
  return row;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const row = await load(actor, (await params).id);
    if (row instanceof NextResponse) return row;
    const db = createAdminClient();
    const { data: dj } = await db.from("djs").select("id, display_name, photo_url").eq("id", row.dj_id).maybeSingle();
    const { data: uploads } = await db.from("flyer_assets").select("*").eq("scope", "dj").eq("owner_dj_id", row.dj_id).order("created_at", { ascending: false }).limit(100);
    const { data: shared } = await db.from("flyer_assets").select("*").eq("scope", "template").order("created_at", { ascending: false }).limit(200);
    const { data: venues } = await db.from("venues").select("id, name, logo_url").order("name");
    let template: { name: string; version: number | null } | null = null;
    if (row.template_id) {
      const { data: t } = await db.from("flyer_templates").select("name").eq("id", row.template_id).maybeSingle();
      const { data: v } = row.template_version_id ? await db.from("flyer_template_versions").select("version").eq("id", row.template_version_id).maybeSingle() : { data: null };
      template = t ? { name: t.name as string, version: (v?.version as number) ?? null } : null;
    }
    const d = dj as { id: string; display_name: string; photo_url: string | null } | null;
    const ctx = await contextFor(db, row);
    // Templates to switch to (published), and which one is active for this event/venue.
    const allowed = await templateAccess(db, { staff: actor.staff, djId: actor.dj?.id ?? null });
    const active = await resolveTemplate(db, { eventId: row.event_id, venueId: ctx.venue?.id ?? null, allowed });
    // A DJ can switch to templates shared with them, the one this flyer uses, and the one the office turned on here.
    const { data: tplRows } = await db.from("flyer_templates").select("id, name, venue_id, current_version_id").eq("status", "published").order("name");
    const tpls = ((tplRows ?? []) as { id: string; name: string; venue_id: string | null; current_version_id: string | null }[]).filter((t) => allowed(t.id) || t.id === row.template_id || t.id === active.templateId);
    const vIds = ((tpls ?? []) as { current_version_id: string | null }[]).map((t) => t.current_version_id).filter((x): x is string => !!x);
    const { data: vers } = vIds.length ? await db.from("flyer_template_versions").select("id, content").in("id", vIds) : { data: [] };
    const templates = ((tpls ?? []) as { id: string; name: string; venue_id: string | null; current_version_id: string | null }[])
      .map((t) => {
        const c = ((vers ?? []) as { id: string; content: TemplateContent }[]).find((v) => v.id === t.current_version_id)?.content;
        return c?.formats?.[row.format] ? { id: t.id, name: t.name, venue_id: t.venue_id } : null;
      })
      .filter(Boolean);
    const djs = actor.staff ? (((await db.from("djs").select("id, display_name").order("display_name")).data ?? []) as { id: string; display_name: string }[]) : [];
    return NextResponse.json({
      design: row,
      template,
      owner: d ? { id: d.id, display_name: d.display_name, has_photo: !!d.photo_url } : null,
      // Staff working on another DJ's flyer: their own layers stay theirs, template permissions still apply to the DJ.
      viewer: { staff: actor.staff, isOwner: row.dj_id === actor.dj?.id },
      uploads: publicAssets(uploads),
      shared: publicAssets(shared),
      venues: ((venues ?? []) as { id: string; name: string; logo_url: string | null }[]).map((v) => ({ id: v.id, name: v.name, has_logo: !!v.logo_url })),
      context: contextJson(ctx),
      events: await flyerEvents(db, { djId: actor.staff ? null : (actor.dj?.id ?? null), staff: actor.staff, include: row.event_id ?? row.calendar_night?.id ?? null }),
      templates,
      activeTemplate: active,
      allDjs: djs,
      linksReady: "dj_slots" in row,
      calendarReady: "calendar_night" in row
    });
  } catch (err) {
    return flyerError(err);
  }
}

/** Autosave / save. Checks the scene, the images it uses, and the template's layer permissions. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const row = await load(actor, (await params).id);
    if (row instanceof NextResponse) return row;
    const b = (await req.json().catch(() => ({}))) as { scene?: unknown; title?: unknown; baseUpdatedAt?: unknown; eventId?: unknown; venueId?: unknown; djSlots?: unknown; exported?: unknown; applyTemplate?: unknown };
    const update: Record<string, unknown> = { updated_by: actor.user.id, updated_at: new Date().toISOString() };
    const db = createAdminClient();
    const linkChange = b.eventId !== undefined || b.venueId !== undefined || b.djSlots !== undefined;

    if (typeof b.title === "string") update.title = b.title.trim().slice(0, 80) || "Untitled flyer";

    // Link the flyer to an event (the event's venue and DJs then fill it). Read only: the event isn't changed.
    let night: CalendarNightRef | null = null;
    if (b.eventId !== undefined) {
      if (b.eventId === null) {
        update.event_id = null;
        if ("calendar_night" in row) update.calendar_night = null;
      } else if (isCalendarKey(b.eventId)) {
        // A venue night from the Google Calendar (looked up again here, never taken from the browser).
        if (!("calendar_night" in row)) return NextResponse.json({ error: "Flyers for calendar nights need migration 0053_flyer_calendar_nights.sql in Supabase.", setup: true }, { status: 503 });
        night = await findCalendarNight(db, b.eventId);
        if (!night) return NextResponse.json({ error: "That night isn't on the calendar anymore." }, { status: 404 });
        if (!actor.staff && night.dj_id !== row.dj_id && night.id !== row.calendar_night?.id) return NextResponse.json({ error: "That night isn't one of this DJ's on the calendar." }, { status: 403 });
        update.event_id = null;
        update.calendar_night = night;
        update.venue_id = night.venue_id;
      } else {
        if (!uuidOk(b.eventId)) return NextResponse.json({ error: "Unknown event." }, { status: 400 });
        const ev = await loadEvent(db, b.eventId);
        if (!ev) return NextResponse.json({ error: "Event not found." }, { status: 404 });
        if (!actor.staff && !(await djOnEvent(db, ev.id, row.dj_id))) return NextResponse.json({ error: "That event isn't one of this DJ's bookings." }, { status: 403 });
        update.event_id = ev.id;
        if ("calendar_night" in row) update.calendar_night = null;
      }
      // New event: its own DJs fill the slots again unless slots are sent too.
      if (b.djSlots === undefined) update.dj_slots = null;
    }
    if (b.venueId !== undefined) {
      if (b.venueId !== null && !uuidOk(b.venueId)) return NextResponse.json({ error: "Unknown venue." }, { status: 400 });
      update.venue_id = b.venueId;
    }
    if (b.djSlots !== undefined) {
      if (b.djSlots !== null && (!Array.isArray(b.djSlots) || b.djSlots.length > 8 || b.djSlots.some((x) => x !== null && !uuidOk(x)))) return NextResponse.json({ error: "Unknown DJ." }, { status: 400 });
      const slots = (b.djSlots as (string | null)[] | null) ?? null;
      // DJs may only put DJs who are on the event into slots; staff can assign anyone.
      const eventId = update.event_id !== undefined ? (update.event_id as string | null) : row.event_id;
      const calNight = (update.calendar_night !== undefined ? (update.calendar_night as CalendarNightRef | null) : row.calendar_night) ?? null;
      if (slots && !actor.staff) {
        for (const id of slots) if (id && id !== row.dj_id && id !== calNight?.dj_id && !(eventId && (await djOnEvent(db, eventId, id)))) return NextResponse.json({ error: "Only DJs on this event can be added." }, { status: 403 });
      }
      update.dj_slots = slots;
    }
    if (b.exported === true) update.exported_at = new Date().toISOString();

    if (b.applyTemplate !== undefined) {
      // Switch this flyer to another template's layout, keeping this flyer's overrides.
      if (!uuidOk(b.applyTemplate)) return NextResponse.json({ error: "Unknown template." }, { status: 400 });
      const { data: t } = await db.from("flyer_templates").select("id, status, current_version_id").eq("id", b.applyTemplate).maybeSingle();
      if (!t || t.status !== "published" || !t.current_version_id) return NextResponse.json({ error: "That template isn't available." }, { status: 404 });
      if (!actor.staff && t.id !== row.template_id && !(await templateAccess(db, { staff: false, djId: actor.dj?.id ?? null }))(t.id)) {
        const here = await resolveTemplate(db, { eventId: row.event_id, venueId: row.venue_id ?? null });
        if (here.via === "latest" || here.templateId !== t.id) return NextResponse.json({ error: "That template isn't available." }, { status: 404 });
      }
      const { data: v } = await db.from("flyer_template_versions").select("id, content").eq("id", t.current_version_id).single();
      const content = parseTemplateContent(v?.content);
      const layout = content.ok ? content.value.formats[row.format] : null;
      if (!layout) return NextResponse.json({ error: "That template has no layout in this size." }, { status: 400 });
      const prev = parseScene(row.scene, row.format);
      const ctx = await contextFor(db, { ...row, ...(update as Partial<DesignRow>) });
      update.scene = applyTemplateKeepingOverrides(prev.ok ? prev.value : layout, layout, { values: ctx.values, slots: ctx.slots, venueId: ctx.venue?.id ?? null, hasEvent: ctx.hasEvent });
      update.template_id = t.id;
      update.template_version_id = v!.id;
    }

    if (b.scene !== undefined && b.applyTemplate === undefined) {
      const parsed = parseScene(b.scene, row.format);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const prev = parseScene(row.scene, row.format);
      if (!actor.staff && prev.ok) {
        const problem = checkDjChanges(prev.value, parsed.value);
        if (problem) return NextResponse.json({ error: problem }, { status: 403 });
      }
      const ctx = await contextFor(db, { ...row, ...(update as Partial<DesignRow>) });
      const bad = await checkSceneSources(db, parsed.value, row.dj_id, actor.staff ? ctx.djs.map((d) => d.id).concat(ctx.slots.filter((x): x is string => !!x)) : [...ctx.eventDjs.map((d) => d.id), ...ctx.slots.filter((x): x is string => !!x)]);
      if (bad) return NextResponse.json({ error: bad }, { status: 400 });
      update.scene = parsed.value;
    }
    // Two tabs editing the same flyer: refuse to overwrite a newer save.
    let q = db.from("flyer_designs").update(update).eq("id", row.id);
    if (typeof b.baseUpdatedAt === "string") q = q.eq("updated_at", b.baseUpdatedAt);
    const { data, error } = await q.select("*").maybeSingle();
    if (error) {
      if (setupMissing(error)) return NextResponse.json({ error: "Linking flyers to events needs migration 0052_flyer_event_links.sql in Supabase.", setup: true }, { status: 503 });
      throw error;
    }
    if (!data) return NextResponse.json({ error: "This flyer was changed in another window. Reload to get the latest version.", conflict: true }, { status: 409 });
    const saved = data as DesignRow;
    // After a link change, send the fresh event data so the editor can refill linked layers.
    const ctx = linkChange || b.applyTemplate !== undefined ? contextJson(await contextFor(db, saved)) : undefined;
    return NextResponse.json({ ok: true, updated_at: saved.updated_at, title: saved.title, design: linkChange || b.applyTemplate !== undefined ? saved : undefined, context: ctx });
  } catch (err) {
    return flyerError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const row = await load(actor, (await params).id);
    if (row instanceof NextResponse) return row;
    const { error } = await createAdminClient().from("flyer_designs").delete().eq("id", row.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return flyerError(err);
  }
}
