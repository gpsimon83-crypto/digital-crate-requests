import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { financeAccess, listGigs, loadResidency } from "@/lib/data/residency";
import { monthSummary, todayIn } from "@/lib/residency";
import { errorMessage } from "@/lib/error-message";

/**
 * Finance staff: one month of a recurring booking — gigs scheduled, played
 * and canceled, DJ coverage, and per-gig venue payments and DJ payouts.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("finance.view_company");
  if (denied) return denied;
  const { id } = await params;
  const db = createAdminClient();
  try {
    const r = await loadResidency(db, id);
    if (!r) return NextResponse.json({ error: "Not a recurring booking" }, { status: 404 });
    const today = todayIn(r.timezone);
    const qm = req.nextUrl.searchParams.get("month");
    const month = qm && /^\d{4}-(0[1-9]|1[0-2])$/.test(qm) ? qm : today.slice(0, 7);
    const all = await listGigs(db, r.id);
    const gigs = all.filter((g) => g.gig_date.startsWith(month));
    const ids = gigs.map((g) => g.id);
    const { data: pays } = ids.length ? await db.from("payments").select("id, gig_id, amount_cents, status, paid_at, method").in("gig_id", ids).eq("status", "succeeded") : { data: [] };
    const { data: outs } = ids.length ? await db.from("payouts").select("id, gig_id, amount_cents, status, paid_at").in("gig_id", ids) : { data: [] };
    const venuePaid: Record<string, number> = {};
    for (const p of (pays ?? []) as { gig_id: string; amount_cents: number }[]) venuePaid[p.gig_id] = (venuePaid[p.gig_id] ?? 0) + p.amount_cents;
    const payouts: Record<string, { amount_cents: number; status: string; paid_at: string | null }> = {};
    for (const p of (outs ?? []) as { gig_id: string; amount_cents: number; status: string; paid_at: string | null }[]) payouts[p.gig_id] = p;
    const withRates = gigs.map((g) => ({ ...g, venue_fee_cents: g.venue_fee_cents ?? r.venue_fee_cents, dj_payout_cents: g.dj_payout_cents ?? r.dj_payout_cents }));
    const { data: djRows } = await db.from("djs").select("id, display_name");
    const names = new Map(((djRows ?? []) as { id: string; display_name: string }[]).map((d) => [d.id, d.display_name]));
    const months = Array.from(new Set(all.map((g) => g.gig_date.slice(0, 7)).concat(today.slice(0, 7)))).sort();
    return NextResponse.json(
      {
        month,
        months,
        today,
        rates: { venue_fee_cents: r.venue_fee_cents, dj_payout_cents: r.dj_payout_cents, money_notes: r.money_notes },
        canManage: (await financeAccess()).manage,
        summary: monthSummary(withRates, venuePaid, payouts),
        gigs: withRates.map((g) => ({
          id: g.id,
          gig_date: g.gig_date,
          start_time: g.start_time,
          end_time: g.end_time,
          outcome: g.outcome,
          coverage: g.coverage,
          djName: g.dj_id ? (names.get(g.dj_id) ?? "DJ") : null,
          venue_fee_cents: g.venue_fee_cents,
          fee_overridden: all.find((x) => x.id === g.id)?.venue_fee_cents != null,
          venue_paid_cents: venuePaid[g.id] ?? 0,
          dj_payout_cents: payouts[g.id]?.amount_cents ?? g.dj_payout_cents,
          payout_status: payouts[g.id]?.status ?? null
        }))
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
