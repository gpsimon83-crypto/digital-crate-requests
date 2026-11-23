import { cleanScope, type OfferKind, type OfferScope } from "@/lib/data/offers";

const UUID = /^[0-9a-f-]{36}$/i;
const centsOrNull = (v: unknown): number | null | "bad" => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 100_000_000 ? n : "bad";
};

export type OfferInput = {
  dj_id: string | null;
  package_id: string | null;
  kind: OfferKind;
  gig_ids: string[];
  payout_cents: number | null;
  client_price_cents: number | null;
  eligible_cents: number | null;
  third_party_fee_cents: number | null;
  sourced: "company" | "dj";
  basis: Record<string, unknown>;
  scope: OfferScope;
};

/** An offer as an admin fills it in. Amounts in cents. */
export function parseOfferInput(b: Record<string, unknown>): { ok: true; value: OfferInput } | { ok: false; error: string } {
  const money: Record<string, number | null> = {};
  for (const k of ["payoutCents", "clientPriceCents", "eligibleCents", "thirdPartyFeeCents", "discountCents", "includedExtrasCents", "flatAddCents"]) {
    const v = centsOrNull(b[k]);
    if (v === "bad") return { ok: false, error: "Check the amounts: whole dollars and cents, up to $1,000,000." };
    money[k] = v;
  }
  const kind: OfferKind = b.kind === "recurring" ? "recurring" : "one_time";
  const gig_ids = kind === "recurring" && Array.isArray(b.gigIds) ? [...new Set((b.gigIds as unknown[]).filter((x): x is string => typeof x === "string" && UUID.test(x)))].slice(0, 120) : [];
  return {
    ok: true,
    value: {
      dj_id: typeof b.djId === "string" && UUID.test(b.djId) ? b.djId : null,
      package_id: typeof b.packageId === "string" && UUID.test(b.packageId) ? b.packageId : null,
      kind,
      gig_ids,
      payout_cents: money.payoutCents,
      client_price_cents: money.clientPriceCents,
      eligible_cents: money.eligibleCents,
      third_party_fee_cents: money.thirdPartyFeeCents,
      sourced: b.sourced === "dj" ? "dj" : "company",
      basis: {
        rule: b.rule && typeof b.rule === "object" ? b.rule : null,
        suggestedCents: centsOrNull(b.suggestedCents) === "bad" ? null : centsOrNull(b.suggestedCents),
        overridden: !!b.overridden,
        discountCents: money.discountCents,
        includedExtrasCents: money.includedExtrasCents,
        flatAddCents: money.flatAddCents,
        companyShareCents: typeof b.companyShareCents === "number" ? Math.round(b.companyShareCents) : null
      },
      scope: cleanScope(b.scope)
    }
  };
}

/** What has to be true before an offer goes to a DJ. */
export function readyToSend(o: OfferInput, pkg: { quote_before_payment: boolean; pricing_type: string } | null): string | null {
  if (!o.dj_id) return "Pick the DJ first.";
  if (o.payout_cents == null) return "Enter the exact payout before sending.";
  if (o.kind === "recurring" && o.gig_ids.length === 0) return "Pick the dates this offer covers.";
  if (pkg && (pkg.quote_before_payment || pkg.pricing_type !== "fixed") && o.client_price_cents == null) return "This package is quoted: enter the confirmed client price first.";
  return null;
}
