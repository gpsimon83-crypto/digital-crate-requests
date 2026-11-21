import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/comm/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRIEF_FIELDS, type Brief } from "@/lib/residency";
import { missingTable } from "@/lib/data/residency";
import { text } from "@/lib/residency-input";
import { errorMessage } from "@/lib/error-message";

async function audit(db: ReturnType<typeof createAdminClient>, venueId: string, actor: string, action: string, detail: Record<string, unknown>) {
  await db.from("venue_audit_log").insert({ venue_id: venueId, actor_id: actor, actor_label: "staff", action, detail });
}

/** Staff: the venue's standing DJ brief (load-in, house gear, music direction, expectations). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffUser();
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { brief?: Record<string, unknown> };
  const brief: Brief = {};
  for (const f of BRIEF_FIELDS) {
    const v = text(b.brief?.[f.key], 1500);
    if (v) brief[f.key] = v;
  }
  const db = createAdminClient();
  try {
    const { error } = await db.from("venues").update({ dj_brief: brief, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      if (["42703", "PGRST204"].includes((error as { code?: string }).code ?? "")) return NextResponse.json({ error: "Run migration 0061_recurring_venue_gigs.sql first." }, { status: 503 });
      throw error;
    }
    await audit(db, id, staff.userId, "dj_brief.updated", { fields: Object.keys(brief) });
    return NextResponse.json({ brief });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** Staff: pin recurring advice to the brief (the dated recap stays as it was). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffUser();
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { text?: string; recapId?: string };
  const t = text(b.text, 500);
  if (!t) return NextResponse.json({ error: "Write the advice to pin." }, { status: 400 });
  const db = createAdminClient();
  try {
    let gigDate: string | null = null;
    if (b.recapId) {
      const { data: rc } = await db.from("residency_recaps").select("id, gig_id, residencies(venue_id)").eq("id", b.recapId).maybeSingle();
      const rec = rc as { gig_id: string; residencies: { venue_id: string | null } | null } | null;
      if (!rec || rec.residencies?.venue_id !== id) return NextResponse.json({ error: "That recap isn't from this venue." }, { status: 400 });
      const { data: g } = await db.from("residency_gigs").select("gig_date").eq("id", rec.gig_id).maybeSingle();
      gigDate = (g as { gig_date: string } | null)?.gig_date ?? null;
    }
    const { data, error } = await db.from("venue_brief_pins").insert({ venue_id: id, text: t, recap_id: b.recapId || null, gig_date: gigDate, pinned_by: staff.userId }).select("id, text, gig_date, recap_id").single();
    if (error) {
      if (missingTable(error)) return NextResponse.json({ error: "Run migration 0061_recurring_venue_gigs.sql first." }, { status: 503 });
      throw error;
    }
    await audit(db, id, staff.userId, "dj_brief.pinned", { pinId: (data as { id: string }).id });
    return NextResponse.json({ pin: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** Staff: unpin advice. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffUser();
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;
  const pin = req.nextUrl.searchParams.get("pin");
  if (!pin) return NextResponse.json({ error: "Which pin?" }, { status: 400 });
  const db = createAdminClient();
  const { error } = await db.from("venue_brief_pins").delete().eq("id", pin).eq("venue_id", id);
  if (error) return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  await audit(db, id, staff.userId, "dj_brief.unpinned", { pinId: pin });
  return NextResponse.json({ ok: true });
}
