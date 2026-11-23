/**
 * DJ payout math for packages and assignment offers. Admin-only: none of
 * this is ever sent to a client, and a DJ only ever sees the final payout.
 *
 * Percentage payouts are worked out on the eligible DJ service amount (the
 * whole price unless a bundle says otherwise) after any discount on that
 * service, plus any DJ-delivered extras an admin chooses to include. Sales
 * tax, tips, band fees, third-party rentals and company-only production are
 * never part of it. A flat amount for extra duties or gear is added on top.
 */

export type PayoutType = "percent" | "flat";
export type Sourced = "company" | "dj";

export type PayoutRule = {
  type: PayoutType;
  /** 0–100. Used when type is "percent". */
  percent: number;
  /** Used when type is "flat". */
  flatCents: number | null;
};

/** Company-sourced jobs. */
export const STANDARD_PERCENT = 55;
/** The DJ brought the client, performs and supplies the agreed gear. */
export const DJ_SOURCED_PERCENT = 65;

export type PayoutInput = {
  rule: PayoutRule;
  /** What the client pays for the package, before tax and tips. */
  clientPriceCents: number;
  /** The DJ-service part of the price (bundles). Defaults to the client price. */
  eligibleCents?: number | null;
  /** Discount allocated to the DJ service. */
  discountCents?: number;
  sourced?: Sourced;
  /** DJ-delivered extras an admin chose to include in the base. */
  includedExtrasCents?: number;
  /** Flat amount for extra duties or equipment, added after the percentage. */
  flatAddCents?: number;
  /** Known third-party costs (band fee, rentals): outside the payout, taken off the company share. */
  thirdPartyFeeCents?: number;
};

export type PayoutResult = {
  /** The amount the percentage applied to (null for a flat rule). */
  baseCents: number | null;
  percentApplied: number | null;
  payoutCents: number;
  /** Client price, less the service discount, the payout and third-party fees. Before other expenses. */
  companyShareCents: number;
};

const cents = (n: number | null | undefined) => (Number.isFinite(n) ? Math.max(0, Math.round(n as number)) : 0);

export function computePayout(input: PayoutInput): PayoutResult {
  const price = cents(input.clientPriceCents);
  const discount = cents(input.discountCents);
  const flatAdd = cents(input.flatAddCents);
  const third = cents(input.thirdPartyFeeCents);
  let baseCents: number | null = null;
  let percentApplied: number | null = null;
  let payout: number;
  if (input.rule.type === "flat") {
    payout = cents(input.rule.flatCents) + flatAdd;
  } else {
    const eligible = input.eligibleCents == null ? price : cents(input.eligibleCents);
    baseCents = Math.max(0, eligible - discount + cents(input.includedExtrasCents));
    percentApplied = input.sourced === "dj" ? DJ_SOURCED_PERCENT : Math.min(100, Math.max(0, input.rule.percent));
    payout = Math.round((baseCents * percentApplied) / 100) + flatAdd;
  }
  return { baseCents, percentApplied, payoutCents: payout, companyShareCents: price - discount - payout - third };
}

export const dollars = (c: number | null | undefined) =>
  c == null ? "—" : `${c < 0 ? "−" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: Math.abs(c) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** "550.5" / "$1,150" → cents, or null when blank or not a number. */
export function parseDollars(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
