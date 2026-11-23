/** Add-on fields an admin can edit. Only keys present in the body are returned. */
export function parseAddonInput(b: Record<string, unknown>, creating: boolean): { ok: true; row: Record<string, unknown>; categoryIds?: string[]; packageIds?: string[] } | { ok: false; error: string } {
  const row: Record<string, unknown> = {};
  if ("name" in b || creating) {
    const n = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
    if (!n) return { ok: false, error: "Give the add-on a name." };
    row.name = n;
  }
  if ("description" in b || creating) row.description = typeof b.description === "string" ? b.description.trim().slice(0, 1000) : "";
  if ("price" in b || creating) {
    const p = Number(b.price);
    if (!Number.isFinite(p) || p < 0 || p > 1_000_000) return { ok: false, error: "Enter a price." };
    row.price = Math.round(p * 100) / 100;
  }
  if ("isActive" in b) row.is_active = !!b.isActive;
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)))] : []);
  return { ok: true, row, categoryIds: "categoryIds" in b ? ids(b.categoryIds) : undefined, packageIds: "includedInPackageIds" in b ? ids(b.includedInPackageIds) : undefined };
}
