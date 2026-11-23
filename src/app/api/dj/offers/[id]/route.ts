import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { djIdForUser } from "@/lib/data/residency";
import { applyAcceptance } from "@/lib/data/offer-actions";
import type { OfferRow } from "@/lib/data/offers";
import { notifyStaff } from "@/lib/notify-submission";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/error-message";

/** The DJ on an open offer accepts or declines it. Accepting saves the payout and scope exactly as offered. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  if (b.action !== "accept" && b.action !== "decline") return NextResponse.json({ error: "Accept or decline" }, { status: 400 });
  try {
    const db = createAdminClient();
    const dj = await djIdForUser(db, user.id);
    if (!dj) return NextResponse.json({ error: "Only DJs can answer offers." }, { status: 403 });
    const now = new Date().toISOString();
    // Only flips an offer that is still open and theirs (a second click or a withdrawn offer gets a 409).
    const { data } = await db
      .from("dj_offers")
      .update({ status: b.action === "accept" ? "accepted" : "declined", responded_at: now, updated_at: now })
      .eq("id", id)
      .eq("dj_id", dj.id)
      .eq("status", "offered")
      .select()
      .maybeSingle();
    const offer = data as OfferRow | null;
    if (!offer) return NextResponse.json({ error: "This offer isn't open anymore. Refresh to see the latest." }, { status: 409 });
    const { data: ev } = await db.from("events").select("title").eq("id", offer.event_id).maybeSingle();
    const title = (ev as { title: string } | null)?.title ?? "a gig";
    let notes: string[] = [];
    if (b.action === "accept") {
      const previous = offer.revises_offer_id ? ((await db.from("dj_offers").select("*").eq("id", offer.revises_offer_id).maybeSingle()).data as OfferRow | null) : null;
      notes = await applyAcceptance(db, offer, previous);
    }
    await logActivity({ actorUserId: user.id, action: `dj_offer.${b.action === "accept" ? "accepted" : "declined"}`, entityType: "event", entityId: offer.event_id, eventId: offer.event_id, metadata: { offerId: offer.id, version: offer.version, djId: dj.id } }).catch(() => {});
    await notifyStaff({ type: b.action === "accept" ? "dj_offer_accepted" : "dj_declined", title: `${dj.display_name} ${b.action === "accept" ? "accepted" : "declined"} the offer for ${title}`, body: notes.join(" ") || (b.action === "accept" ? "The payout is saved on the project." : "The offer is closed. Send it to another DJ from the project."), eventId: offer.event_id }).catch(() => {});
    return NextResponse.json({ ok: true, status: offer.status });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
