import { createAdminClient } from "@/lib/supabase/admin";
import { diffTrackedFields, recordChangeOrderIfSigned } from "@/lib/data/contract-change-orders";
import { computePackagePrice } from "@/lib/packages/pricing-engine";
import { calculateGigEquipment, type GigContext, type GigEquipmentRuleData, type GigEquipmentRecommendation } from "@/lib/packages/gig-calculator";
import type {
  CatalogItemData,
  DealData,
  EventPricingContext,
  PackageLineItemData,
  PackagePricingRuleData,
  PackageRuleData,
  PackageSectionData,
  PackageTemplateData,
  PriceBreakdown,
  SelectionInput
} from "@/lib/packages/types";

// ── Service catalog ──────────────────────────────────────────────────

export async function listCatalogItems(includeInactive = false): Promise<CatalogItemData[]> {
  const db = createAdminClient();
  let query = db.from("service_catalog_items").select("*").order("category").order("position");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data as CatalogItemData[];
}

export async function createCatalogItem(input: Partial<CatalogItemData>) {
  const db = createAdminClient();
  const { data, error } = await db.from("service_catalog_items").insert(input).select().single();
  if (error) throw error;
  return data as CatalogItemData;
}

export async function updateCatalogItem(id: string, updates: Partial<CatalogItemData>) {
  const db = createAdminClient();
  const { data, error } = await db.from("service_catalog_items").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw error;
  return data as CatalogItemData;
}

export async function deleteCatalogItem(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("service_catalog_items").delete().eq("id", id);
  if (error) throw error;
}

// ── Per-DJ service offerings ─────────────────────────────────────────
// service_catalog_items stays the shared definition of what a service IS;
// each DJ's own price/availability lives in dj_service_offerings.

export interface DjServiceOfferingRow {
  id: string;
  dj_id: string;
  catalog_item_id: string;
  price_cents: number;
  internal_cost_cents: number | null;
  min_quantity: number | null;
  max_quantity: number | null;
  is_offered: boolean;
}

export async function listDjServiceOfferings(djId: string): Promise<DjServiceOfferingRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("dj_service_offerings").select("*").eq("dj_id", djId);
  if (error) throw error;
  return data as DjServiceOfferingRow[];
}

export async function upsertDjServiceOffering(
  djId: string,
  catalogItemId: string,
  input: { priceCents: number; internalCostCents?: number | null; minQuantity?: number | null; maxQuantity?: number | null; isOffered: boolean }
): Promise<DjServiceOfferingRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("dj_service_offerings")
    .upsert(
      {
        dj_id: djId,
        catalog_item_id: catalogItemId,
        price_cents: input.priceCents,
        internal_cost_cents: input.internalCostCents ?? null,
        min_quantity: input.minQuantity ?? null,
        max_quantity: input.maxQuantity ?? null,
        is_offered: input.isOffered,
        updated_at: new Date().toISOString()
      },
      { onConflict: "dj_id,catalog_item_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as DjServiceOfferingRow;
}

/**
 * Overlays each catalog-linked line item with that DJ's own price/cost/
 * quantity bounds, and forces selection_mode to "hidden" when the DJ
 * doesn't offer it (no row, or is_offered: false) — the pricing engine
 * already skips hidden items entirely, so this is enough to both exclude
 * it from pricing and keep it out of client-selectable options. Custom
 * line items with no catalog_item_id (template-authored, not a shared
 * service) are never touched.
 */
function applyDjOfferings(sections: PackageSectionData[], offeringsByCatalogId: Map<string, DjServiceOfferingRow>): PackageSectionData[] {
  return sections.map((s) => ({
    ...s,
    line_items: s.line_items.map((li) => {
      if (!li.catalog_item_id || !li.catalog_item) return li;
      const offering = offeringsByCatalogId.get(li.catalog_item_id);
      if (!offering || !offering.is_offered) {
        return { ...li, selection_mode: "hidden" as const };
      }
      return {
        ...li,
        catalog_item: {
          ...li.catalog_item,
          price_cents: offering.price_cents,
          internal_cost_cents: offering.internal_cost_cents,
          min_quantity: offering.min_quantity,
          max_quantity: offering.max_quantity
        }
      };
    })
  }));
}

// ── Package templates ────────────────────────────────────────────────

export interface TemplateSummary extends PackageTemplateData {
  section_count: number;
  line_item_count: number;
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  const db = createAdminClient();
  const { data: templates, error } = await db.from("package_templates").select("*").order("position");
  if (error) throw error;

  const { data: sections, error: sectionsError } = await db.from("package_sections").select("id, package_template_id");
  if (sectionsError) throw sectionsError;

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: lineItems, error: lineItemsError } =
    sectionIds.length > 0 ? await db.from("package_line_items").select("id, section_id").in("section_id", sectionIds) : { data: [], error: null };
  if (lineItemsError) throw lineItemsError;

  return (templates ?? []).map((t) => {
    const templateSectionIds = new Set((sections ?? []).filter((s) => s.package_template_id === t.id).map((s) => s.id));
    const lineItemCount = (lineItems ?? []).filter((li) => templateSectionIds.has(li.section_id)).length;
    return { ...(t as PackageTemplateData), section_count: templateSectionIds.size, line_item_count: lineItemCount };
  });
}

async function loadSectionsWithLineItems(templateId: string): Promise<PackageSectionData[]> {
  const db = createAdminClient();
  const { data: sections, error: sectionsError } = await db
    .from("package_sections")
    .select("*")
    .eq("package_template_id", templateId)
    .order("position");
  if (sectionsError) throw sectionsError;

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: lineItems, error: lineItemsError } =
    sectionIds.length > 0
      ? await db.from("package_line_items").select("*, catalog_item:service_catalog_items(*)").in("section_id", sectionIds).order("position")
      : { data: [], error: null };
  if (lineItemsError) throw lineItemsError;

  return (sections ?? []).map((s) => ({
    ...s,
    line_items: (lineItems ?? []).filter((li) => li.section_id === s.id) as PackageLineItemData[]
  })) as PackageSectionData[];
}

export interface TemplateDetail {
  template: PackageTemplateData;
  sections: PackageSectionData[];
  pricingRules: PackagePricingRuleData[];
  rules: PackageRuleData[];
  eligibleDealIds: string[];
}

export async function getTemplateDetail(templateId: string, djId?: string | null): Promise<TemplateDetail | null> {
  const db = createAdminClient();
  const { data: template, error } = await db.from("package_templates").select("*").eq("id", templateId).maybeSingle();
  if (error) throw error;
  if (!template) return null;

  let sections = await loadSectionsWithLineItems(templateId);
  if (djId) {
    const offerings = await listDjServiceOfferings(djId);
    const offeringsByCatalogId = new Map(offerings.map((o) => [o.catalog_item_id, o]));
    sections = applyDjOfferings(sections, offeringsByCatalogId);
  }

  const { data: pricingRules, error: pricingRulesError } = await db
    .from("package_pricing_rules")
    .select("*")
    .eq("package_template_id", templateId)
    .order("position");
  if (pricingRulesError) throw pricingRulesError;

  const { data: rules, error: rulesError } = await db.from("package_rules").select("*").eq("package_template_id", templateId);
  if (rulesError) throw rulesError;

  const { data: eligibility, error: eligibilityError } = await db.from("deal_eligibility").select("deal_id").eq("package_template_id", templateId);
  if (eligibilityError) throw eligibilityError;

  return {
    template: template as PackageTemplateData,
    sections,
    pricingRules: (pricingRules ?? []) as PackagePricingRuleData[],
    rules: (rules ?? []) as PackageRuleData[],
    eligibleDealIds: (eligibility ?? []).map((e) => e.deal_id)
  };
}

export async function createTemplate(input: Partial<PackageTemplateData>) {
  const db = createAdminClient();
  const { data, error } = await db.from("package_templates").insert(input).select().single();
  if (error) throw error;
  return data as PackageTemplateData;
}

export async function updateTemplate(id: string, updates: Partial<PackageTemplateData>) {
  const db = createAdminClient();
  const patch = { ...updates, updated_at: new Date().toISOString() } as Record<string, unknown>;
  const { data, error } = await db.from("package_templates").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as PackageTemplateData;
}

export async function bumpTemplateVersion(id: string) {
  const db = createAdminClient();
  const { data: current, error: readError } = await db.from("package_templates").select("version").eq("id", id).single();
  if (readError) throw readError;
  const { data, error } = await db
    .from("package_templates")
    .update({ version: (current.version ?? 1) + 1, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as PackageTemplateData;
}

export async function deleteTemplate(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("package_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateTemplate(id: string, overrides?: { name?: string }): Promise<PackageTemplateData> {
  const detail = await getTemplateDetail(id);
  if (!detail) throw new Error("Template not found");
  const db = createAdminClient();

  const { id: _id, created_at, updated_at, ...rest } = detail.template as unknown as Record<string, unknown>;
  void _id;
  void created_at;
  void updated_at;
  const { data: newTemplate, error } = await db
    .from("package_templates")
    .insert({ ...rest, name: overrides?.name ?? `${detail.template.name} (Copy)`, status: "draft", is_starter: false, duplicated_from: id, version: 1 })
    .select()
    .single();
  if (error) throw error;

  for (const section of detail.sections) {
    const { data: newSection, error: sectionError } = await db
      .from("package_sections")
      .insert({ package_template_id: newTemplate.id, title: section.title, description: section.description, position: section.position, is_hidden: section.is_hidden })
      .select()
      .single();
    if (sectionError) throw sectionError;

    if (section.line_items.length > 0) {
      const { error: lineItemsError } = await db.from("package_line_items").insert(
        section.line_items.map((li) => ({
          section_id: newSection.id,
          catalog_item_id: li.catalog_item_id,
          name_override: li.name_override,
          description_override: li.description_override,
          pricing_method_override: li.pricing_method_override,
          price_cents_override: li.price_cents_override,
          included_quantity: li.included_quantity,
          min_quantity: li.min_quantity,
          max_quantity: li.max_quantity,
          selection_mode: li.selection_mode,
          is_client_visible: li.is_client_visible,
          position: li.position
        }))
      );
      if (lineItemsError) throw lineItemsError;
    }
  }

  return newTemplate as PackageTemplateData;
}

// ── Sections ──────────────────────────────────────────────────────────

export async function createSection(templateId: string, input: { title: string; position: number }) {
  const db = createAdminClient();
  const { data, error } = await db.from("package_sections").insert({ package_template_id: templateId, ...input }).select().single();
  if (error) throw error;
  return { ...data, line_items: [] } as PackageSectionData;
}

export async function updateSection(id: string, updates: Partial<PackageSectionData>) {
  const db = createAdminClient();
  const { line_items, ...rest } = updates as Record<string, unknown>;
  void line_items;
  const { data, error } = await db.from("package_sections").update(rest).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSection(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("package_sections").delete().eq("id", id);
  if (error) throw error;
}

// ── Line items ────────────────────────────────────────────────────────

export async function createLineItem(sectionId: string, input: Partial<PackageLineItemData>) {
  const db = createAdminClient();
  const { catalog_item, ...rest } = input as Record<string, unknown>;
  void catalog_item;
  const { data, error } = await db.from("package_line_items").insert({ section_id: sectionId, ...rest }).select("*, catalog_item:service_catalog_items(*)").single();
  if (error) throw error;
  return data as PackageLineItemData;
}

export async function updateLineItem(id: string, updates: Partial<PackageLineItemData>) {
  const db = createAdminClient();
  const { catalog_item, ...rest } = updates as Record<string, unknown>;
  void catalog_item;
  const { data, error } = await db.from("package_line_items").update(rest).eq("id", id).select("*, catalog_item:service_catalog_items(*)").single();
  if (error) throw error;
  return data as PackageLineItemData;
}

export async function deleteLineItem(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("package_line_items").delete().eq("id", id);
  if (error) throw error;
}

// ── Pricing rules & dependency rules ────────────────────────────────

export async function createPricingRule(templateId: string, input: Partial<PackagePricingRuleData>) {
  const db = createAdminClient();
  const { data, error } = await db.from("package_pricing_rules").insert({ package_template_id: templateId, ...input }).select().single();
  if (error) throw error;
  return data as PackagePricingRuleData;
}

export async function updatePricingRule(id: string, updates: Partial<PackagePricingRuleData>) {
  const db = createAdminClient();
  const { data, error } = await db.from("package_pricing_rules").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as PackagePricingRuleData;
}

export async function deletePricingRule(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("package_pricing_rules").delete().eq("id", id);
  if (error) throw error;
}

export async function createRule(templateId: string, input: Partial<PackageRuleData>) {
  const db = createAdminClient();
  const { data, error } = await db.from("package_rules").insert({ package_template_id: templateId, ...input }).select().single();
  if (error) throw error;
  return data as PackageRuleData;
}

export async function deleteRule(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("package_rules").delete().eq("id", id);
  if (error) throw error;
}

// ── Deals ─────────────────────────────────────────────────────────────

export async function listDeals(): Promise<DealData[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("deals").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as DealData[];
}

export async function createDeal(input: Partial<DealData>) {
  const db = createAdminClient();
  const { data, error } = await db.from("deals").insert(input).select().single();
  if (error) throw error;
  return data as DealData;
}

export async function updateDeal(id: string, updates: Partial<DealData>) {
  const db = createAdminClient();
  const { data, error } = await db.from("deals").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw error;
  return data as DealData;
}

export async function deleteDeal(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("deals").delete().eq("id", id);
  if (error) throw error;
}

export async function setDealEligibility(dealId: string, packageTemplateIds: string[]) {
  const db = createAdminClient();
  await db.from("deal_eligibility").delete().eq("deal_id", dealId);
  if (packageTemplateIds.length === 0) return;
  const { error } = await db.from("deal_eligibility").insert(packageTemplateIds.map((packageTemplateId) => ({ deal_id: dealId, package_template_id: packageTemplateId })));
  if (error) throw error;
}

export async function listDealEligibility(): Promise<{ deal_id: string; package_template_id: string | null; catalog_item_id: string | null }[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("deal_eligibility").select("deal_id, package_template_id, catalog_item_id");
  if (error) throw error;
  return data;
}

export async function getEligibleDealsForTemplate(templateId: string): Promise<DealData[]> {
  const db = createAdminClient();
  const { data: eligibility, error: eligibilityError } = await db.from("deal_eligibility").select("deal_id").eq("package_template_id", templateId);
  if (eligibilityError) throw eligibilityError;
  const dealIds = (eligibility ?? []).map((e) => e.deal_id);

  const { data: publicDeals, error: publicError } = await db.from("deals").select("*").eq("is_public", true);
  if (publicError) throw publicError;

  let scopedDeals: DealData[] = [];
  if (dealIds.length > 0) {
    const { data, error } = await db.from("deals").select("*").in("id", dealIds);
    if (error) throw error;
    scopedDeals = data as DealData[];
  }

  const byId = new Map<string, DealData>();
  for (const d of [...(publicDeals ?? []), ...scopedDeals]) byId.set(d.id, d as DealData);
  return Array.from(byId.values());
}

// ── Default selections (used to stage a template before anyone customizes it) ──

export function defaultSelectionsForTemplate(sections: PackageSectionData[]): SelectionInput[] {
  return sections.flatMap((s) =>
    s.line_items
      .filter((li) => li.selection_mode !== "hidden")
      .map((li) => ({
        lineItemId: li.id,
        quantity: li.selection_mode === "included" || li.selection_mode === "required" || li.selection_mode === "locked" ? Math.max(1, li.included_quantity) : 0
      }))
  );
}

// ── Pricing (server-authoritative) ──────────────────────────────────

export async function priceTemplate(
  templateId: string,
  selections: SelectionInput[],
  eventContext: EventPricingContext,
  appliedDealIds?: string[],
  djId?: string | null
): Promise<PriceBreakdown | null> {
  const detail = await getTemplateDetail(templateId, djId);
  if (!detail) return null;

  const lineItems = detail.sections.flatMap((s) => s.line_items);
  const allEligibleDeals = await getEligibleDealsForTemplate(templateId);
  const deals = appliedDealIds ? allEligibleDeals.filter((d) => appliedDealIds.includes(d.id)) : allEligibleDeals;

  return computePackagePrice({
    template: detail.template,
    lineItems,
    pricingRules: detail.pricingRules,
    selections,
    eventContext,
    deals
  });
}

// ── Event package selections ("quotes") ─────────────────────────────

export interface EventPackageSelectionRow {
  id: string;
  event_id: string;
  package_template_id: string | null;
  package_template_version: number | null;
  status: "draft" | "saved" | "requested" | "confirmed" | "superseded";
  selections: Record<string, number>;
  applied_deal_ids: string[];
  price_snapshot: PriceBreakdown;
  /** lineItemId -> minimum quantity set by the gig equipment calculator. Enforced as a floor; only owner/admin (via the rules themselves) can change it. */
  locked_minimums: Record<string, number>;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export async function getCurrentSelection(eventId: string): Promise<EventPackageSelectionRow | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("event_package_selections").select("*").eq("event_id", eventId).eq("is_current", true).maybeSingle();
  if (error) throw error;
  return data as EventPackageSelectionRow | null;
}

/**
 * Never lets a saved quantity drop below a locked minimum the equipment
 * calculator set — the server, not just the UI, is the enforcement point
 * so a client-crafted request can't slip under the floor.
 */
function clampToLockedMinimums(selections: Record<string, number>, lockedMinimums: Record<string, number>): Record<string, number> {
  const clamped = { ...selections };
  for (const [lineItemId, min] of Object.entries(lockedMinimums)) {
    clamped[lineItemId] = Math.max(clamped[lineItemId] ?? 0, min);
  }
  return clamped;
}

export async function saveSelection(
  eventId: string,
  input: {
    packageTemplateId: string | null;
    packageTemplateVersion: number | null;
    status: "draft" | "saved" | "requested";
    selections: Record<string, number>;
    appliedDealIds: string[];
    priceSnapshot: PriceBreakdown;
    /** Omit to keep whatever locked minimums are already on the current selection (a normal client save never touches these). */
    lockedMinimums?: Record<string, number>;
  }
): Promise<EventPackageSelectionRow> {
  const db = createAdminClient();
  const { data: existing } = await db
    .from("event_package_selections")
    .select("id, locked_minimums")
    .eq("event_id", eventId)
    .eq("is_current", true)
    .maybeSingle();

  const lockedMinimums = input.lockedMinimums ?? (existing?.locked_minimums as Record<string, number> | undefined) ?? {};
  const selections = clampToLockedMinimums(input.selections, lockedMinimums);

  if (existing) {
    const { data, error } = await db
      .from("event_package_selections")
      .update({
        package_template_id: input.packageTemplateId,
        package_template_version: input.packageTemplateVersion,
        status: input.status,
        selections,
        applied_deal_ids: input.appliedDealIds,
        price_snapshot: input.priceSnapshot,
        locked_minimums: lockedMinimums,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as EventPackageSelectionRow;
  }

  const { data, error } = await db
    .from("event_package_selections")
    .insert({
      event_id: eventId,
      package_template_id: input.packageTemplateId,
      package_template_version: input.packageTemplateVersion,
      status: input.status,
      selections,
      applied_deal_ids: input.appliedDealIds,
      price_snapshot: input.priceSnapshot,
      locked_minimums: lockedMinimums,
      is_current: true
    })
    .select()
    .single();
  if (error) throw error;
  return data as EventPackageSelectionRow;
}

// ── Gig equipment calculator ─────────────────────────────────────────

export async function listGigEquipmentRules(): Promise<GigEquipmentRuleData[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("gig_equipment_rules").select("*").order("position");
  if (error) throw error;
  return data as GigEquipmentRuleData[];
}

export async function createGigEquipmentRule(input: Partial<GigEquipmentRuleData>) {
  const db = createAdminClient();
  const { data, error } = await db.from("gig_equipment_rules").insert(input).select().single();
  if (error) throw error;
  return data as GigEquipmentRuleData;
}

export async function updateGigEquipmentRule(id: string, updates: Partial<GigEquipmentRuleData>) {
  const db = createAdminClient();
  const { data, error } = await db.from("gig_equipment_rules").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw error;
  return data as GigEquipmentRuleData;
}

export async function deleteGigEquipmentRule(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("gig_equipment_rules").delete().eq("id", id);
  if (error) throw error;
}

export interface EquipmentRecommendationResult {
  matched: { lineItemId: string; catalogItemId: string; label: string; quantity: number; reason: string | null }[];
  unmatched: GigEquipmentRecommendation[];
}

/**
 * Runs the calculator against a gig's real details and matches each
 * recommendation to a line item already in the chosen template (by
 * catalog item). Anything the template doesn't already carry is
 * reported as unmatched rather than silently inserted into a shared
 * template — an admin decides whether to add it to the Services tab.
 */
export async function recommendEquipmentForTemplate(templateId: string, ctx: GigContext): Promise<EquipmentRecommendationResult> {
  const [rules, detail] = await Promise.all([listGigEquipmentRules(), getTemplateDetail(templateId)]);
  if (!detail) return { matched: [], unmatched: [] };

  const recommendations = calculateGigEquipment(rules, ctx);
  const lineItems = detail.sections.flatMap((s) => s.line_items);

  const matched: EquipmentRecommendationResult["matched"] = [];
  const unmatched: GigEquipmentRecommendation[] = [];

  for (const rec of recommendations) {
    const lineItem = lineItems.find((li) => li.catalog_item_id === rec.catalogItemId);
    if (lineItem) {
      matched.push({ lineItemId: lineItem.id, catalogItemId: rec.catalogItemId, label: rec.label, quantity: rec.quantity, reason: rec.reason });
    } else {
      unmatched.push(rec);
    }
  }

  return { matched, unmatched };
}

/**
 * Staff-only, explicit action: copies a selection's frozen price_snapshot
 * into events.quoted_amount/deposit_amount (the columns the existing
 * Payment tab and pay-intent route already read), and marks the
 * selection confirmed. Never called automatically — repricing an
 * existing quote is always a deliberate step, per spec.
 */
export async function approveSelectionForPayment(selectionId: string): Promise<void> {
  const db = createAdminClient();
  const { data: selection, error } = await db.from("event_package_selections").select("*").eq("id", selectionId).single();
  if (error) throw error;

  const { data: before } = await db.from("events").select("quoted_amount, final_amount, package_selection_id").eq("id", selection.event_id).maybeSingle();

  const snapshot = selection.price_snapshot as PriceBreakdown;
  const { error: eventError } = await db
    .from("events")
    .update({
      quoted_amount: snapshot.totalCents / 100,
      deposit_amount: snapshot.depositCents / 100,
      package_selection_id: selectionId
    })
    .eq("id", selection.event_id);
  if (eventError) throw eventError;

  const { error: selectionError } = await db.from("event_package_selections").update({ status: "confirmed" }).eq("id", selectionId);
  if (selectionError) throw selectionError;

  if (before) {
    const changes = diffTrackedFields(before, { quoted_amount: snapshot.totalCents / 100, final_amount: before.final_amount, package_selection_id: selectionId });
    await recordChangeOrderIfSigned(selection.event_id, changes);
  }
}
