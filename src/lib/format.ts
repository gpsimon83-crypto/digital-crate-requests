/**
 * Shared display formatters used across the admin dashboard.
 *
 * money() formats a cents integer as a whole-dollar string (no decimals) —
 * this is the right choice for dashboards, stat tiles, and summary tables.
 * Pages that need to show exact cents (e.g. an invoice) intentionally keep
 * their own 2-decimal formatter rather than using this one.
 */
export function money(cents: number) {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

interface ClientLike {
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

/**
 * Resolves a display name for a client/contact record.
 * Returns `null` when there is no client at all — callers that need a
 * fallback string for that case should use `clientName(c) ?? "..."`.
 * The `fallback` param only controls the text used when a client exists
 * but has no company/first/last name set (default: "Unnamed client").
 */
export function clientName(c: ClientLike | null | undefined, fallback = "Unnamed client") {
  if (!c) return null;
  return c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || fallback;
}
