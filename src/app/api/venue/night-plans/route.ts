import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { audit, requireVenueAccess } from "@/lib/venue/server";
import { isStaffRole, accountRole } from "@/lib/roles";
import { sendSystemEmail } from "@/lib/send-system-email";
import { loadLocations } from "@/lib/venue/locations";
import { PLAN_COLUMNS, hasDjRequest, isEmptyPlan, missingPlansTable, parsePlanInput, toNightPlan } from "@/lib/venue/night-plans";

const TZ = "America/Chicago";
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });

/** Tells DCDJs staff about a new or changed DJ request: the bell for every staff login, plus an email to the venue's DCDJs contact. Never throws. */
async function notifyDjRequest(input: { venueId: string; venueName: string; locationName: string | null; contactEmail: string | null; date: string; dj: string | null; occasion: string | null; note: string | null; by: string | null }) {
  const db = createAdminClient();
  const who = input.dj && input.dj !== "Any available DJ" ? input.dj : "any available DJ";
  const title = `${input.venueName}${input.locationName ? ` (${input.locationName})` : ""} requested ${who} for ${longDate(input.date)}`;
  const body = [input.occasion ? `Occasion: ${input.occasion}` : "", input.note ? `Note: ${input.note}` : "", "This is a request, not a booking. Confirm or follow up with the venue."].filter(Boolean).join("\n");
  try {
    const { data } = await db.auth.admin.listUsers({ perPage: 200 });
    const staff = (data?.users ?? []).filter((u) => isStaffRole(accountRole(u)) && u.app_metadata?.role !== "venue").map((u) => u.id);
    if (staff.length) {
      await db.from("notifications").insert(
        staff.map((user_id) => ({ user_id, type: "venue_dj_request", title, body, entity_type: "venue", entity_id: input.venueId }))
      );
    }
  } catch (err) {
    console.error("venue DJ request: bell notification failed", err);
  }
  if (input.contactEmail) {
    try {
      await sendSystemEmail({
        to: input.contactEmail,
        subject: title,
        text: `${title}.\n\n${body}${input.by ? `\n\nSent by: ${input.by}` : ""}\n\nSee it in the CRM under Venue Portals → ${input.venueName}.`
      });
    } catch (err) {
      console.error("venue DJ request: email failed", err);
    }
  }
}

/**
 * Saves the venue's plan for one date: occasion, drink specials and a DJ request.
 * Only a venue manager for that venue may save (staff preview is read-only).
 * Saving with every field empty removes the plan.
 */
export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const access = await requireVenueAccess(typeof body.venue === "string" ? body.venue : null);
  if (access instanceof NextResponse) return access;
  const { venue, user, preview } = access;
  if (preview) return NextResponse.json({ error: "Admin preview is read-only. The venue adds these from their own login." }, { status: 403 });

  const parsed = parsePlanInput(body, todayIso());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const p = parsed.plan;

  try {
    const db = createAdminClient();
    // Venues with several locations keep one plan per location (needs migration 0049, which also adds venues.locations).
    const locs = await loadLocations(db, venue.id);
    const perLocation = locs.ready;
    const location = p.location_id ? locs.locations.find((l) => l.id === p.location_id) ?? null : null;
    if (p.location_id && !location) return NextResponse.json({ error: "Pick one of your locations." }, { status: 400 });
    const locId = location?.id ?? "";
    // Filters for this plan's row: venue + date (+ location once per-location plans exist).
    const key: Record<string, string> = perLocation ? { venue_id: venue.id, night_date: p.date, location_id: locId } : { venue_id: venue.id, night_date: p.date };
    // A DJ picked from the list must be a real DJ profile; its current name wins over what the browser sent.
    let djId = p.dj_request_id;
    let djName = p.dj_request_name;
    if (djId) {
      const { data: dj } = await db.from("djs").select("id, display_name").eq("id", djId).maybeSingle();
      if (dj) djName = dj.display_name as string;
      else djId = null;
    }

    const { data: before, error: readErr } = await db.from("venue_night_plans").select(PLAN_COLUMNS).match(key).maybeSingle();
    if (readErr) {
      if (missingPlansTable(readErr)) return NextResponse.json({ error: "Night plans aren't switched on yet. Ask Digital Crate DJs to finish setup." }, { status: 503 });
      throw readErr;
    }
    const prev = before ? toNightPlan(before) : null;
    const next = { occasion: p.occasion, drink_specials: p.drink_specials, dj_request_id: djId, dj_request_name: djName, dj_request_note: p.dj_request_note };

    if (isEmptyPlan(next)) {
      if (prev) {
        const { error } = await db.from("venue_night_plans").delete().match(key);
        if (error) throw error;
        await audit(venue.id, user, "night_plan.cleared", { date: p.date, location: location?.name ?? null });
      }
      return NextResponse.json({ plan: null, location_id: locId });
    }

    const requestChanged =
      hasDjRequest(next) &&
      (!prev || prev.dj_request_id !== next.dj_request_id || prev.dj_request_name !== next.dj_request_name || prev.dj_request_note !== next.dj_request_note);
    const now = new Date().toISOString();
    const { data: saved, error } = await db
      .from("venue_night_plans")
      .upsert(
        {
          venue_id: venue.id,
          night_date: p.date,
          ...(perLocation ? { location_id: locId } : {}),
          ...next,
          dj_requested_at: hasDjRequest(next) ? (requestChanged ? now : prev?.dj_requested_at ?? now) : null,
          updated_by: user.id,
          updated_at: now,
          ...(prev ? {} : { created_by: user.id })
        },
        { onConflict: perLocation ? "venue_id,night_date,location_id" : "venue_id,night_date" }
      )
      .select(PLAN_COLUMNS)
      .single();
    if (error) throw error;

    await audit(venue.id, user, "night_plan.saved", {
      date: p.date,
      location: location?.name ?? null,
      specials: !!next.drink_specials,
      occasion: next.occasion,
      dj_request: hasDjRequest(next) ? next.dj_request_name ?? "any DJ" : null
    });
    if (requestChanged) {
      await notifyDjRequest({
        venueId: venue.id,
        venueName: venue.name,
        locationName: location?.name ?? null,
        contactEmail: venue.dcdjs_contact_email,
        date: p.date,
        dj: next.dj_request_name,
        occasion: next.occasion,
        note: next.dj_request_note,
        by: user.email ?? null
      });
    }
    return NextResponse.json({ plan: { ...toNightPlan(saved as Record<string, unknown>), location_id: locId } });
  } catch (err) {
    console.error("venue night plan save failed", errorMessage(err));
    return NextResponse.json({ error: "Couldn't save that. Try again." }, { status: 500 });
  }
}
