import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/comm/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listGigs, loadResidency, notifyDj } from "@/lib/data/residency";
import { fmtGigDate, isDate, isTime, todayIn } from "@/lib/residency";
import { text } from "@/lib/residency-input";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/error-message";

/** Staff: schedule a one-off date for this recurring booking. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffUser();
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { date?: string; start?: string; end?: string; notes?: string; djId?: string | null };
  const db = createAdminClient();
  try {
    const r = await loadResidency(db, id);
    if (!r) return NextResponse.json({ error: "Not a recurring booking" }, { status: 404 });
    if (!isDate(b.date)) return NextResponse.json({ error: "Choose a date." }, { status: 400 });
    if (b.date < todayIn(r.timezone)) return NextResponse.json({ error: "Pick today or a later date." }, { status: 400 });
    const start = b.start ?? r.start_time;
    const end = b.end ?? r.end_time;
    if (!isTime(start) || !isTime(end) || start === end) return NextResponse.json({ error: "Enter the set start and end times." }, { status: 400 });
    const gigs = await listGigs(db, r.id);
    if (gigs.some((g) => (g.gig_date === b.date || g.slot_date === b.date) && g.outcome !== "canceled")) return NextResponse.json({ error: `There's already a gig on ${fmtGigDate(b.date)}.` }, { status: 409 });
    const dj = b.djId || null;
    const row = { residency_id: r.id, event_id: id, slot_date: b.date, gig_date: b.date, start_time: start, end_time: end, notes: text(b.notes, 1000), dj_id: dj, coverage: dj ? "awaiting" : "unassigned", source: "manual", detached: true };
    // A canceled gig already holds this slot: bring it back with the new details instead of a duplicate.
    const held = gigs.find((g) => g.slot_date === b.date);
    const { data, error } = held
      ? await db.from("residency_gigs").update({ ...row, outcome: "scheduled", cancel_reason: null, updated_at: new Date().toISOString() }).eq("id", held.id).select().single()
      : await db.from("residency_gigs").insert(row).select().single();
    if (error) {
      if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "That date is already scheduled." }, { status: 409 });
      throw error;
    }
    const gig = data as { id: string };
    if (dj) await notifyDj(db, dj, { title: `${r.name}: ${fmtGigDate(b.date)}`, body: "You've been asked to cover this date. Confirm or decline in My Bookings.", eventId: id, gigId: gig.id });
    await logActivity({ actorUserId: staff.userId, action: "residency.gig_added", entityType: "event", entityId: id, eventId: id, metadata: { gigId: gig.id, date: b.date } });
    return NextResponse.json({ gig });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
