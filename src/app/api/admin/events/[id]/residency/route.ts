import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/comm/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureGigs, financeAccess, listGigs, loadResidency, missingTable, notifyDj, residencyView } from "@/lib/data/residency";
import { gigsForFutureDj, planScheduleChange, recurrenceLabel, todayIn, validateSchedule, type Schedule } from "@/lib/residency";
import { centsFrom, text } from "@/lib/residency-input";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/error-message";

const NO_CACHE = { headers: { "Cache-Control": "private, no-store" } };

/** Staff: the recurring booking on this project (generates upcoming dates first). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffUser();
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;
  try {
    const fin = await financeAccess();
    const view = await residencyView(id, { finance: fin.view });
    return NextResponse.json(view ? { ...view, canManageMoney: fin.manage } : { residency: null, canManageMoney: fin.manage, today: todayIn("America/Chicago") }, NO_CACHE);
  } catch (err) {
    if (missingTable(err)) return NextResponse.json({ residency: null, ready: false }, NO_CACHE);
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

type Body = Partial<Schedule> & {
  name?: string;
  defaultDjId?: string | null;
  applyDjToFuture?: boolean;
  effectiveFrom?: string;
  venueFee?: unknown;
  djPayout?: unknown;
  moneyNotes?: unknown;
  active?: boolean;
  timezone?: string;
};

async function moneyPatch(b: Body): Promise<Record<string, unknown> | NextResponse> {
  const out: Record<string, unknown> = {};
  if (b.venueFee === undefined && b.djPayout === undefined && b.moneyNotes === undefined) return out;
  const fin = await financeAccess();
  if (!fin.manage) return NextResponse.json({ error: "You don't have permission to change rates." }, { status: 403 });
  const fee = centsFrom(b.venueFee);
  const pay = centsFrom(b.djPayout);
  if (fee === "bad" || pay === "bad") return NextResponse.json({ error: "Enter rates in dollars, up to $100,000." }, { status: 400 });
  if (fee !== undefined) out.venue_fee_cents = fee;
  if (pay !== undefined) out.dj_payout_cents = pay;
  if (b.moneyNotes !== undefined) out.money_notes = text(b.moneyNotes, 2000);
  return out;
}

/** Staff: make this Bar / Club project a recurring booking. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffUser();
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Body;
  const name = text(b.name, 80);
  if (!name) return NextResponse.json({ error: "Name the night (e.g. Sunday Funday)." }, { status: 400 });
  const s = validateSchedule(b);
  if ("error" in s) return NextResponse.json({ error: s.error }, { status: 400 });
  const money = await moneyPatch(b);
  if (money instanceof NextResponse) return money;

  const db = createAdminClient();
  const { data: ev } = await db.from("events").select("id, event_category, venue_id, timezone").eq("id", id).maybeSingle();
  const e = ev as { event_category: string | null; venue_id: string | null; timezone: string | null } | null;
  if (!e) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (e.event_category !== "bar_nightclub") return NextResponse.json({ error: "Only Bar / Club projects can be recurring." }, { status: 400 });
  try {
    const { data, error } = await db
      .from("residencies")
      .insert({ event_id: id, venue_id: e.venue_id, name, ...s.value, timezone: e.timezone || "America/Chicago", default_dj_id: b.defaultDjId || null, created_by: staff.userId, ...money })
      .select("id")
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "This project is already a recurring booking." }, { status: 409 });
      if (missingTable(error)) return NextResponse.json({ error: "Run migration 0061_recurring_venue_gigs.sql first." }, { status: 503 });
      throw error;
    }
    const r = await loadResidency(db, id);
    if (r) await ensureGigs(db, r);
    await logActivity({ actorUserId: staff.userId, action: "residency.created", entityType: "event", entityId: id, eventId: id, metadata: { residencyId: (data as { id: string }).id, name, schedule: recurrenceLabel(s.value) } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/**
 * Staff: change the recurring booking. Schedule and hours changes are
 * "this and future gigs" from `effectiveFrom` (never before today); past
 * gigs, "this gig only" edits and manual dates are left alone.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffUser();
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Body;
  const db = createAdminClient();
  try {
    const r = await loadResidency(db, id);
    if (!r) return NextResponse.json({ error: "Not a recurring booking" }, { status: 404 });
    const money = await moneyPatch(b);
    if (money instanceof NextResponse) return money;
    const patch: Record<string, unknown> = { ...money, updated_at: new Date().toISOString() };
    if (b.name !== undefined) {
      const n = text(b.name, 80);
      if (!n) return NextResponse.json({ error: "Name the night." }, { status: 400 });
      patch.name = n;
    }
    if (b.active !== undefined) patch.active = !!b.active;
    const today = todayIn(r.timezone);
    const from = b.effectiveFrom && b.effectiveFrom > today ? b.effectiveFrom : today;
    let changed = { removed: 0, kept: 0, retimed: 0, reassigned: 0 };

    const scheduleSent = ["pattern", "weekday", "weeks", "start_time", "end_time", "starts_on", "ends_on"].some((k) => k in b);
    let gigs = await listGigs(db, r.id);
    if (scheduleSent) {
      const s = validateSchedule({ ...r, ...b });
      if ("error" in s) return NextResponse.json({ error: s.error }, { status: 400 });
      const plan = planScheduleChange(s.value, gigs, from);
      if (plan.remove.length) await db.from("residency_gigs").delete().in("id", plan.remove).eq("outcome", "scheduled").is("dj_id", null);
      if (plan.keepOff.length) await db.from("residency_gigs").update({ off_schedule: true, updated_at: patch.updated_at }).in("id", plan.keepOff);
      for (const t of plan.retime) await db.from("residency_gigs").update({ start_time: t.start_time, end_time: t.end_time, ...(t.change_note ? { change_note: t.change_note } : {}), updated_at: patch.updated_at }).eq("id", t.id);
      Object.assign(patch, s.value);
      changed = { ...changed, removed: plan.remove.length, kept: plan.keepOff.length, retimed: plan.retime.length };
    }
    if (b.defaultDjId !== undefined) {
      const dj = b.defaultDjId || null;
      patch.default_dj_id = dj;
      if (b.applyDjToFuture) {
        const targets = gigsForFutureDj(gigs, dj, from);
        for (const g of targets) await db.from("residency_gigs").update({ dj_id: dj, coverage: dj ? "awaiting" : "unassigned", dj_responded_at: null, updated_at: patch.updated_at }).eq("id", g.id);
        changed.reassigned = targets.length;
        if (dj && targets.length) await notifyDj(db, dj, { title: `${targets.length} ${r.name} gigs to confirm`, body: "Open My Bookings to confirm or decline each date.", eventId: id, gigId: targets[0].id });
      }
    }
    const { error } = await db.from("residencies").update(patch).eq("id", r.id);
    if (error) throw error;
    const fresh = await loadResidency(db, id);
    gigs = await listGigs(db, r.id);
    if (fresh) await ensureGigs(db, fresh, gigs);
    await logActivity({ actorUserId: staff.userId, action: "residency.updated", entityType: "event", entityId: id, eventId: id, metadata: { from, ...changed, fields: Object.keys(patch).filter((k) => k !== "updated_at") } });
    return NextResponse.json({ ok: true, changed });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
