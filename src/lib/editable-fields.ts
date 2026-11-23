/**
 * Pick only the fields an edit is allowed to change, cleaned up. Edit
 * routes use this instead of writing whatever JSON they're sent, so an edit
 * can't touch ids, timestamps, links to logins or soft-delete markers.
 */
export type FieldRule = "text" | "longtext" | "email" | "int" | "money" | "date" | { oneOf: readonly string[] } | "textList";

export function pickEditable(body: unknown, rules: Record<string, FieldRule>): { ok: true; values: Record<string, unknown> } | { ok: false; error: string } {
  const src = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const values: Record<string, unknown> = {};
  for (const [key, rule] of Object.entries(rules)) {
    if (!(key in src)) continue;
    const v = src[key];
    if (v === null || v === "") {
      values[key] = null;
      continue;
    }
    if (rule === "text" || rule === "longtext") {
      if (typeof v !== "string") return { ok: false, error: `${key} must be text` };
      const t = v.trim();
      if (t.length > (rule === "text" ? 300 : 10000)) return { ok: false, error: `${key} is too long` };
      values[key] = t || null;
    } else if (rule === "email") {
      if (typeof v !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return { ok: false, error: "That email address doesn't look right" };
      values[key] = v.trim().toLowerCase();
    } else if (rule === "int") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 1_000_000) return { ok: false, error: `${key} must be a whole number` };
      values[key] = n;
    } else if (rule === "money") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return { ok: false, error: `${key} must be an amount` };
      values[key] = Math.round(n * 100) / 100;
    } else if (rule === "date") {
      if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return { ok: false, error: `${key} must be a date` };
      values[key] = v.slice(0, 10);
    } else if (rule === "textList") {
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return { ok: false, error: `${key} must be a list` };
      values[key] = (v as string[]).map((x) => x.trim()).filter(Boolean).slice(0, 50);
    } else {
      if (typeof v !== "string" || !rule.oneOf.includes(v)) return { ok: false, error: `${key} isn't a valid choice` };
      values[key] = v;
    }
  }
  return { ok: true, values };
}

export const CLIENT_FIELDS: Record<string, FieldRule> = {
  first_name: "text",
  last_name: "text",
  company_name: "text",
  email: "email",
  phone: "text",
  address_line1: "text",
  address_line2: "text",
  city: "text",
  state: "text",
  postal_code: "text",
  partner_first_name: "text",
  partner_last_name: "text",
  partner_phone: "text",
  married_last_name: "text",
  referral_source: "text",
  notes: "longtext",
  tags: "textList",
  status: { oneOf: ["active", "inactive", "blocked"] },
  type: { oneOf: ["individual", "corporate", "venue", "agency"] }
};

export const EQUIPMENT_FIELDS: Record<string, FieldRule> = {
  name: "text",
  category: "text",
  brand: "text",
  model: "text",
  serial_number: "text",
  status: { oneOf: ["available", "in_use", "maintenance", "retired"] },
  condition: { oneOf: ["excellent", "good", "fair", "poor"] },
  quantity_owned: "int",
  storage_location: "text",
  purchase_date: "date",
  purchase_price: "money",
  notes: "longtext"
};
