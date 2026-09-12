export type ConditionSource = "event" | "answer";
export type ConditionOp = "eq" | "ne" | "gte" | "lte" | "gt" | "lt";

export interface GigCondition {
  source: ConditionSource;
  /** For source "event": "guest_count" | "event_type" | "hours_booked". For source "answer": the questionnaire question key. */
  field: string;
  op: ConditionOp;
  value: string | number;
}

export interface GigEquipmentRuleData {
  id: string;
  label: string;
  conditions: GigCondition[];
  catalog_item_id: string;
  quantity: number;
  reason: string | null;
  is_active: boolean;
}

export interface GigContext {
  guestCount: number | null;
  eventType: string | null;
  hoursBooked: number | null;
  answers: Record<string, unknown>;
}

export interface GigEquipmentRecommendation {
  ruleId: string;
  label: string;
  catalogItemId: string;
  quantity: number;
  reason: string | null;
}

function readAnswerValue(answers: Record<string, unknown>, key: string): string | null {
  const raw = answers[key] as { value?: unknown; unsure?: boolean } | undefined;
  if (!raw || raw.unsure) return null;
  if (Array.isArray(raw.value)) return raw.value.join(",");
  return raw.value != null ? String(raw.value) : null;
}

function conditionMatches(condition: GigCondition, ctx: GigContext): boolean {
  let actual: string | number | null;
  if (condition.source === "event") {
    if (condition.field === "guest_count") actual = ctx.guestCount;
    else if (condition.field === "event_type") actual = ctx.eventType;
    else if (condition.field === "hours_booked") actual = ctx.hoursBooked;
    else actual = null;
  } else {
    actual = readAnswerValue(ctx.answers, condition.field);
  }

  if (actual == null) return false;

  const isNumericOp = ["gte", "lte", "gt", "lt"].includes(condition.op);
  if (isNumericOp) {
    const a = Number(actual);
    const b = Number(condition.value);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    switch (condition.op) {
      case "gte":
        return a >= b;
      case "lte":
        return a <= b;
      case "gt":
        return a > b;
      case "lt":
        return a < b;
    }
  }

  const a = String(actual).toLowerCase();
  const b = String(condition.value).toLowerCase();
  return condition.op === "eq" ? a === b : a !== b;
}

/**
 * Pure rules evaluation — every active rule whose conditions ALL match
 * the gig context contributes its recommended quantity. When more than
 * one rule recommends the same catalog item, the largest quantity wins
 * (the strictest minimum), so combining rules can only raise a floor,
 * never silently lower one set elsewhere.
 */
export function calculateGigEquipment(rules: GigEquipmentRuleData[], ctx: GigContext): GigEquipmentRecommendation[] {
  const byItem = new Map<string, GigEquipmentRecommendation>();

  for (const rule of rules) {
    if (!rule.is_active) continue;
    if (rule.conditions.length === 0) continue;
    if (!rule.conditions.every((c) => conditionMatches(c, ctx))) continue;

    const existing = byItem.get(rule.catalog_item_id);
    if (!existing || rule.quantity > existing.quantity) {
      byItem.set(rule.catalog_item_id, {
        ruleId: rule.id,
        label: rule.label,
        catalogItemId: rule.catalog_item_id,
        quantity: rule.quantity,
        reason: rule.reason
      });
    }
  }

  return Array.from(byItem.values());
}
