export const PAYMENT_METHODS = {
  cash: "Cash",
  check: "Check",
  zelle: "Zelle",
  venmo: "Venmo",
  cash_app: "Cash App",
  paypal: "PayPal",
  bank_transfer: "Bank transfer",
  card: "Card",
  other: "Other"
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;
export const PAYMENT_KINDS = { deposit: "Deposit / retainer", balance: "Balance", other: "Other" } as const;
export type PaymentKind = keyof typeof PAYMENT_KINDS;

/** Validates a hand-entered payment. Amount in dollars ("1,250.50" ok); paid date YYYY-MM-DD, not in the future. */
export function parseManualPayment(b: Record<string, unknown>, today: string) {
  const amount = Number(String(b.amount ?? "").replace(/[$,\s]/g, ""));
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || cents <= 0 || cents > 100_000_00) return { error: "Enter an amount between $0.01 and $100,000." } as const;
  const kind = String(b.kind ?? "");
  if (!(kind in PAYMENT_KINDS)) return { error: "Choose what the payment was for." } as const;
  const method = String(b.method ?? "");
  if (!(method in PAYMENT_METHODS)) return { error: "Choose how they paid." } as const;
  const paidOn = String(b.paidOn ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || Number.isNaN(Date.parse(paidOn))) return { error: "Enter the date it was paid." } as const;
  if (paidOn > today) return { error: "The paid date can't be in the future." } as const;
  const reference = String(b.reference ?? "").trim().slice(0, 120) || null;
  const note = String(b.note ?? "").trim().slice(0, 1000) || null;
  return { value: { cents, kind: kind as PaymentKind, method: method as PaymentMethod, paidOn, reference, note } } as const;
}
