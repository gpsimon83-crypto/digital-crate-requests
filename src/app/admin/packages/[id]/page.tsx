"use client";

import { use as usePromise, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { DraftField } from "@/components/ui/draft-field";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { PriceBreakdownPanel } from "@/components/packages/price-breakdown-panel";
import { InvoicePreviewModal } from "@/components/packages/invoice-preview-modal";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronDown, ChevronUp, Trash2, Plus, GripVertical, ExternalLink, Sparkles } from "lucide-react";
import type {
  CatalogItemData,
  DealData,
  PackageLineItemData,
  PackagePricingRuleData,
  PackageRuleData,
  PackageSectionData,
  PackageTemplateData,
  PriceBreakdown,
  PricingMethod,
  SelectionMode
} from "@/lib/packages/types";

type Tab = "overview" | "services" | "pricing" | "deals" | "rules" | "design";

const inputClass = "w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none";
const labelClass = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted";
const pillSelectClass = "shrink-0 rounded-full border border-border bg-panel px-3 py-1.5 text-xs font-medium text-foreground focus:border-gold focus:outline-none";

const PRICING_METHOD_LABELS: Record<PricingMethod, string> = {
  fixed: "Fixed",
  hourly: "Hourly",
  per_person: "Per person",
  per_unit: "Per unit",
  per_event: "Per event",
  quote_only: "Quote only"
};

function money(cents: number) {
  return ((cents ?? 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function toCents(dollars: string) {
  return Math.round(parseFloat(dollars || "0") * 100);
}

export default function PackageBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);

  const [template, setTemplate] = useState<PackageTemplateData | null>(null);
  const [sections, setSections] = useState<PackageSectionData[]>([]);
  const [pricingRules, setPricingRules] = useState<PackagePricingRuleData[]>([]);
  const [rules, setRules] = useState<PackageRuleData[]>([]);
  const [eligibleDealIds, setEligibleDealIds] = useState<string[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItemData[]>([]);
  const [allDeals, setAllDeals] = useState<DealData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [saved, setSaved] = useState(false);

  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [previewGuests, setPreviewGuests] = useState<string>("");
  const [previewHours, setPreviewHours] = useState<string>("");
  const [previewMiles, setPreviewMiles] = useState<string>("");
  const [previewDate, setPreviewDate] = useState<string>("");
  const [showInvoice, setShowInvoice] = useState(false);

  function load() {
    fetch(`/api/admin/package-templates/${id}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load package");
        setTemplate(data.template);
        setSections(data.sections);
        setPricingRules(data.pricingRules);
        setRules(data.rules);
        setEligibleDealIds(data.eligibleDealIds);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }

  useEffect(load, [id]);
  useEffect(() => {
    fetch("/api/admin/service-catalog?all=1").then((r) => r.json()).then((d) => setCatalogItems(d.items ?? []));
    fetch("/api/admin/deals").then((r) => r.json()).then((d) => setAllDeals(d.deals ?? []));
  }, []);

  const allLineItems = useMemo(() => sections.flatMap((s) => s.line_items), [sections]);

  async function refreshPreview() {
    const selections = allLineItems
      .filter((li) => li.selection_mode !== "hidden")
      .map((li) => ({ lineItemId: li.id, quantity: li.selection_mode === "included" || li.selection_mode === "locked" ? li.included_quantity : (li.min_quantity ?? li.included_quantity) }));
    const res = await fetch(`/api/admin/package-templates/${id}/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selections,
        eventContext: {
          eventDate: previewDate || null,
          guestCount: previewGuests ? parseInt(previewGuests, 10) : null,
          travelMiles: previewMiles ? parseFloat(previewMiles) : null,
          hoursBooked: previewHours ? parseFloat(previewHours) : null
        }
      })
    });
    const data = await res.json();
    if (res.ok) setBreakdown(data.breakdown);
  }

  useEffect(() => {
    if (!template) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches a fresh price breakdown, doesn't set local UI state directly
    void refreshPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, sections, pricingRules, previewGuests, previewHours, previewMiles, previewDate]);

  async function patchTemplate(updates: Partial<PackageTemplateData>) {
    setTemplate((t) => (t ? { ...t, ...updates } : t));
    const res = await fetch(`/api/admin/package-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  async function handlePublish() {
    await patchTemplate({ status: "published" });
    await fetch(`/api/admin/package-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bumpVersion: true })
    });
    load();
  }

  if (error && !template) {
    return (
      <>
        <PageHeader title="Package Builder" action={<BackLink />} />
        <p className="p-6 text-sm text-status-declined">{error}</p>
      </>
    );
  }
  if (!template) {
    return (
      <>
        <PageHeader title="Package Builder" action={<BackLink />} />
        <p className="p-6 text-sm text-muted">Loading...</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={template.name}
        subtitle={template.is_starter ? "Starter example — edit freely" : "Package template"}
        action={
          <div className="flex items-center gap-2">
            {saved && <span className="hidden text-xs text-status-approved sm:inline">Saved</span>}
            <Button
              variant={template.status === "published" ? "secondary" : "primary"}
              size="sm"
              onClick={template.status === "published" ? () => patchTemplate({ status: "draft" }) : handlePublish}
            >
              {template.status === "published" ? "Unpublish" : "Publish"}
            </Button>
            <BackLink />
          </div>
        }
      />

      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,640px)_400px] xl:items-start">
        <div className="flex flex-col gap-4">
          {error && <p className="text-sm text-status-declined">{error}</p>}

          <div className="flex flex-wrap gap-1.5" role="tablist">
            {(["overview", "services", "pricing", "deals", "rules", "design"] as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors",
                  tab === t ? "bg-[#161616] text-white" : "bg-panel text-muted hover:text-foreground"
                )}
              >
                {t === "design" ? "Design & Preview" : t}
              </button>
            ))}
          </div>

          {tab === "overview" && <OverviewTab template={template} onUpdate={patchTemplate} />}
          {tab === "services" && (
            <ServicesTab templateId={id} sections={sections} catalogItems={catalogItems} onReload={load} />
          )}
          {tab === "pricing" && <PricingTab templateId={id} template={template} pricingRules={pricingRules} onUpdate={patchTemplate} onReload={load} />}
          {tab === "deals" && <DealsTab templateId={id} allDeals={allDeals} eligibleDealIds={eligibleDealIds} onReload={load} />}
          {tab === "rules" && <RulesTab templateId={id} lineItems={allLineItems} rules={rules} onReload={load} />}
          {tab === "design" && <DesignTab templateId={id} template={template} onUpdate={patchTemplate} />}
        </div>

        <div className="xl:sticky xl:top-6">
          <GlassCard className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Live preview</p>
                <p className="text-xs text-muted">Same pricing engine the client sees — try different inputs below.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShowInvoice(true)} disabled={!breakdown}>
                Invoice Preview
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Event date" type="date" value={previewDate} onChange={setPreviewDate} />
              <Field label="Guests" type="number" value={previewGuests} onChange={setPreviewGuests} />
              <Field label="Hours" type="number" value={previewHours} onChange={setPreviewHours} />
              <Field label="Travel miles" type="number" value={previewMiles} onChange={setPreviewMiles} />
            </div>
            {breakdown ? <PriceBreakdownPanel breakdown={breakdown} isExample={template.is_starter} /> : <p className="text-xs text-muted">Loading preview…</p>}
          </GlassCard>
        </div>
      </div>

      {showInvoice && breakdown && (
        <InvoicePreviewModal breakdown={breakdown} templateName={template.name} isExample={template.is_starter} onClose={() => setShowInvoice(false)} />
      )}
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/packages"
      className="flex items-center gap-1.5 rounded-[10px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-black/25 hover:text-foreground"
    >
      <ArrowLeft size={14} /> Back
    </Link>
  );
}

// ── Overview ────────────────────────────────────────────────────────

function OverviewTab({ template, onUpdate }: { template: PackageTemplateData; onUpdate: (u: Partial<PackageTemplateData>) => void }) {
  return (
    <GlassCard className="flex flex-col gap-3">
      <Field label="Name" value={template.name} onChange={(v) => onUpdate({ name: v })} />
      <Field label="Slug" value={template.slug ?? ""} onChange={(v) => onUpdate({ slug: v || null })} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Event type" value={template.event_type ?? ""} onChange={(v) => onUpdate({ event_type: v || null })} />
        <label className="block">
          <span className={labelClass}>Tier</span>
          <select value={template.tier ?? ""} onChange={(e) => onUpdate({ tier: (e.target.value || null) as PackageTemplateData["tier"] })} className={inputClass}>
            <option value="">No tier</option>
            <option value="essential">Essential</option>
            <option value="signature">Signature</option>
            <option value="premium">Premium</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>Description</span>
        <textarea value={template.description ?? ""} onChange={(e) => onUpdate({ description: e.target.value })} className={cn(inputClass, "min-h-[70px]")} />
      </label>
      {template.duplicated_from && <p className="text-xs text-muted">Duplicated from another template.</p>}
    </GlassCard>
  );
}

// ── Services (sections + line items) ────────────────────────────────

function ServicesTab({
  templateId,
  sections,
  catalogItems,
  onReload
}: {
  templateId: string;
  sections: PackageSectionData[];
  catalogItems: CatalogItemData[];
  onReload: () => void;
}) {
  async function addSection() {
    const title = window.prompt("Section title (e.g. \"Core Performance\")");
    if (!title?.trim()) return;
    await fetch(`/api/admin/package-templates/${templateId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), position: sections.length })
    });
    onReload();
  }

  async function deleteSection(id: string) {
    await fetch(`/api/admin/package-templates/sections/${id}`, { method: "DELETE" });
    onReload();
  }

  async function renameSection(id: string, title: string) {
    await fetch(`/api/admin/package-templates/sections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    });
  }

  async function addLineItem(sectionId: string, catalogItemId: string | null) {
    await fetch(`/api/admin/package-templates/sections/${sectionId}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogItemId, nameOverride: catalogItemId ? null : "Custom item", position: 0 })
    });
    onReload();
  }

  async function updateLineItem(id: string, updates: Record<string, unknown>) {
    await fetch(`/api/admin/package-templates/line-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    onReload();
  }

  async function deleteLineItem(id: string) {
    await fetch(`/api/admin/package-templates/line-items/${id}`, { method: "DELETE" });
    onReload();
  }

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section, i) => (
        <GlassCard key={section.id} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-1 items-center gap-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gold-soft text-[11px] font-semibold text-gold-dim">{i + 1}</span>
              <input
                defaultValue={section.title}
                onBlur={(e) => renameSection(section.id, e.target.value)}
                className="flex-1 border-none bg-transparent text-sm font-semibold outline-none focus:underline"
              />
            </div>
            <button onClick={() => deleteSection(section.id)} className="p-1 text-muted hover:text-status-declined" aria-label="Delete section">
              <Trash2 size={15} />
            </button>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            {section.line_items.length === 0 && <p className="text-xs text-muted">No items yet.</p>}
            {section.line_items.map((li, idx) => (
              <LineItemRow key={li.id} position={idx + 1} lineItem={li} onUpdate={(u) => updateLineItem(li.id, u)} onDelete={() => deleteLineItem(li.id)} />
            ))}
            <AddLineItem catalogItems={catalogItems} onAdd={(catalogItemId) => addLineItem(section.id, catalogItemId)} />
          </div>
        </GlassCard>
      ))}

      <button
        onClick={addSection}
        className="flex items-center justify-center gap-2 rounded-[10px] border border-dashed border-gold/35 bg-gold/5 py-3.5 text-sm font-semibold text-gold transition-colors hover:bg-gold/10"
      >
        <Plus size={15} /> Add Section
      </button>
    </div>
  );
}

function AddLineItem({ catalogItems, onAdd }: { catalogItems: CatalogItemData[]; onAdd: (catalogItemId: string | null) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-2">
      <select value={value} onChange={(e) => setValue(e.target.value)} className={cn(inputClass, "flex-1")}>
        <option value="">Choose from catalog…</option>
        {catalogItems.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          onAdd(value || null);
          setValue("");
        }}
      >
        <Plus size={14} /> Add
      </Button>
      <Button variant="text" size="sm" onClick={() => onAdd(null)}>
        Custom
      </Button>
    </div>
  );
}

function LineItemRow({
  position,
  lineItem,
  onUpdate,
  onDelete
}: {
  position: number;
  lineItem: PackageLineItemData;
  onUpdate: (u: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = lineItem.name_override ?? lineItem.catalog_item?.name ?? "Item";
  const method = lineItem.pricing_method_override ?? lineItem.catalog_item?.pricing_method ?? "fixed";

  return (
    <div className="rounded-[10px] border border-black/10 bg-panel p-3">
      <div className="flex items-center gap-3">
        <GripVertical size={15} className="shrink-0 cursor-grab text-muted/50" aria-hidden />
        <span className="flex h-5 w-6 shrink-0 items-center justify-center rounded-full bg-gold-soft text-[10px] font-semibold text-gold-dim">
          {String(position).padStart(2, "0")}
        </span>
        <button onClick={() => setExpanded((v) => !v)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium">{label}</p>
        </button>
        <select
          value={lineItem.selection_mode}
          onChange={(e) => onUpdate({ selectionMode: e.target.value as SelectionMode })}
          className={pillSelectClass}
        >
          <option value="included">Included</option>
          <option value="required">Required</option>
          <option value="optional">Optional</option>
          <option value="locked">Locked</option>
          <option value="hidden">Hidden</option>
        </select>
        <label className="flex shrink-0 items-center gap-1.5">
          <ToggleSwitch checked={lineItem.is_client_visible} onChange={(v) => onUpdate({ isClientVisible: v })} label="Client visible" />
        </label>
        <button onClick={onDelete} className="shrink-0 p-1 text-muted hover:text-status-declined" aria-label="Delete">
          <Trash2 size={14} />
        </button>
        <button onClick={() => setExpanded((v) => !v)} className="shrink-0 p-1 text-muted hover:text-foreground">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-black/10 pt-3">
          {!lineItem.catalog_item_id && (
            <Field label="Name" value={lineItem.name_override ?? ""} onChange={(v) => onUpdate({ nameOverride: v })} />
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={labelClass}>Pricing method override</span>
              <select value={method} onChange={(e) => onUpdate({ pricingMethodOverride: e.target.value })} className={inputClass}>
                {Object.entries(PRICING_METHOD_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <DraftField
              label="Price override (USD)"
              type="number"
              value={lineItem.price_cents_override != null ? String(lineItem.price_cents_override / 100) : ""}
              onCommit={(v) => onUpdate({ priceCentsOverride: v ? toCents(v) : null })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <DraftField label="Included qty" type="number" value={String(lineItem.included_quantity)} onCommit={(v) => onUpdate({ includedQuantity: parseInt(v || "0", 10) })} />
            <DraftField label="Min qty" type="number" value={lineItem.min_quantity != null ? String(lineItem.min_quantity) : ""} onCommit={(v) => onUpdate({ minQuantity: v ? parseInt(v, 10) : null })} />
            <DraftField label="Max qty" type="number" value={lineItem.max_quantity != null ? String(lineItem.max_quantity) : ""} onCommit={(v) => onUpdate({ maxQuantity: v ? parseInt(v, 10) : null })} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pricing ─────────────────────────────────────────────────────────

function PricingTab({
  templateId,
  template,
  pricingRules,
  onUpdate,
  onReload
}: {
  templateId: string;
  template: PackageTemplateData;
  pricingRules: PackagePricingRuleData[];
  onUpdate: (u: Partial<PackageTemplateData>) => void;
  onReload: () => void;
}) {
  const [newFee, setNewFee] = useState({ label: "", amount: "" });

  async function addPricingRule() {
    const label = window.prompt("Rule label (e.g. \"Friday/Saturday premium\")");
    if (!label?.trim()) return;
    await fetch(`/api/admin/package-templates/${templateId}/pricing-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim(), ruleType: "guest_band", match: { min: 0, max: 100 }, adjustmentType: "percent", adjustmentValue: 0, position: pricingRules.length })
    });
    onReload();
  }

  async function updatePricingRule(id: string, updates: Record<string, unknown>) {
    await fetch(`/api/admin/package-templates/pricing-rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    onReload();
  }

  async function deletePricingRule(id: string) {
    await fetch(`/api/admin/package-templates/pricing-rules/${id}`, { method: "DELETE" });
    onReload();
  }

  function addFee() {
    if (!newFee.label.trim() || !newFee.amount) return;
    const fees = [...(template.additional_fees ?? []), { label: newFee.label.trim(), amount_cents: toCents(newFee.amount) }];
    onUpdate({ additional_fees: fees });
    setNewFee({ label: "", amount: "" });
  }
  function removeFee(i: number) {
    onUpdate({ additional_fees: (template.additional_fees ?? []).filter((_, idx) => idx !== i) });
  }

  return (
    <div className="flex flex-col gap-4">
      <GlassCard className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Base price & display</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Display mode</span>
            <select value={template.display_mode} onChange={(e) => onUpdate({ display_mode: e.target.value as PackageTemplateData["display_mode"] })} className={inputClass}>
              <option value="fixed_total">Fixed total</option>
              <option value="starting_price">Starting price</option>
              <option value="price_range">Price range</option>
              <option value="quote_only">Request a quote</option>
            </select>
          </label>
          <DraftField label="Base price (USD)" type="number" value={String(template.base_price_cents / 100)} onCommit={(v) => onUpdate({ base_price_cents: toCents(v) })} />
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Hours & overtime</p>
        <div className="grid grid-cols-2 gap-3">
          <DraftField label="Included hours" type="number" value={template.included_hours != null ? String(template.included_hours) : ""} onCommit={(v) => onUpdate({ included_hours: v ? parseFloat(v) : null })} />
          <DraftField label="Minimum hours" type="number" value={template.minimum_hours != null ? String(template.minimum_hours) : ""} onCommit={(v) => onUpdate({ minimum_hours: v ? parseFloat(v) : null })} />
          <DraftField
            label="Overtime increment (minutes)"
            type="number"
            value={template.overtime_increment_minutes != null ? String(template.overtime_increment_minutes) : ""}
            onCommit={(v) => onUpdate({ overtime_increment_minutes: v ? parseInt(v, 10) : null })}
          />
          <DraftField
            label="Overtime price (USD per increment)"
            type="number"
            value={template.overtime_price_cents != null ? String(template.overtime_price_cents / 100) : ""}
            onCommit={(v) => onUpdate({ overtime_price_cents: v ? toCents(v) : null })}
          />
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Travel</p>
        <div className="grid grid-cols-3 gap-3">
          <DraftField label="Radius (miles)" type="number" value={template.travel_radius_miles != null ? String(template.travel_radius_miles) : ""} onCommit={(v) => onUpdate({ travel_radius_miles: v ? parseFloat(v) : null })} />
          <DraftField label="Flat fee (USD)" type="number" value={template.travel_flat_fee_cents != null ? String(template.travel_flat_fee_cents / 100) : ""} onCommit={(v) => onUpdate({ travel_flat_fee_cents: v ? toCents(v) : null })} />
          <DraftField label="Per mile (USD)" type="number" value={template.travel_per_mile_cents != null ? String(template.travel_per_mile_cents / 100) : ""} onCommit={(v) => onUpdate({ travel_per_mile_cents: v ? toCents(v) : null })} />
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Guest / seasonal / day-of-week adjustments</p>
          <Button variant="text" size="sm" onClick={addPricingRule}>
            <Plus size={13} /> Add rule
          </Button>
        </div>
        {pricingRules.length === 0 && <p className="text-xs text-muted">No adjustment rules yet.</p>}
        {pricingRules.map((rule) => (
          <PricingRuleRow key={rule.id} rule={rule} onUpdate={(u) => updatePricingRule(rule.id, u)} onDelete={() => deletePricingRule(rule.id)} />
        ))}
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Guest count range</p>
        <div className="grid grid-cols-2 gap-3">
          <DraftField label="Min guests" type="number" value={template.min_guest_count != null ? String(template.min_guest_count) : ""} onCommit={(v) => onUpdate({ min_guest_count: v ? parseInt(v, 10) : null })} />
          <DraftField label="Max guests" type="number" value={template.max_guest_count != null ? String(template.max_guest_count) : ""} onCommit={(v) => onUpdate({ max_guest_count: v ? parseInt(v, 10) : null })} />
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Deposit</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Deposit type</span>
            <select value={template.deposit_type ?? ""} onChange={(e) => onUpdate({ deposit_type: (e.target.value || null) as PackageTemplateData["deposit_type"] })} className={inputClass}>
              <option value="">None</option>
              <option value="percent">Percent of total</option>
              <option value="flat">Flat amount</option>
            </select>
          </label>
          <DraftField
            label={template.deposit_type === "flat" ? "Deposit (USD)" : "Deposit (%)"}
            type="number"
            value={template.deposit_value != null ? String(template.deposit_type === "flat" ? template.deposit_value / 100 : template.deposit_value) : ""}
            onCommit={(v) => onUpdate({ deposit_value: v ? (template.deposit_type === "flat" ? toCents(v) : parseFloat(v)) : null })}
          />
        </div>
        <p className="text-xs text-muted">Deposit is always part of the total — never charged on top of it.</p>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Fees & tax</p>
        <DraftField label="Tax (%)" type="number" value={template.tax_percent != null ? String(template.tax_percent) : ""} onCommit={(v) => onUpdate({ tax_percent: v ? parseFloat(v) : null })} />
        <div className="flex flex-col gap-2">
          {(template.additional_fees ?? []).map((f, i) => (
            <div key={i} className="flex items-center justify-between rounded-[10px] bg-panel px-3 py-2 text-sm">
              <span>{f.label}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">{money(f.amount_cents)}</span>
                <button onClick={() => removeFee(i)} className="p-1 text-muted hover:text-status-declined">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input value={newFee.label} onChange={(e) => setNewFee({ ...newFee, label: e.target.value })} placeholder="Fee label" className={cn(inputClass, "flex-1")} />
            <input value={newFee.amount} onChange={(e) => setNewFee({ ...newFee, amount: e.target.value })} placeholder="USD" type="number" className={cn(inputClass, "w-28")} />
            <Button variant="secondary" size="sm" onClick={addFee}>
              <Plus size={13} />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted">No tax rate or fee is invented — these stay blank until you set them.</p>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Pricing floor & discount ceiling</p>
        <div className="grid grid-cols-2 gap-3">
          <DraftField label="Minimum price (USD)" type="number" value={template.min_price_cents != null ? String(template.min_price_cents / 100) : ""} onCommit={(v) => onUpdate({ min_price_cents: v ? toCents(v) : null })} />
          <DraftField label="Max discount (%)" type="number" value={template.max_discount_percent != null ? String(template.max_discount_percent) : ""} onCommit={(v) => onUpdate({ max_discount_percent: v ? parseFloat(v) : null })} />
        </div>
      </GlassCard>
    </div>
  );
}

function PricingRuleRow({ rule, onUpdate, onDelete }: { rule: PackagePricingRuleData; onUpdate: (u: Record<string, unknown>) => void; onDelete: () => void }) {
  const match = rule.match as Record<string, unknown>;
  return (
    <div className="rounded-[10px] border border-black/10 bg-panel p-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Label" value={rule.label} onChange={(v) => onUpdate({ label: v })} />
        <label className="block">
          <span className={labelClass}>Rule type</span>
          <select value={rule.rule_type} onChange={(e) => onUpdate({ ruleType: e.target.value })} className={inputClass}>
            <option value="guest_band">Guest count band</option>
            <option value="day_of_week">Day of week</option>
            <option value="date_range">Date range</option>
            <option value="season">Season</option>
          </select>
        </label>
      </div>

      {rule.rule_type === "guest_band" && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <DraftField label="Min guests" type="number" value={match.min != null ? String(match.min) : ""} onCommit={(v) => onUpdate({ match: { ...match, min: v ? parseInt(v, 10) : null } })} />
          <DraftField label="Max guests" type="number" value={match.max != null ? String(match.max) : ""} onCommit={(v) => onUpdate({ match: { ...match, max: v ? parseInt(v, 10) : null } })} />
        </div>
      )}
      {rule.rule_type === "day_of_week" && (
        <Field
          label="Days (comma-separated: Fri, Sat)"
          value={Array.isArray(match.days) ? (match.days as string[]).join(", ") : ""}
          onChange={(v) =>
            onUpdate({ match: { days: v.split(",").map((d) => d.trim()).filter(Boolean) } })
          }
        />
      )}
      {(rule.rule_type === "date_range" || rule.rule_type === "season") && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="Start date" type="date" value={(match.start as string) ?? ""} onChange={(v) => onUpdate({ match: { ...match, start: v } })} />
          <Field label="End date" type="date" value={(match.end as string) ?? ""} onChange={(v) => onUpdate({ match: { ...match, end: v } })} />
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className={labelClass}>Adjustment</span>
          <select value={rule.adjustment_type} onChange={(e) => onUpdate({ adjustmentType: e.target.value })} className={inputClass}>
            <option value="percent">Percent</option>
            <option value="flat_cents">Flat amount</option>
          </select>
        </label>
        <DraftField
          label={rule.adjustment_type === "percent" ? "Value (%)" : "Value (USD)"}
          type="number"
          value={rule.adjustment_type === "percent" ? String(rule.adjustment_value) : String(rule.adjustment_value / 100)}
          onCommit={(v) => onUpdate({ adjustmentValue: rule.adjustment_type === "percent" ? parseFloat(v || "0") : toCents(v) })}
        />
      </div>

      <button onClick={onDelete} className="mt-2 flex items-center gap-1 text-xs font-medium text-muted hover:text-status-declined">
        <Trash2 size={12} /> Remove rule
      </button>
    </div>
  );
}

// ── Deals ─────────────────────────────────────────────────────────────

function DealsTab({
  templateId,
  allDeals,
  eligibleDealIds,
  onReload
}: {
  templateId: string;
  allDeals: DealData[];
  eligibleDealIds: string[];
  onReload: () => void;
}) {
  async function toggle(dealId: string, currentlyEligible: boolean) {
    const nextIds = currentlyEligible ? eligibleDealIds.filter((id) => id !== dealId) : [...eligibleDealIds, dealId];
    // Rebuild this deal's full eligibility set across all templates it's scoped to isn't tracked here,
    // so we only manage this template's membership via the per-deal eligibility endpoint using the
    // deal's own list plus/minus this template.
    await fetch(`/api/admin/deals/${dealId}/eligibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageTemplateIds: currentlyEligible ? [] : [templateId] })
    });
    void nextIds;
    onReload();
  }

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Eligible deals</p>
        <Link href="/admin/packages" className="text-xs font-medium text-gold hover:underline">
          Manage all deals <ExternalLink size={11} className="inline" />
        </Link>
      </div>
      {allDeals.length === 0 && <p className="text-xs text-muted">No deals created yet — add one from the Deals tab on the Packages list page.</p>}
      <div className="flex flex-col gap-2">
        {allDeals.map((d) => (
          <label key={d.id} className="flex items-center justify-between gap-3 rounded-[10px] bg-panel px-3 py-2">
            <div>
              <p className="text-sm font-medium">{d.name}</p>
              <p className="text-xs text-muted">{d.is_public ? "Public — applies everywhere" : "Private — scoped to selected packages"}</p>
            </div>
            {!d.is_public && <ToggleSwitch checked={eligibleDealIds.includes(d.id)} onChange={() => toggle(d.id, eligibleDealIds.includes(d.id))} />}
            {d.is_public && <span className="text-xs text-muted">Always on</span>}
          </label>
        ))}
      </div>
    </GlassCard>
  );
}

// ── Rules ─────────────────────────────────────────────────────────────

function RulesTab({
  templateId,
  lineItems,
  rules,
  onReload
}: {
  templateId: string;
  lineItems: PackageLineItemData[];
  rules: PackageRuleData[];
  onReload: () => void;
}) {
  const [ruleType, setRuleType] = useState<"requires" | "excludes" | "show_if">("requires");
  const [subject, setSubject] = useState("");
  const [target, setTarget] = useState("");
  const [conditionField, setConditionField] = useState("guest_count");
  const [conditionOp, setConditionOp] = useState(">=");
  const [conditionValue, setConditionValue] = useState("");

  function labelFor(id: string | null) {
    if (!id) return "—";
    const li = lineItems.find((l) => l.id === id);
    return li?.name_override ?? li?.catalog_item?.name ?? "Item";
  }

  async function addRule() {
    if (!subject) return;
    const body: Record<string, unknown> = { ruleType, subjectLineItemId: subject };
    if (ruleType === "show_if") {
      body.condition = { field: conditionField, op: conditionOp, value: isNaN(Number(conditionValue)) ? conditionValue : Number(conditionValue) };
    } else {
      if (!target) return;
      body.targetLineItemId = target;
    }
    await fetch(`/api/admin/package-templates/${templateId}/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    setSubject("");
    setTarget("");
    setConditionValue("");
    onReload();
  }

  async function deleteRule(id: string) {
    await fetch(`/api/admin/package-templates/rules/${id}`, { method: "DELETE" });
    onReload();
  }

  return (
    <GlassCard className="flex flex-col gap-4">
      <p className="text-sm font-semibold">Dependency & visibility rules</p>

      <div className="flex flex-col gap-2 rounded-[10px] border border-dashed border-border p-3">
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className={labelClass}>If</span>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass}>
              <option value="">Choose item…</option>
              {lineItems.map((li) => (
                <option key={li.id} value={li.id}>
                  {li.name_override ?? li.catalog_item?.name ?? "Item"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Rule</span>
            <select value={ruleType} onChange={(e) => setRuleType(e.target.value as typeof ruleType)} className={inputClass}>
              <option value="requires">requires</option>
              <option value="excludes">excludes</option>
              <option value="show_if">is only shown if</option>
            </select>
          </label>
          {ruleType !== "show_if" ? (
            <label className="block">
              <span className={labelClass}>Then</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass}>
                <option value="">Choose item…</option>
                {lineItems
                  .filter((li) => li.id !== subject)
                  .map((li) => (
                    <option key={li.id} value={li.id}>
                      {li.name_override ?? li.catalog_item?.name ?? "Item"}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <div className="grid grid-cols-3 gap-1 col-span-1">
              <select value={conditionField} onChange={(e) => setConditionField(e.target.value)} className={inputClass}>
                <option value="guest_count">guest count</option>
                <option value="event_type">event type</option>
              </select>
            </div>
          )}
        </div>
        {ruleType === "show_if" && (
          <div className="grid grid-cols-2 gap-2">
            <select value={conditionOp} onChange={(e) => setConditionOp(e.target.value)} className={inputClass}>
              <option value=">=">≥</option>
              <option value="<=">≤</option>
              <option value="eq">equals</option>
            </select>
            <input value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} placeholder="value" className={inputClass} />
          </div>
        )}
        <Button variant="secondary" size="sm" onClick={addRule} className="w-fit">
          <Plus size={13} /> Add rule
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {rules.length === 0 && <p className="text-xs text-muted">No rules yet — every item shows and behaves independently.</p>}
        {rules.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-[10px] bg-panel px-3 py-2 text-sm">
            <span>
              {r.rule_type === "show_if" ? (
                <>
                  <strong>{labelFor(r.subject_line_item_id)}</strong> shown only if {String((r.condition as Record<string, unknown>)?.field)}{" "}
                  {String((r.condition as Record<string, unknown>)?.op)} {String((r.condition as Record<string, unknown>)?.value)}
                </>
              ) : (
                <>
                  <strong>{labelFor(r.subject_line_item_id)}</strong> {r.rule_type} <strong>{labelFor(r.target_line_item_id)}</strong>
                </>
              )}
            </span>
            <button onClick={() => deleteRule(r.id)} className="p-1 text-muted hover:text-status-declined">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ── Design & Preview ────────────────────────────────────────────────

const GENERIC_INTRO_PLACEHOLDER = "e.g. \"Let's build the perfect soundtrack for your event — customize anything below, and watch your price update as you go.\"";
const GENERIC_CONFIRMATION_PLACEHOLDER = "e.g. \"Thanks! We've got your package details. This doesn't reserve your date yet — our team will follow up shortly to confirm everything.\"";

const COPY_TONE_OPTIONS: { value: string; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "warm", label: "Warm & Friendly" },
  { value: "energetic", label: "Energetic & Fun" },
  { value: "luxury", label: "Luxury & Upscale" },
  { value: "casual", label: "Casual" }
];

function DesignTab({ templateId, template, onUpdate }: { templateId: string; template: PackageTemplateData; onUpdate: (u: Partial<PackageTemplateData>) => void }) {
  const [generating, setGenerating] = useState<"intro" | "confirmation" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  async function writeWithAi(field: "intro" | "confirmation") {
    setGenerating(field);
    setAiError(null);
    try {
      const res = await fetch(`/api/admin/package-templates/${templateId}/generate-copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, tone: template.copy_tone ?? "professional" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate copy");
      onUpdate(field === "intro" ? { intro_copy: data.text } : { confirmation_message: data.text });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Icon (emoji or lucide name)" value={template.icon ?? ""} onChange={(v) => onUpdate({ icon: v || null })} />
        <Field label="Primary color (hex)" value={template.primary_color ?? ""} onChange={(v) => onUpdate({ primary_color: v || null })} />
      </div>
      <Field label="Image URL" value={template.image_url ?? ""} onChange={(v) => onUpdate({ image_url: v || null })} />
      {template.image_url && (
        <div className="h-32 w-full rounded-[10px] border border-border" style={{ backgroundImage: `url(${template.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      )}

      <label className="block">
        <span className={labelClass}>Copy tone</span>
        <select value={template.copy_tone ?? "professional"} onChange={(e) => onUpdate({ copy_tone: e.target.value })} className={inputClass}>
          {COPY_TONE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {aiError && <p className="text-xs text-status-declined">{aiError}</p>}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className={labelClass}>Intro copy</span>
          <button onClick={() => writeWithAi("intro")} disabled={generating !== null} className="flex items-center gap-1 text-xs font-medium text-gold hover:underline disabled:opacity-50">
            <Sparkles size={12} /> {generating === "intro" ? "Writing…" : "Write with AI"}
          </button>
        </div>
        <textarea
          value={template.intro_copy ?? ""}
          onChange={(e) => onUpdate({ intro_copy: e.target.value })}
          placeholder={GENERIC_INTRO_PLACEHOLDER}
          className={cn(inputClass, "min-h-[60px]")}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className={labelClass}>Confirmation message</span>
          <button onClick={() => writeWithAi("confirmation")} disabled={generating !== null} className="flex items-center gap-1 text-xs font-medium text-gold hover:underline disabled:opacity-50">
            <Sparkles size={12} /> {generating === "confirmation" ? "Writing…" : "Write with AI"}
          </button>
        </div>
        <textarea
          value={template.confirmation_message ?? ""}
          onChange={(e) => onUpdate({ confirmation_message: e.target.value })}
          placeholder={GENERIC_CONFIRMATION_PLACEHOLDER}
          className={cn(inputClass, "min-h-[60px]")}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label={'"Customize" button'} value={template.cta_customize_label} onChange={(v) => onUpdate({ cta_customize_label: v })} />
        <Field label={'"Request" button'} value={template.cta_request_label} onChange={(v) => onUpdate({ cta_request_label: v })} />
        <Field label={'"Save quote" button'} value={template.cta_save_quote_label} onChange={(v) => onUpdate({ cta_save_quote_label: v })} />
      </div>
    </GlassCard>
  );
}
