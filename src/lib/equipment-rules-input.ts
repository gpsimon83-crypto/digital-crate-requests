import type { GigCondition } from "@/lib/packages/gig-calculator";

const SPACES = ["reception", "ceremony", "cocktail", "microphones"];
const OPS = ["eq", "ne", "gte", "lte", "gt", "lt", "in", "includes", "excludes"];
const EVENT_FIELDS = ["guest_count", "event_type", "hours_booked"];
const ANSWER_FIELDS = ["setting", "ceremony_space", "cocktail_space", "microphones"];

/** Validates a setup rule from the admin form. `partial` for edits. */
export function cleanSetupRule(b: Record<string, unknown>, partial = false): Record<string, unknown> | { error: string } {
  const out: Record<string, unknown> = {};
  if (b.space !== undefined || !partial) {
    if (!SPACES.includes(String(b.space))) return { error: "Pick a space." };
    out.space = b.space;
  }
  if (b.label !== undefined || !partial) {
    const label = String(b.label ?? "").trim();
    if (!label || label.length > 120) return { error: "Give the rule a short name." };
    out.label = label;
  }
  if (b.conditions !== undefined) {
    if (!Array.isArray(b.conditions) || b.conditions.length > 10) return { error: "Conditions aren't valid." };
    const conds: GigCondition[] = [];
    for (const c of b.conditions as Record<string, unknown>[]) {
      const source = c?.source === "answer" ? "answer" : "event";
      const field = String(c?.field ?? "");
      if (!(source === "event" ? EVENT_FIELDS : ANSWER_FIELDS).includes(field) || !OPS.includes(String(c?.op))) return { error: "Conditions aren't valid." };
      const value = typeof c.value === "number" ? c.value : String(c.value ?? "").slice(0, 100);
      conds.push({ source, field, op: c.op as GigCondition["op"], value });
    }
    out.conditions = conds;
  }
  if (b.equipment_id !== undefined) out.equipment_id = typeof b.equipment_id === "string" && /^[0-9a-f-]{36}$/i.test(b.equipment_id) ? b.equipment_id : null;
  if (b.equipment_category !== undefined) out.equipment_category = typeof b.equipment_category === "string" && b.equipment_category.trim() ? b.equipment_category.trim().toLowerCase().slice(0, 40) : null;
  if (!partial && !out.equipment_id && !out.equipment_category) return { error: "Pick an item or a category." };
  if (b.quantity !== undefined || !partial) {
    const q = Number(b.quantity ?? 1);
    if (!Number.isInteger(q) || q < 1 || q > 50) return { error: "Quantity must be 1–50." };
    out.quantity = q;
  }
  if (b.reason !== undefined) out.reason = String(b.reason ?? "").trim().slice(0, 300) || null;
  if (b.position !== undefined) out.position = Math.max(0, Math.min(9999, Math.round(Number(b.position) || 0)));
  if (b.is_active !== undefined) out.is_active = b.is_active !== false;
  return out;
}
