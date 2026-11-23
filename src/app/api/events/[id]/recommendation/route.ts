import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEventAccess } from "@/lib/require-event-access";
import { linkForEvent } from "@/lib/data/questionnaire-links";
import { basicsFor } from "@/lib/data/basics";
import { loadAdminCatalog } from "@/lib/data/catalog";
import { moneyAccess } from "@/lib/money-access";
import { categorySlugFor, needsFromEventBasics, needsFromProject, needsFromWeddingBasics, recommendFromCatalog, type EventNeeds } from "@/lib/catalog-recommend";
import { computePayout } from "@/lib/payouts/rule";
import { isAnswered } from "@/lib/questionnaire-engine";

type P = { params: Promise<{ id: string }> };
const uuidOk = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const noStore = { "Cache-Control": "private, no-store" };

/**
 * The recommended Services package and estimated price for this project,
 * from the Basics answers (or the project's details until they answer).
 * Staff and the project's DJ only; never the client. Staff with finance
 * access also get the DJ payout and DCDJs share estimates.
 */
export async function GET(_req: NextRequest, { params }: P) {
  const id = (await params).id;
  if (!uuidOk(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const db = createAdminClient();
    const b = await basicsFor(db, id);
    if (!b.event) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const money = access.isAdmin ? await moneyAccess() : { view: false, manage: false };
    const catalog = await loadAdminCatalog(db, { withPayout: money.view });
    if (!catalog.ready) return NextResponse.json({ ready: false }, { headers: noStore });

    const link = b.template ? await linkForEvent(db, id, b.template.id) : null;
    const answers = link?.answers ?? {};
    const answeredAny = Object.keys(answers).some((k) => isAnswered(answers, k));
    const gigs = await db.from("residency_gigs").select("id", { count: "exact", head: true }).eq("event_id", id);
    const base = answeredAny ? (b.kind === "wedding" ? needsFromWeddingBasics(answers) : needsFromEventBasics(answers)) : needsFromProject(b.event);
    const needs: EventNeeds = { ...base, category: categorySlugFor(b.event.event_category, b.event.event_type), recurring: !gigs.error && (gigs.count ?? 0) > 0 };
    const rec = recommendFromCatalog(catalog, needs);

    const options = rec.options.map((o) => {
      if (!money.view) return o;
      const p = catalog.packages.find((x) => x.id === o.packageId);
      if (!p || o.estimateCents == null || !p.payout_type) return { ...o, payout: null };
      const r = computePayout({ rule: { type: p.payout_type, percent: Number(p.payout_percent ?? 55), flatCents: p.payout_flat_cents ?? null }, clientPriceCents: o.estimateCents, eligibleCents: p.eligible_service_cents ?? null, thirdPartyFeeCents: p.third_party_fee_cents ?? 0 });
      return { ...o, payout: { djCents: r.payoutCents, companyCents: r.companyShareCents } };
    });
    return NextResponse.json(
      {
        ready: true,
        source: needs.source,
        kind: b.kind,
        answeredAt: link?.completed_at ?? null,
        needs,
        notes: rec.notes,
        options,
        currentPackageId: b.event.package_id,
        canUse: access.isAdmin,
        showsPayout: money.view
      },
      { headers: noStore }
    );
  } catch {
    return NextResponse.json({ error: "Couldn't work out a recommendation right now." }, { status: 503 });
  }
}

/** Staff: set the project's package (used to suggest the DJ offer payout). */
export async function POST(req: NextRequest, { params }: P) {
  const id = (await params).id;
  if (!uuidOk(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!access.isAdmin) return NextResponse.json({ error: "Only the office can set the project's package." }, { status: 403 });
  const { packageId } = (await req.json().catch(() => ({}))) as { packageId?: unknown };
  if (packageId !== null && (typeof packageId !== "string" || !uuidOk(packageId))) return NextResponse.json({ error: "Pick a package" }, { status: 400 });
  const db = createAdminClient();
  if (packageId) {
    const { data } = await db.from("packages").select("id").eq("id", packageId).eq("is_active", true).maybeSingle();
    if (!data) return NextResponse.json({ error: "That package isn't active." }, { status: 400 });
  }
  const { error } = await db.from("events").update({ package_id: packageId }).eq("id", id);
  if (error) return NextResponse.json({ error: "Couldn't save" }, { status: 503 });
  return NextResponse.json({ ok: true, packageId });
}
