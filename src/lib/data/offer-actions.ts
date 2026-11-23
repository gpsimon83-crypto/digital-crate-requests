import type { createAdminClient } from "@/lib/supabase/admin";
import type { OfferRow } from "@/lib/data/offers";

type Db = ReturnType<typeof createAdminClient>;

/** Bell notification to the DJ that an offer (or a revised one) is waiting. Never throws. */
export async function sendOfferNotice(db: Db, o: { id: string; dj_id: string; event_id: string; version: number }) {
  try {
    const [{ data: dj }, { data: ev }] = await Promise.all([db.from("djs").select("auth_user_id").eq("id", o.dj_id).maybeSingle(), db.from("events").select("title").eq("id", o.event_id).maybeSingle()]);
    const uid = (dj as { auth_user_id: string | null } | null)?.auth_user_id;
    if (!uid) return;
    await db.from("notifications").insert({
      user_id: uid,
      type: "dj_offer",
      title: o.version > 1 ? `Revised offer: ${(ev as { title: string } | null)?.title ?? "a gig"}` : `New gig offer: ${(ev as { title: string } | null)?.title ?? "a gig"}`,
      body: "See your payout and the details, then accept or decline.",
      entity_type: "dj_offer",
      entity_id: o.id,
      event_id: o.event_id
    });
  } catch {
    // The Offers page still lists it.
  }
}

/**
 * The DJ accepted: lock it in. For a one-time gig this sets them on the
 * project and records the agreed payout in Finance as Pending (updating the
 * previous version's payout while it's still unpaid). For a residency it
 * confirms them on the covered dates at the per-date payout.
 */
export async function applyAcceptance(db: Db, o: OfferRow, previous: OfferRow | null): Promise<string[]> {
  const notes: string[] = [];
  const now = new Date().toISOString();
  if (previous && previous.status === "accepted") {
    await db.from("dj_offers").update({ status: "superseded", updated_at: now }).eq("id", previous.id);
  }
  if (o.kind === "one_time") {
    await db.from("events").update({ dj_id: o.dj_id }).eq("id", o.event_id);
    const amount = o.payout_cents ?? 0;
    const prior = previous ? ((await db.from("payouts").select("id, status").eq("offer_id", previous.id).maybeSingle()).data as { id: string; status: string } | null) : null;
    if (prior && prior.status !== "paid") {
      if (amount > 0) await db.from("payouts").update({ amount_cents: amount, offer_id: o.id, notes: `Agreed in offer v${o.version}`, updated_at: now }).eq("id", prior.id);
      else await db.from("payouts").delete().eq("id", prior.id);
    } else {
      if (prior?.status === "paid") notes.push("The earlier payout was already paid, so the new amount was added as a separate pending payout. Check Finance.");
      if (amount > 0) await db.from("payouts").insert({ event_id: o.event_id, dj_id: o.dj_id, amount_cents: amount, status: "pending", offer_id: o.id, notes: `Agreed in offer v${o.version}` });
    }
  } else if (o.gig_ids.length) {
    const { data: gigs } = await db.from("residency_gigs").select("id, dj_id, outcome").in("id", o.gig_ids);
    for (const g of (gigs ?? []) as { id: string; dj_id: string | null; outcome: string }[]) {
      if (g.outcome !== "scheduled" || (g.dj_id && g.dj_id !== o.dj_id)) {
        notes.push("Some dates had another DJ or weren't scheduled anymore, so they were left as they were.");
        continue;
      }
      await db.from("residency_gigs").update({ dj_id: o.dj_id, coverage: "confirmed", dj_payout_cents: o.payout_cents, dj_responded_at: now, updated_at: now }).eq("id", g.id);
    }
  }
  return [...new Set(notes)];
}
