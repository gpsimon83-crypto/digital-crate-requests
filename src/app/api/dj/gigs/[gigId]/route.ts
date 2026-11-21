import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { djIdForUser, loadBrief, type GigRow, type RecapRow } from "@/lib/data/residency";
import { notifyStaff } from "@/lib/notify-submission";
import { fmtGigDate, fmtHours, hhmm, RECAP_PROMPTS, todayIn } from "@/lib/residency";
import { text } from "@/lib/residency-input";
import { isStaffRole, accountRole } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/error-message";

type Ctx = { params: Promise<{ gigId: string }> };

async function load(gigId: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, res: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  const db = createAdminClient();
  const { data } = await db.from("residency_gigs").select("*, residencies(id, name, timezone, venue_id, event_id)").eq("id", gigId).maybeSingle();
  const gig = data as (GigRow & { residencies: { id: string; name: string; timezone: string; venue_id: string | null; event_id: string } | null }) | null;
  if (!gig || !gig.residencies) return { ok: false as const, res: NextResponse.json({ error: "Gig not found" }, { status: 404 }) };
  const dj = await djIdForUser(db, user.id);
  const staff = isStaffRole(accountRole(user));
  // Only the DJ on this gig (and staff) can see it.
  if (!staff && (!dj || gig.dj_id !== dj.id)) return { ok: false as const, res: NextResponse.json({ error: "This gig isn't assigned to you." }, { status: 403 }) };
  return { ok: true as const, db, user, dj, staff, gig, res: gig.residencies };
}

/** The DJ's view of one gig: date, hours, this night's notes, the venue brief, and their recap. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { gigId } = await params;
  const ctx = await load(gigId);
  if (!ctx.ok) return ctx.res;
  const { db, gig, res } = ctx;
  try {
    const { venue, brief, pins } = await loadBrief(db, res.venue_id);
    const { data: addr } = res.venue_id ? await db.from("venues").select("address_line1, city, state, contact_name, contact_phone").eq("id", res.venue_id).maybeSingle() : { data: null };
    const { data: mine } = await db.from("residency_recaps").select("*").eq("gig_id", gig.id).maybeSingle();
    // What previous DJs said the next DJ should know (most recent three).
    const { data: prev } = await db.from("residency_recaps").select("next_dj, submitted_at, gig_id").eq("residency_id", res.id).neq("gig_id", gig.id).order("submitted_at", { ascending: false }).limit(3);
    const today = todayIn(res.timezone);
    return NextResponse.json(
      {
        gig: { id: gig.id, date: gig.gig_date, start: hhmm(gig.start_time), end: hhmm(gig.end_time), hours: fmtHours(hhmm(gig.start_time), hhmm(gig.end_time)), coverage: gig.coverage, outcome: gig.outcome, notes: gig.notes, changeNote: gig.change_note, cancelReason: gig.cancel_reason },
        night: res.name,
        venue: venue ? { name: venue.name, city: venue.city, state: venue.state, cover_url: venue.cover_url, ...(addr as object | null) } : null,
        brief,
        pins,
        fromLastDjs: ((prev ?? []) as { next_dj: string; submitted_at: string }[]).map((p) => ({ text: p.next_dj, at: p.submitted_at })),
        recap: (mine as RecapRow | null) ?? null,
        canRespond: gig.coverage === "awaiting" && gig.outcome === "scheduled" && gig.gig_date >= today,
        canRecap: !mine && gig.coverage === "confirmed" && gig.outcome !== "canceled" && gig.gig_date <= today,
        prompts: RECAP_PROMPTS
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** The assigned DJ: confirm or decline the gig, or submit the recap after it. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { gigId } = await params;
  const ctx = await load(gigId);
  if (!ctx.ok) return ctx.res;
  const { db, user, dj, gig, res } = ctx;
  if (!dj || gig.dj_id !== dj.id) return NextResponse.json({ error: "Only the DJ on this gig can do that." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; recap?: Record<string, unknown> };
  const today = todayIn(res.timezone);
  const now = new Date().toISOString();
  const when = `${res.name} ${fmtGigDate(gig.gig_date)}`;
  try {
    if (b.action === "confirm" || b.action === "decline") {
      if (gig.outcome !== "scheduled" || gig.gig_date < today) return NextResponse.json({ error: "This date can't be changed anymore." }, { status: 400 });
      const patch = b.action === "confirm" ? { coverage: "confirmed", dj_responded_at: now } : { coverage: "unassigned", dj_id: null, dj_responded_at: now };
      const { data } = await db.from("residency_gigs").update({ ...patch, updated_at: now }).eq("id", gig.id).eq("dj_id", dj.id).eq("coverage", b.action === "confirm" ? "awaiting" : gig.coverage).select("id").maybeSingle();
      if (!data) return NextResponse.json({ error: "Already answered. Refresh to see the latest." }, { status: 409 });
      await logActivity({ actorUserId: user.id, action: `residency.dj_${b.action === "confirm" ? "confirmed" : "declined"}`, entityType: "event", entityId: res.event_id, eventId: res.event_id, metadata: { gigId: gig.id, date: gig.gig_date, djId: dj.id } });
      if (b.action === "decline") await notifyStaff({ type: "dj_declined", title: `${dj.display_name} can't cover ${when}`, body: "The date is unassigned again.", eventId: res.event_id }).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    if (b.action === "recap") {
      if (gig.outcome === "canceled" || gig.gig_date > today || gig.coverage !== "confirmed") return NextResponse.json({ error: "Recaps open once the gig has started." }, { status: 400 });
      const answers: Record<string, string | null> = {};
      for (const p of RECAP_PROMPTS) {
        const v = text(b.recap?.[p.key], p.max);
        if (!v) return NextResponse.json({ error: `Answer: ${p.label}` }, { status: 400 });
        answers[p.key] = v;
      }
      const issue = text(b.recap?.issue, 1000);
      const { data, error } = await db.from("residency_recaps").insert({ gig_id: gig.id, residency_id: res.id, event_id: res.event_id, dj_id: dj.id, ...answers, issue, submitted_by: user.id }).select().single();
      if (error) {
        if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "You already sent the recap for this gig." }, { status: 409 });
        throw error;
      }
      if (gig.outcome === "scheduled") await db.from("residency_gigs").update({ outcome: "played", updated_at: now }).eq("id", gig.id);
      if (issue) {
        await db.from("tasks").insert({ event_id: res.event_id, title: `Follow up: issue at ${when}`, due_date: today, created_by: user.id }).then(() => {}, () => {});
        await notifyStaff({ type: "residency_issue", title: `Issue flagged: ${when}`, body: issue, eventId: res.event_id }).catch(() => {});
      }
      await logActivity({ actorUserId: user.id, action: "residency.recap_submitted", entityType: "event", entityId: res.event_id, eventId: res.event_id, metadata: { gigId: gig.id, date: gig.gig_date, issue: !!issue } });
      return NextResponse.json({ recap: data });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
