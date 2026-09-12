import type {
  AppliedAdjustment,
  AppliedDeal,
  DealData,
  EventPricingContext,
  PackageLineItemData,
  PackagePricingRuleData,
  PackageTemplateData,
  PriceBreakdown,
  PriceLine,
  SelectionInput
} from "./types";

/**
 * The single, pure pricing engine for the Package Builder. No DB access,
 * no client-supplied totals accepted anywhere — this exact function runs
 * behind the admin preview, the client builder's live total, and the
 * final saved-quote snapshot, so all three can never disagree.
 *
 * Calculation order (fixed, and this is the documentation for it):
 *   1. Start from template.base_price_cents.
 *   2. Price each selected line item (method-specific, minus included qty).
 *   3. Overtime, if hoursBooked exceeds included_hours (respects minimum_hours).
 *   4. package_pricing_rules adjustments, guest-band rules first, then
 *      date/season/day-of-week rules — in that fixed order, each computed
 *      against the running subtotal-so-far.
 *   5. Travel: flat fee + per-mile beyond travel_radius_miles.
 *   6. Subtotal = sum of 1-5.
 *   7. Deals: of the eligible non-stackable deals, only the single
 *      largest-discount one applies; stackable deals then apply on top,
 *      oldest-created first; each deal capped at its own
 *      max_discount_cents; total discount capped so total never drops
 *      below min_price_cents.
 *   8. Fees (flat, from additional_fees) then tax_percent, both against
 *      the post-discount subtotal — only if the template actually sets
 *      them; nothing invented.
 *   9. Total, floored at min_price_cents if set.
 *  10. Deposit computed from deposit_type/deposit_value as a portion of
 *      the total — never added on top of it.
 */
export function computePackagePrice(input: {
  template: PackageTemplateData;
  lineItems: PackageLineItemData[];
  pricingRules: PackagePricingRuleData[];
  selections: SelectionInput[];
  eventContext: EventPricingContext;
  deals: DealData[];
}): PriceBreakdown {
  const { template, lineItems, pricingRules, selections, eventContext, deals } = input;
  const selectionByLineItem = new Map(selections.map((s) => [s.lineItemId, s.quantity]));

  const lines: PriceLine[] = [];
  let requiresQuote = false;

  for (const item of lineItems) {
    if (item.selection_mode === "hidden") continue;
    const quantity =
      item.selection_mode === "included" || item.selection_mode === "locked"
        ? Math.max(item.included_quantity, selectionByLineItem.get(item.id) ?? item.included_quantity)
        : (selectionByLineItem.get(item.id) ?? 0);
    if (quantity <= 0 && item.selection_mode !== "included") continue;

    const method = item.pricing_method_override ?? item.catalog_item?.pricing_method ?? "fixed";
    const unitPriceCents = item.price_cents_override ?? item.catalog_item?.price_cents ?? 0;
    const label = item.name_override ?? item.catalog_item?.name ?? "Item";
    const chargedQuantity = Math.max(0, quantity - item.included_quantity);

    if (method === "quote_only") {
      requiresQuote = true;
      lines.push({
        lineItemId: item.id,
        label,
        quantity,
        chargedQuantity,
        unitPriceCents,
        amountCents: 0,
        requiresQuote: true,
        note: "Priced on request"
      });
      continue;
    }

    let amountCents = 0;
    let note: string | null = null;
    switch (method) {
      case "fixed":
      case "per_event":
        amountCents = chargedQuantity > 0 || (item.selection_mode === "included" && quantity > 0) ? unitPriceCents : 0;
        if (chargedQuantity === 0 && item.included_quantity > 0) note = "Included";
        break;
      case "hourly":
        amountCents = unitPriceCents * chargedQuantity;
        if (chargedQuantity === 0 && item.included_quantity > 0) note = `${item.included_quantity} hour${item.included_quantity === 1 ? "" : "s"} included`;
        break;
      case "per_person":
        amountCents = unitPriceCents * chargedQuantity;
        if (chargedQuantity === 0 && item.included_quantity > 0) note = `${item.included_quantity} included`;
        break;
      case "per_unit":
        amountCents = unitPriceCents * chargedQuantity;
        break;
    }

    lines.push({ lineItemId: item.id, label, quantity, chargedQuantity, unitPriceCents, amountCents, requiresQuote: false, note });
  }

  const lineItemsCents = lines.reduce((sum, l) => sum + l.amountCents, 0);

  // Overtime — only applies when the template tracks included/overtime hours at all.
  let overtimeCents = 0;
  let overtimeNote: string | null = null;
  const includedHours = template.included_hours ?? 0;
  const hoursBooked = Math.max(eventContext.hoursBooked ?? includedHours, template.minimum_hours ?? 0);
  if (template.overtime_price_cents && template.overtime_increment_minutes && hoursBooked > includedHours) {
    const extraMinutes = (hoursBooked - includedHours) * 60;
    const increments = Math.ceil(extraMinutes / template.overtime_increment_minutes);
    overtimeCents = increments * template.overtime_price_cents;
    overtimeNote = `${hoursBooked - includedHours} hour${hoursBooked - includedHours === 1 ? "" : "s"} beyond the ${includedHours} included`;
  }

  const runningBeforeAdjustments = template.base_price_cents + lineItemsCents + overtimeCents;

  // Pricing rule adjustments — guest-band rules first, then date/season/day-of-week, fixed order.
  const adjustments: AppliedAdjustment[] = [];
  let running = runningBeforeAdjustments;
  const orderedRules = [...pricingRules].sort((a, b) => {
    const rank = (t: string) => (t === "guest_band" ? 0 : 1);
    return rank(a.rule_type) - rank(b.rule_type) || a.position - b.position;
  });
  for (const rule of orderedRules) {
    if (!ruleMatches(rule, eventContext)) continue;
    const amount = rule.adjustment_type === "percent" ? Math.round((running * rule.adjustment_value) / 100) : Math.round(rule.adjustment_value);
    if (amount === 0) continue;
    adjustments.push({ label: rule.label, amountCents: amount });
    running += amount;
  }

  // Travel
  let travelCents = 0;
  if (template.travel_radius_miles != null && eventContext.travelMiles != null && eventContext.travelMiles > template.travel_radius_miles) {
    const extraMiles = eventContext.travelMiles - template.travel_radius_miles;
    travelCents = (template.travel_flat_fee_cents ?? 0) + Math.round((template.travel_per_mile_cents ?? 0) * extraMiles);
  } else if (template.travel_radius_miles == null && (template.travel_flat_fee_cents || template.travel_per_mile_cents) && eventContext.travelMiles) {
    travelCents = (template.travel_flat_fee_cents ?? 0) + Math.round((template.travel_per_mile_cents ?? 0) * eventContext.travelMiles);
  }

  const subtotalCents = running + travelCents;

  // Deals
  const { appliedDeals, discountCents } = applyDeals(deals, subtotalCents, eventContext);

  const minPrice = template.min_price_cents ?? 0;
  const postDiscount = Math.max(subtotalCents - discountCents, minPrice, 0);

  // Fees + tax, against the post-discount subtotal — only if the template sets them.
  const feeCents = (template.additional_fees ?? []).reduce((sum, f) => sum + f.amount_cents, 0);
  const taxCents = template.tax_percent ? Math.round(((postDiscount + feeCents) * template.tax_percent) / 100) : 0;

  const rawTotal = postDiscount + feeCents + taxCents;
  const totalCents = Math.max(rawTotal, minPrice);
  const flooredAtMinimum = minPrice > 0 && rawTotal < minPrice;

  // Deposit — a portion of the total, never additive.
  let depositCents = 0;
  if (template.deposit_type === "percent" && template.deposit_value) {
    depositCents = Math.round((totalCents * template.deposit_value) / 100);
  } else if (template.deposit_type === "flat" && template.deposit_value) {
    depositCents = Math.min(Math.round(template.deposit_value), totalCents);
  }

  return {
    baseCents: template.base_price_cents,
    lines,
    overtimeCents,
    overtimeNote,
    adjustments,
    travelCents,
    subtotalCents,
    deals: appliedDeals,
    discountCents,
    feeCents,
    fees: template.additional_fees ?? [],
    taxCents,
    totalCents,
    depositCents,
    requiresQuote,
    flooredAtMinimum
  };
}

function ruleMatches(rule: PackagePricingRuleData, ctx: EventPricingContext): boolean {
  const m = rule.match as Record<string, unknown>;
  switch (rule.rule_type) {
    case "guest_band": {
      if (ctx.guestCount == null) return false;
      const min = typeof m.min === "number" ? m.min : -Infinity;
      const max = typeof m.max === "number" ? m.max : Infinity;
      return ctx.guestCount >= min && ctx.guestCount <= max;
    }
    case "day_of_week": {
      if (!ctx.eventDate) return false;
      const days = Array.isArray(m.days) ? (m.days as string[]) : [];
      const dayName = new Date(ctx.eventDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
      return days.includes(dayName);
    }
    case "date_range":
    case "season": {
      if (!ctx.eventDate) return false;
      const start = typeof m.start === "string" ? m.start : null;
      const end = typeof m.end === "string" ? m.end : null;
      if (!start || !end) return false;
      return ctx.eventDate >= start && ctx.eventDate <= end;
    }
    default:
      return false;
  }
}

function applyDeals(deals: DealData[], subtotalCents: number, ctx: EventPricingContext): { appliedDeals: AppliedDeal[]; discountCents: number } {
  const now = new Date();
  const eventDate = ctx.eventDate;

  const evaluated = deals.map((d) => {
    const eligible = isDealCurrentlyEligible(d, subtotalCents, eventDate, now);
    const rawAmount = eligible ? dealDiscountAmount(d, subtotalCents) : 0;
    const cappedAmount = d.max_discount_cents != null ? Math.min(rawAmount, d.max_discount_cents) : rawAmount;
    return { deal: d, eligible, amount: eligible ? cappedAmount : 0 };
  });

  const nonStackableEligible = evaluated.filter((e) => e.eligible && !e.deal.is_stackable).sort((a, b) => b.amount - a.amount);
  const bestNonStackableId = nonStackableEligible[0]?.deal.id ?? null;

  const appliedDeals: AppliedDeal[] = [];
  let discountCents = 0;

  for (const e of evaluated) {
    if (!e.eligible) {
      appliedDeals.push({ dealId: e.deal.id, name: e.deal.name, amountCents: 0, applied: false, reason: ineligibleReason(e.deal, subtotalCents, eventDate, now) });
      continue;
    }
    if (!e.deal.is_stackable) {
      if (e.deal.id === bestNonStackableId) {
        appliedDeals.push({ dealId: e.deal.id, name: e.deal.name, amountCents: e.amount, applied: true, reason: "Applied" });
        discountCents += e.amount;
      } else {
        appliedDeals.push({ dealId: e.deal.id, name: e.deal.name, amountCents: 0, applied: false, reason: "Not combinable with a larger offer already applied" });
      }
      continue;
    }
    appliedDeals.push({ dealId: e.deal.id, name: e.deal.name, amountCents: e.amount, applied: true, reason: "Applied" });
    discountCents += e.amount;
  }

  return { appliedDeals, discountCents: Math.min(discountCents, subtotalCents) };
}

function isDealCurrentlyEligible(deal: DealData, subtotalCents: number, eventDate: string | null, now: Date): boolean {
  if (deal.status !== "active") return false;
  if (deal.starts_at && now < new Date(deal.starts_at)) return false;
  if (deal.ends_at && now > new Date(deal.ends_at)) return false;
  if (deal.usage_limit != null && deal.usage_count >= deal.usage_limit) return false;
  if (deal.min_spend_cents != null && subtotalCents < deal.min_spend_cents) return false;
  if (eventDate) {
    if (deal.eligible_event_start && eventDate < deal.eligible_event_start) return false;
    if (deal.eligible_event_end && eventDate > deal.eligible_event_end) return false;
    if (deal.blackout_dates.includes(eventDate)) return false;
  }
  return true;
}

function ineligibleReason(deal: DealData, subtotalCents: number, eventDate: string | null, now: Date): string {
  if (deal.status !== "active") return "Not currently active";
  if (deal.starts_at && now < new Date(deal.starts_at)) return "Not started yet";
  if (deal.ends_at && now > new Date(deal.ends_at)) return "Expired";
  if (deal.usage_limit != null && deal.usage_count >= deal.usage_limit) return "Usage limit reached";
  if (deal.min_spend_cents != null && subtotalCents < deal.min_spend_cents) return "Below minimum spend";
  if (eventDate && deal.blackout_dates.includes(eventDate)) return "Event date is blacked out for this offer";
  if (eventDate && deal.eligible_event_start && eventDate < deal.eligible_event_start) return "Event date is before this offer's eligible window";
  if (eventDate && deal.eligible_event_end && eventDate > deal.eligible_event_end) return "Event date is after this offer's eligible window";
  return "Not eligible";
}

function dealDiscountAmount(deal: DealData, subtotalCents: number): number {
  if (deal.value == null) return 0;
  switch (deal.deal_type) {
    case "percent":
    case "early_booking":
    case "last_minute":
    case "loyalty":
    case "referral":
    case "multi_event":
      return Math.round((subtotalCents * deal.value) / 100);
    case "fixed":
    case "bundle":
    case "complimentary_upgrade":
      return Math.round(deal.value);
    default:
      return 0;
  }
}
