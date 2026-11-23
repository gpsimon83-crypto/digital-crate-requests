import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * The services catalog: event categories, packages (each in one or more
 * categories, with its order in each), and add-ons (offered in some or all
 * categories, and included in some packages).
 *
 * Two shapes leave the server: the admin catalog (with the DJ payout rule
 * for people allowed to see it) and the public catalog (only what a client
 * should see). Build both from here so nothing internal slips into the
 * public one.
 */

export type PricingType = "fixed" | "starting_at" | "quote";
export const PRICING_TYPES: PricingType[] = ["fixed", "starting_at", "quote"];
export const PRICING_LABEL: Record<PricingType, string> = { fixed: "Fixed price", starting_at: "Starting at", quote: "Request a quote" };

export type Category = { id: string; slug: string; name: string; position: number; is_active: boolean };

export type PayoutFields = {
  payout_type: "percent" | "flat";
  payout_percent: number;
  payout_flat_cents: number | null;
  eligible_service_cents: number | null;
  third_party_fee_cents: number | null;
};

export type AdminPackage = {
  id: string;
  name: string;
  description: string;
  price: number;
  hours: number | null;
  features: string[];
  is_active: boolean;
  pricing_type: PricingType;
  quote_before_payment: boolean;
  /** Categories it's in, with its order in each. */
  categories: { category_id: string; position: number }[];
  /** Add-ons it already includes. */
  included_addon_ids: string[];
} & Partial<PayoutFields>;

export type AdminAddon = {
  id: string;
  name: string;
  description: string;
  price: number;
  position: number;
  is_active: boolean;
  /** Empty = offered in every category. */
  category_ids: string[];
};

export type AdminCatalog = { categories: Category[]; packages: AdminPackage[]; addons: AdminAddon[]; ready: boolean };

const PKG_COLS = "id, name, description, price, hours, features, is_active, position, pricing_type, quote_before_payment";
const PAYOUT_COLS = "payout_type, payout_percent, payout_flat_cents, eligible_service_cents, third_party_fee_cents";

/** Is migration 0066 in? (Missing tables/columns come back as errors, not throws.) */
function missing(err: { code?: string; message?: string } | null) {
  return !!err && (err.code === "42P01" || err.code === "42703" || err.code === "PGRST205" || err.code === "PGRST204" || /does not exist|schema cache/i.test(err.message ?? ""));
}

export async function loadAdminCatalog(db: Db, { withPayout }: { withPayout: boolean }): Promise<AdminCatalog> {
  const [cats, pkgs, links, incl, addons, addonLinks] = await Promise.all([
    db.from("service_categories").select("id, slug, name, position, is_active").order("position"),
    db.from("packages").select(withPayout ? `${PKG_COLS}, ${PAYOUT_COLS}` : PKG_COLS).order("position"),
    db.from("package_category_links").select("package_id, category_id, position"),
    db.from("package_included_addons").select("package_id, addon_id"),
    db.from("package_addons").select("id, name, description, price, position, is_active").order("position"),
    db.from("addon_category_links").select("addon_id, category_id")
  ]);
  if (missing(cats.error) || missing(pkgs.error) || missing(links.error)) {
    // Before migration 0066: show the old flat list so nothing disappears.
    const [p, a] = await Promise.all([db.from("packages").select("id, name, description, price, hours, features, is_active, position").order("position"), db.from("package_addons").select("id, name, description, price, position, is_active").order("position")]);
    if (p.error) throw p.error;
    if (a.error) throw a.error;
    return {
      ready: false,
      categories: [],
      packages: (p.data ?? []).map((r) => ({ ...(r as Omit<AdminPackage, "pricing_type" | "quote_before_payment" | "categories" | "included_addon_ids">), pricing_type: "fixed", quote_before_payment: false, categories: [], included_addon_ids: [] })),
      addons: (a.data ?? []).map((r) => ({ ...(r as Omit<AdminAddon, "category_ids">), category_ids: [] }))
    };
  }
  for (const r of [cats, pkgs, links, incl, addons, addonLinks]) if (r.error) throw r.error;
  const linkRows = (links.data ?? []) as { package_id: string; category_id: string; position: number }[];
  const inclRows = (incl.data ?? []) as { package_id: string; addon_id: string }[];
  const aLinks = (addonLinks.data ?? []) as { addon_id: string; category_id: string }[];
  return {
    ready: true,
    categories: (cats.data ?? []) as Category[],
    packages: ((pkgs.data ?? []) as unknown as (Omit<AdminPackage, "categories" | "included_addon_ids"> & { features: unknown })[]).map((p) => ({
      ...p,
      price: Number(p.price),
      hours: p.hours == null ? null : Number(p.hours),
      features: Array.isArray(p.features) ? (p.features as unknown[]).filter((f): f is string => typeof f === "string") : [],
      ...(withPayout && p.payout_percent != null ? { payout_percent: Number(p.payout_percent) } : {}),
      categories: linkRows.filter((l) => l.package_id === p.id).map((l) => ({ category_id: l.category_id, position: l.position })),
      included_addon_ids: inclRows.filter((i) => i.package_id === p.id).map((i) => i.addon_id)
    })),
    addons: ((addons.data ?? []) as AdminAddon[]).map((a) => ({ ...a, price: Number(a.price), category_ids: aLinks.filter((l) => l.addon_id === a.id).map((l) => l.category_id) }))
  };
}

// ---------------------------------------------------------------- public

export type PublicPackage = {
  id: string;
  name: string;
  description: string;
  pricing_type: PricingType;
  /** Null for "Request a quote". */
  price: number | null;
  hours: number | null;
  features: string[];
  quote_before_payment: boolean;
  included_addons: string[];
};
export type PublicAddon = { id: string; name: string; description: string; price: number };
export type PublicCategory = { slug: string; name: string; packages: PublicPackage[]; addons: PublicAddon[] };

/** What a client may see: active categories with their active packages in order, and the add-ons offered there. No payout or cost data. */
export function toPublicCatalog(c: AdminCatalog): PublicCategory[] {
  const addonById = new Map(c.addons.map((a) => [a.id, a]));
  return c.categories
    .filter((cat) => cat.is_active)
    .map((cat) => {
      const pkgs = c.packages
        .filter((p) => p.is_active)
        .map((p) => ({ p, link: p.categories.find((l) => l.category_id === cat.id) }))
        .filter((x): x is { p: AdminPackage; link: { category_id: string; position: number } } => !!x.link)
        .sort((a, b) => a.link.position - b.link.position || a.p.name.localeCompare(b.p.name))
        .map(({ p }) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          pricing_type: p.pricing_type,
          price: p.pricing_type === "quote" ? null : p.price,
          hours: p.hours,
          features: p.features,
          quote_before_payment: p.quote_before_payment,
          included_addons: p.included_addon_ids.map((id) => addonById.get(id)).filter((a): a is AdminAddon => !!a && a.is_active).map((a) => a.name)
        }));
      const addons = c.addons
        .filter((a) => a.is_active && (a.category_ids.length === 0 || a.category_ids.includes(cat.id)))
        .map((a) => ({ id: a.id, name: a.name, description: a.description, price: a.price }));
      return { slug: cat.slug, name: cat.name, packages: pkgs, addons };
    })
    .filter((cat) => cat.packages.length > 0);
}

/** "Starting at $2,100", "$950", "Request a quote". */
export function priceLabel(p: { pricing_type: PricingType; price: number | null }) {
  if (p.pricing_type === "quote" || p.price == null) return "Request a quote";
  const s = `$${p.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return p.pricing_type === "starting_at" ? `Starting at ${s}` : s;
}

/** The package as a client saw it when they asked about it: frozen on the inquiry so later edits don't change it. */
export function packageSnapshot(p: PublicPackage, categoryName: string | null) {
  return { id: p.id, name: p.name, category: categoryName, pricing_type: p.pricing_type, price: p.price, hours: p.hours, features: p.features, included_addons: p.included_addons, captured_at: new Date().toISOString() };
}

// ------------------------------------------------------------ validation

type Ok<T> = { ok: true; value: T } | { ok: false; error: string };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

/** Package fields an admin can edit. Only keys present in the body are returned. */
export function parsePackageInput(b: Record<string, unknown>, { creating, canManagePayout }: { creating: boolean; canManagePayout: boolean }): Ok<{ row: Record<string, unknown>; categoryIds?: string[]; includedAddonIds?: string[] }> {
  const row: Record<string, unknown> = {};
  if ("name" in b || creating) {
    const n = str(b.name, 120);
    if (!n) return { ok: false, error: "Give the package a name." };
    row.name = n;
  }
  if ("description" in b || creating) row.description = str(b.description, 2000) ?? "";
  if ("pricingType" in b) {
    if (!PRICING_TYPES.includes(b.pricingType as PricingType)) return { ok: false, error: "Pick a pricing type." };
    row.pricing_type = b.pricingType;
  }
  if ("price" in b || creating) {
    const quote = (row.pricing_type ?? b.pricingType) === "quote";
    const n = b.price === "" || b.price == null ? (quote ? 0 : NaN) : Number(b.price);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return { ok: false, error: "Enter a price." };
    row.price = Math.round(n * 100) / 100;
  }
  if ("hours" in b) {
    if (b.hours === "" || b.hours == null) row.hours = null;
    else {
      const h = Number(b.hours);
      if (!Number.isFinite(h) || h < 0 || h > 48) return { ok: false, error: "Coverage hours should be between 0 and 48." };
      row.hours = Math.round(h * 2) / 2;
    }
  }
  if ("features" in b) {
    if (!Array.isArray(b.features)) return { ok: false, error: "Features must be a list." };
    row.features = (b.features as unknown[]).map((f) => (typeof f === "string" ? f.trim().slice(0, 200) : "")).filter(Boolean).slice(0, 40);
  }
  if ("quoteBeforePayment" in b) row.quote_before_payment = !!b.quoteBeforePayment;
  if ("isActive" in b) row.is_active = !!b.isActive;
  const payoutKeys = ["payoutType", "payoutPercent", "payoutFlatCents", "eligibleServiceCents", "thirdPartyFeeCents"];
  if (payoutKeys.some((k) => k in b)) {
    if (!canManagePayout) return { ok: false, error: "Only owners and admins can change payout rules." };
    if ("payoutType" in b) {
      if (b.payoutType !== "percent" && b.payoutType !== "flat") return { ok: false, error: "Pick percentage or flat amount." };
      row.payout_type = b.payoutType;
    }
    if ("payoutPercent" in b) {
      const n = Number(b.payoutPercent);
      if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, error: "The payout percentage should be 0–100." };
      row.payout_percent = Math.round(n * 100) / 100;
    }
    for (const [k, col] of [["payoutFlatCents", "payout_flat_cents"], ["eligibleServiceCents", "eligible_service_cents"], ["thirdPartyFeeCents", "third_party_fee_cents"]] as const) {
      if (!(k in b)) continue;
      if (b[k] === null || b[k] === "") {
        row[col] = null;
        continue;
      }
      const n = Number(b[k]);
      if (!Number.isInteger(n) || n < 0 || n > 100_000_000) return { ok: false, error: "Check the payout amounts." };
      row[col] = n;
    }
  }
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)))] : undefined);
  return { ok: true, value: { row, categoryIds: "categoryIds" in b ? ids(b.categoryIds) ?? [] : undefined, includedAddonIds: "includedAddonIds" in b ? ids(b.includedAddonIds) ?? [] : undefined } };
}

/** Replace a package's categories, keeping its order where it stays and putting it last where it's new. */
export async function setPackageCategories(db: Db, packageId: string, categoryIds: string[]) {
  const { data: cur, error } = await db.from("package_category_links").select("category_id, position").eq("package_id", packageId);
  if (error) throw error;
  const keep = new Map(((cur ?? []) as { category_id: string; position: number }[]).map((r) => [r.category_id, r.position]));
  const drop = [...keep.keys()].filter((c) => !categoryIds.includes(c));
  if (drop.length) {
    const r = await db.from("package_category_links").delete().eq("package_id", packageId).in("category_id", drop);
    if (r.error) throw r.error;
  }
  const add = categoryIds.filter((c) => !keep.has(c));
  for (const c of add) {
    const { data: last } = await db.from("package_category_links").select("position").eq("category_id", c).order("position", { ascending: false }).limit(1).maybeSingle();
    const r = await db.from("package_category_links").insert({ package_id: packageId, category_id: c, position: ((last as { position: number } | null)?.position ?? -1) + 1 });
    if (r.error) throw r.error;
  }
}

export async function setLinks(db: Db, table: "package_included_addons" | "addon_category_links", key: "package_id" | "addon_id", id: string, otherKey: "addon_id" | "category_id" | "package_id", otherIds: string[]) {
  const del = await db.from(table).delete().eq(key, id);
  if (del.error) throw del.error;
  if (otherIds.length) {
    const ins = await db.from(table).insert(otherIds.map((o) => ({ [key]: id, [otherKey]: o })));
    if (ins.error) throw ins.error;
  }
}
