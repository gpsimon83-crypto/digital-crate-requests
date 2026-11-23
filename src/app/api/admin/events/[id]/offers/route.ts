import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { moneyAccess } from "@/lib/money-access";
import { parseOfferInput, readyToSend } from "@/lib/data/offer-input";
import { sendOfferNotice } from "@/lib/data/offer-actions";
import { errorMessage } from "@/lib/error-message";

type Ctx = { params: Promise<{ id: string }> };
const NO_CACHE = { headers: { "Cache-Control": "private, no-store" } };
const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /dj_offers|does not exist/i.test(e.message ?? ""));

/** Every offer version for this project, plus what the offer form needs: the event, packages with payout rules, and upcoming residency dates. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const money = await moneyAccess();
  if (!money.view) return NextResponse.json({ error: "You don't have permission to see DJ payouts." }, { status: 403 });
  const { id } = await params;
  try {
    const db = createAdminClient();
    const offers = await db.from("dj_offers").select("*").eq("event_id", id).order("created_at", { ascending: false });
    if (missing(offers.error)) return NextResponse.json({ ready: false, offers: [] }, NO_CACHE);
    if (offers.error) throw offers.error;
    const [ev, pkgs, gigs, pays] = await Promise.all([
      db.from("events").select("id, title, event_type, starts_at, ends_at, quoted_amount, final_amount, package_id, dj_id").eq("id", id).single(),
      db.from("packages").select("id, name, price, pricing_type, quote_before_payment, is_active, payout_type, payout_percent, payout_flat_cents, eligible_service_cents, third_party_fee_cents").order("position"),
      db.from("residency_gigs").select("id, gig_date, start_time, end_time, dj_id, coverage, outcome").eq("event_id", id).gte("gig_date", new Date().toISOString().slice(0, 10)).order("gig_date").limit(120),
      db.from("payouts").select("id, offer_id, status, amount_cents").eq("event_id", id)
    ]);
    if (ev.error) throw ev.error;
    return NextResponse.json(
      { ready: true, canManage: money.manage, offers: offers.data ?? [], event: ev.data, packages: pkgs.data ?? [], gigs: gigs.error ? [] : (gigs.data ?? []).filter((g) => (g as { outcome: string }).outcome === "scheduled"), payouts: pays.data ?? [] },
      NO_CACHE
    );
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** New offer: saved as a draft, or sent to the DJ ({ send: true }). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const money = await moneyAccess();
  if (!money.manage) return NextResponse.json({ error: "Only owners and admins can make DJ offers." }, { status: 403 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseOfferInput(b);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const o = parsed.value;
  try {
    const db = createAdminClient();
    const pkg = o.package_id ? ((await db.from("packages").select("quote_before_payment, pricing_type").eq("id", o.package_id).maybeSingle()).data as { quote_before_payment: boolean; pricing_type: string } | null) : null;
    if (b.send) {
      const why = readyToSend(o, pkg);
      if (why) return NextResponse.json({ error: why }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { data, error } = await db
      .from("dj_offers")
      .insert({ ...o, event_id: id, status: b.send ? "offered" : "draft", sent_at: b.send ? now : null, created_by: money.userId })
      .select()
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "This DJ already has an open offer for this project. Revise that one instead." }, { status: 409 });
      throw error;
    }
    if (b.send) await sendOfferNotice(db, data as { id: string; dj_id: string; event_id: string; version: number });
    return NextResponse.json({ offer: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
