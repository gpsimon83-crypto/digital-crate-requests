import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { moneyAccess } from "@/lib/money-access";
import { parseOfferInput, readyToSend } from "@/lib/data/offer-input";
import { sendOfferNotice } from "@/lib/data/offer-actions";
import { changesAgreement, type OfferRow } from "@/lib/data/offers";
import { errorMessage } from "@/lib/error-message";

/**
 * Change an offer.
 * - Draft: edit in place; { send: true } sends it.
 * - Offered or accepted: a change to the payout, dates or scope makes a new
 *   version for the DJ to accept (the old one is kept; an accepted one stays
 *   in force until the revision is accepted). Internal-only changes (client
 *   price, fees, notes on how it was worked out) update in place.
 * - { action: "withdraw" } takes back a draft or an open offer.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const money = await moneyAccess();
  if (!money.manage) return NextResponse.json({ error: "Only owners and admins can change DJ offers." }, { status: 403 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const db = createAdminClient();
    const { data: curData } = await db.from("dj_offers").select("*").eq("id", id).maybeSingle();
    const cur = curData as OfferRow | null;
    if (!cur) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    const now = new Date().toISOString();

    if (b.action === "withdraw") {
      if (cur.status !== "draft" && cur.status !== "offered") return NextResponse.json({ error: "Only drafts and open offers can be withdrawn." }, { status: 400 });
      const { data, error } = await db.from("dj_offers").update({ status: "withdrawn", updated_at: now }).eq("id", id).eq("status", cur.status).select().single();
      if (error) throw error;
      return NextResponse.json({ offer: data });
    }

    const parsed = parseOfferInput(b);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const next = parsed.value;
    const pkg = next.package_id ? ((await db.from("packages").select("quote_before_payment, pricing_type").eq("id", next.package_id).maybeSingle()).data as { quote_before_payment: boolean; pricing_type: string } | null) : null;

    if (cur.status === "draft") {
      if (b.send) {
        const why = readyToSend(next, pkg);
        if (why) return NextResponse.json({ error: why }, { status: 400 });
      }
      const { data, error } = await db.from("dj_offers").update({ ...next, status: b.send ? "offered" : "draft", sent_at: b.send ? now : null, updated_at: now }).eq("id", id).eq("status", "draft").select().single();
      if (error) {
        if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "This DJ already has an open offer for this project." }, { status: 409 });
        throw error;
      }
      if (b.send) await sendOfferNotice(db, data as OfferRow & { dj_id: string });
      return NextResponse.json({ offer: data });
    }

    if (cur.status !== "offered" && cur.status !== "accepted") return NextResponse.json({ error: "This offer is closed. Make a new one instead." }, { status: 400 });

    if (!changesAgreement(cur, next)) {
      // Nothing the DJ agreed to changes: keep the version, update the internal side.
      const { data, error } = await db
        .from("dj_offers")
        .update({ client_price_cents: next.client_price_cents, eligible_cents: next.eligible_cents, third_party_fee_cents: next.third_party_fee_cents, sourced: next.sourced, basis: next.basis, package_id: next.package_id, updated_at: now })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ offer: data, revised: false });
    }

    if (!b.send) return NextResponse.json({ error: "That changes what the DJ agreed to. Use Send revised offer so they can accept it." }, { status: 400 });
    const why = readyToSend(next, pkg);
    if (why) return NextResponse.json({ error: why }, { status: 400 });
    // An open offer is replaced; an accepted one stays in force until the DJ accepts the revision.
    if (cur.status === "offered") await db.from("dj_offers").update({ status: "superseded", updated_at: now }).eq("id", id);
    const { data, error } = await db
      .from("dj_offers")
      .insert({ ...next, event_id: cur.event_id, status: "offered", version: cur.version + 1, revises_offer_id: cur.status === "accepted" ? cur.id : (cur.revises_offer_id ?? cur.id), sent_at: now, created_by: money.userId })
      .select()
      .single();
    if (error) {
      if (cur.status === "offered") await db.from("dj_offers").update({ status: "offered" }).eq("id", id);
      if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "There's already a revised offer waiting for this DJ." }, { status: 409 });
      throw error;
    }
    await sendOfferNotice(db, data as OfferRow & { dj_id: string });
    return NextResponse.json({ offer: data, revised: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
