/** Dollars ("1,250", "$200.50") → cents; "" / null → null. undefined = not sent. */
export function centsFrom(v: unknown): number | null | undefined | "bad" {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 100_000) return "bad";
  return Math.round(n * 100);
}
export const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
