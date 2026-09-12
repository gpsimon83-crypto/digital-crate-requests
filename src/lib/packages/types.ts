export type PricingMethod = "fixed" | "hourly" | "per_person" | "per_unit" | "per_event" | "quote_only";
export type SelectionMode = "included" | "required" | "optional" | "locked" | "hidden";
export type DisplayMode = "fixed_total" | "starting_price" | "price_range" | "quote_only";
export type DealType =
  | "percent"
  | "fixed"
  | "bundle"
  | "complimentary_upgrade"
  | "early_booking"
  | "last_minute"
  | "loyalty"
  | "referral"
  | "multi_event";
export type PricingRuleType = "day_of_week" | "date_range" | "guest_band" | "season";
export type DependencyRuleType = "requires" | "excludes" | "show_if";

export interface AdditionalFee {
  label: string;
  amount_cents: number;
}

export interface CatalogItemData {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  category: string;
  pricing_method: PricingMethod;
  unit_label: string | null;
  price_cents: number;
  internal_cost_cents: number | null;
  min_quantity: number | null;
  max_quantity: number | null;
  is_client_visible: boolean;
  is_active: boolean;
}

export interface PackageLineItemData {
  id: string;
  section_id: string;
  catalog_item_id: string | null;
  catalog_item: CatalogItemData | null;
  name_override: string | null;
  description_override: string | null;
  pricing_method_override: PricingMethod | null;
  price_cents_override: number | null;
  included_quantity: number;
  min_quantity: number | null;
  max_quantity: number | null;
  selection_mode: SelectionMode;
  is_client_visible: boolean;
  position: number;
}

export interface PackageSectionData {
  id: string;
  package_template_id: string;
  title: string;
  description: string | null;
  position: number;
  is_hidden: boolean;
  line_items: PackageLineItemData[];
}

export interface PackagePricingRuleData {
  id: string;
  rule_type: PricingRuleType;
  label: string;
  match: Record<string, unknown>;
  adjustment_type: "percent" | "flat_cents";
  adjustment_value: number;
  position: number;
}

export interface PackageRuleData {
  id: string;
  rule_type: DependencyRuleType;
  subject_line_item_id: string | null;
  target_line_item_id: string | null;
  condition: Record<string, unknown> | null;
}

export interface PackageTemplateData {
  id: string;
  name: string;
  slug: string | null;
  event_type: string | null;
  tier: "essential" | "signature" | "premium" | null;
  description: string | null;
  status: "draft" | "published" | "archived";
  is_starter: boolean;
  duplicated_from: string | null;
  display_mode: DisplayMode;
  base_price_cents: number;
  included_hours: number | null;
  minimum_hours: number | null;
  overtime_increment_minutes: number | null;
  overtime_price_cents: number | null;
  travel_radius_miles: number | null;
  travel_flat_fee_cents: number | null;
  travel_per_mile_cents: number | null;
  min_guest_count: number | null;
  max_guest_count: number | null;
  min_price_cents: number | null;
  max_discount_percent: number | null;
  deposit_type: "percent" | "flat" | null;
  deposit_value: number | null;
  tax_percent: number | null;
  additional_fees: AdditionalFee[];
  intro_copy: string | null;
  confirmation_message: string | null;
  copy_tone: string | null;
  primary_color: string | null;
  icon: string | null;
  image_url: string | null;
  cta_customize_label: string;
  cta_request_label: string;
  cta_save_quote_label: string;
  version: number;
  position: number;
}

export interface DealData {
  id: string;
  name: string;
  description: string | null;
  deal_type: DealType;
  value: number | null;
  code: string | null;
  starts_at: string | null;
  ends_at: string | null;
  eligible_event_start: string | null;
  eligible_event_end: string | null;
  blackout_dates: string[];
  min_spend_cents: number | null;
  usage_limit: number | null;
  usage_count: number;
  max_discount_cents: number | null;
  is_public: boolean;
  is_stackable: boolean;
  status: "draft" | "active" | "expired" | "archived";
  created_at: string;
}

export interface SelectionInput {
  lineItemId: string;
  quantity: number;
}

export interface EventPricingContext {
  eventDate: string | null;
  guestCount: number | null;
  travelMiles: number | null;
  hoursBooked: number | null;
}

export interface PriceLine {
  lineItemId: string;
  label: string;
  quantity: number;
  chargedQuantity: number;
  unitPriceCents: number;
  amountCents: number;
  requiresQuote: boolean;
  note: string | null;
}

export interface AppliedAdjustment {
  label: string;
  amountCents: number;
}

export interface AppliedDeal {
  dealId: string;
  name: string;
  amountCents: number;
  applied: boolean;
  reason: string;
}

export interface PriceBreakdown {
  baseCents: number;
  lines: PriceLine[];
  overtimeCents: number;
  overtimeNote: string | null;
  adjustments: AppliedAdjustment[];
  travelCents: number;
  subtotalCents: number;
  deals: AppliedDeal[];
  discountCents: number;
  feeCents: number;
  fees: AdditionalFee[];
  taxCents: number;
  totalCents: number;
  depositCents: number;
  requiresQuote: boolean;
  flooredAtMinimum: boolean;
}
