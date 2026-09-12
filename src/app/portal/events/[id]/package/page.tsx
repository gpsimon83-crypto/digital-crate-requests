"use client";

import { use as usePromise, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { PriceBreakdownPanel } from "@/components/packages/price-breakdown-panel";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronUp, ChevronDown } from "lucide-react";
import type { PackageSectionData, PackageTemplateData, PriceBreakdown, SelectionInput } from "@/lib/packages/types";

interface TemplateSummary {
  id: string;
  name: string;
  tier: string | null;
  description: string | null;
  display_mode: PackageTemplateData["display_mode"];
  base_price_cents: number;
  icon: string | null;
  image_url: string | null;
}

interface TemplateDetail {
  template: PackageTemplateData;
  sections: PackageSectionData[];
}

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function ClientPackageBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);

  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [lockedMinimums, setLockedMinimums] = useState<Record<string, number>>({});
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mobileBreakdownOpen, setMobileBreakdownOpen] = useState(false);

  const [guestCount, setGuestCount] = useState("");
  const [hoursBooked, setHoursBooked] = useState("");
  const [travelMiles, setTravelMiles] = useState("");

  function loadTemplates(preselectTemplateId?: string) {
    fetch(`/api/portal/events/${id}/package`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load packages");
        setTemplates(data.templates);
        setLockedMinimums(data.selection?.locked_minimums ?? {});
        if (preselectTemplateId ?? data.selection?.package_template_id) {
          selectTemplate(preselectTemplateId ?? data.selection.package_template_id, data.selection?.selections);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }

  useEffect(() => loadTemplates(), [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectTemplate(templateId: string, existingSelections?: Record<string, number>) {
    setSelectedTemplateId(templateId);
    fetch(`/api/portal/events/${id}/package?templateId=${templateId}`)
      .then((r) => r.json())
      .then((data) => {
        setDetail(data.templateDetail);
        const initial: Record<string, number> = {};
        for (const section of data.templateDetail?.sections ?? []) {
          for (const li of section.line_items) {
            const base = existingSelections?.[li.id] ?? (li.selection_mode === "included" || li.selection_mode === "required" || li.selection_mode === "locked" ? li.included_quantity || 1 : 0);
            initial[li.id] = Math.max(base, lockedMinimums[li.id] ?? 0);
          }
        }
        setQuantities(initial);
      });
  }

  const allLineItems = useMemo(() => detail?.sections.flatMap((s) => s.line_items) ?? [], [detail]);

  async function refreshPrice() {
    if (!selectedTemplateId) return;
    const selections: SelectionInput[] = allLineItems.map((li) => ({ lineItemId: li.id, quantity: quantities[li.id] ?? 0 }));
    const res = await fetch(`/api/portal/events/${id}/package/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: selectedTemplateId,
        selections,
        eventContext: {
          guestCount: guestCount ? parseInt(guestCount, 10) : undefined,
          hoursBooked: hoursBooked ? parseFloat(hoursBooked) : undefined,
          travelMiles: travelMiles ? parseFloat(travelMiles) : undefined
        }
      })
    });
    const data = await res.json();
    if (res.ok) setBreakdown(data.breakdown);
  }

  useEffect(() => {
    if (!selectedTemplateId) return;
    const t = setTimeout(refreshPrice, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, quantities, guestCount, hoursBooked, travelMiles]);

  async function submit(status: "saved" | "requested") {
    if (!selectedTemplateId) return;
    const selections: SelectionInput[] = allLineItems.map((li) => ({ lineItemId: li.id, quantity: quantities[li.id] ?? 0 }));
    const res = await fetch(`/api/portal/events/${id}/package/selection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: selectedTemplateId,
        status,
        selections,
        eventContext: { guestCount: guestCount ? parseInt(guestCount, 10) : undefined, hoursBooked: hoursBooked ? parseFloat(hoursBooked) : undefined, travelMiles: travelMiles ? parseFloat(travelMiles) : undefined }
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setNotice(
      status === "requested"
        ? "Request sent — this does not reserve your date or performer. Our team will follow up to confirm details and pricing."
        : "Your quote is saved. You can come back and pick up where you left off."
    );
  }

  if (error && templates === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-status-declined">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 pb-28 md:py-12 md:pb-12">
      <Link href={`/portal/events/${id}`} className="mb-6 flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Back to event
      </Link>

      <h1 className="font-display text-4xl font-light">Build Your Package</h1>
      <p className="mt-1 text-sm text-muted">Choose a starting point, then customize what&rsquo;s included. Your total updates live as you go.</p>

      {notice && <p className="mt-4 rounded-[10px] border border-status-approved/30 bg-status-approved/10 px-3 py-2 text-sm text-status-approved">{notice}</p>}
      {error && <p className="mt-4 text-sm text-status-declined">{error}</p>}

      {!selectedTemplateId && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {(templates ?? []).map((t) => (
            <button key={t.id} onClick={() => selectTemplate(t.id)} className="text-left">
              <GlassCard className="flex h-full flex-col gap-0 overflow-hidden !p-0 transition-colors hover:border-gold/40">
                <div
                  className="h-28 w-full shrink-0"
                  style={
                    t.image_url
                      ? { backgroundImage: `url(${t.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                      : { background: "linear-gradient(135deg, var(--gold-light), var(--gold-dim))" }
                  }
                />
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{t.name}</p>
                    {t.tier && <span className="text-[10px] font-semibold uppercase tracking-wide text-gold">{t.tier}</span>}
                  </div>
                  {t.description && <p className="text-xs text-muted">{t.description}</p>}
                  <p className="mt-auto text-sm font-semibold">
                    {t.display_mode === "quote_only" ? "Request a quote" : t.display_mode === "starting_price" ? `From ${money(t.base_price_cents)}` : money(t.base_price_cents)}
                  </p>
                </div>
              </GlassCard>
            </button>
          ))}
          {templates && templates.length === 0 && <p className="text-sm text-muted">No packages are published for this event type yet — reach out and we&rsquo;ll build a quote with you directly.</p>}
        </div>
      )}

      {selectedTemplateId && detail && (
        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,640px)_380px] xl:items-start">
          <div className="flex flex-col gap-4">
            <button onClick={() => setSelectedTemplateId(null)} className="w-fit text-xs font-medium text-muted hover:text-foreground">
              ← Choose a different package
            </button>

            {detail.template.image_url && (
              <div
                className="h-40 w-full rounded-2xl border border-border"
                style={{ backgroundImage: `url(${detail.template.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }}
              />
            )}

            {detail.template.intro_copy && <p className="text-sm text-muted">{detail.template.intro_copy}</p>}

            <GlassCard className="grid grid-cols-3 gap-3">
              <NumberField label="Guests" value={guestCount} onChange={setGuestCount} />
              <NumberField label="Hours" value={hoursBooked} onChange={setHoursBooked} />
              <NumberField label="Travel miles" value={travelMiles} onChange={setTravelMiles} />
            </GlassCard>

            {detail.sections.map((section) => (
              <GlassCard key={section.id} className="flex flex-col gap-3">
                <p className="text-sm font-semibold">{section.title}</p>
                <div className="flex flex-col gap-2">
                  {section.line_items.map((li) => (
                    <LineItemControl
                      key={li.id}
                      lineItem={li}
                      quantity={quantities[li.id] ?? 0}
                      minLocked={lockedMinimums[li.id] ?? 0}
                      onChange={(q) => setQuantities((prev) => ({ ...prev, [li.id]: q }))}
                    />
                  ))}
                </div>
              </GlassCard>
            ))}

            <div className="hidden gap-3 sm:flex">
              <Button variant="secondary" onClick={() => submit("saved")}>
                {detail.template.cta_save_quote_label}
              </Button>
              <Button variant="primary" onClick={() => submit("requested")}>
                {detail.template.cta_request_label}
              </Button>
            </div>
            <p className="text-xs text-muted">Saving or requesting doesn&rsquo;t reserve your date or performer — our team follows up to confirm.</p>
          </div>

          <div className="hidden xl:sticky xl:top-6 xl:block">
            <GlassCard className="flex flex-col gap-4">
              <p className="text-sm font-semibold">{detail.template.name}</p>
              {breakdown ? <PriceBreakdownPanel breakdown={breakdown} /> : <p className="text-xs text-muted">Calculating…</p>}
            </GlassCard>
          </div>

          {/* Mobile compact total bar */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card p-3 xl:hidden">
            {mobileBreakdownOpen && breakdown && (
              <div className="mb-3 max-h-[50vh] overflow-y-auto rounded-[10px] border border-border bg-panel p-3">
                <PriceBreakdownPanel breakdown={breakdown} />
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => setMobileBreakdownOpen((v) => !v)} className="flex items-center gap-1.5 text-sm font-semibold">
                {money(breakdown?.totalCents ?? 0)}
                {mobileBreakdownOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
              </button>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => submit("saved")}>
                  Save
                </Button>
                <Button variant="primary" size="sm" onClick={() => submit("requested")}>
                  {detail.template.cta_request_label}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
    </label>
  );
}

function LineItemControl({
  lineItem,
  quantity,
  minLocked,
  onChange
}: {
  lineItem: PackageSectionData["line_items"][number];
  quantity: number;
  minLocked: number;
  onChange: (q: number) => void;
}) {
  const label = lineItem.name_override ?? lineItem.catalog_item?.name ?? "Item";
  const description = lineItem.description_override ?? lineItem.catalog_item?.description;
  const method = lineItem.pricing_method_override ?? lineItem.catalog_item?.pricing_method ?? "fixed";
  const priceCents = lineItem.price_cents_override ?? lineItem.catalog_item?.price_cents ?? 0;
  const supportsQuantity = method === "hourly" || method === "per_person" || method === "per_unit";
  const locked = lineItem.selection_mode === "locked" || lineItem.selection_mode === "included";
  const selected = quantity > 0;
  const floor = Math.max(lineItem.selection_mode === "required" ? Math.max(1, lineItem.min_quantity ?? 1) : (lineItem.min_quantity ?? 0), minLocked);
  const showStepper = !locked && (supportsQuantity || lineItem.selection_mode === "required" || minLocked > 0);

  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-[10px] border border-black/10 bg-panel p-3", locked && "opacity-90")}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="mt-0.5 truncate text-xs text-muted">{description}</p>}
        {method === "quote_only" ? (
          <p className="mt-0.5 text-xs text-gold">Priced on request</p>
        ) : (
          <p className="mt-0.5 text-xs text-muted">
            {money(priceCents)}
            {method === "hourly" && "/hr"}
            {method === "per_person" && "/guest"}
            {method === "per_unit" && ` / ${lineItem.catalog_item?.unit_label ?? "unit"}`}
          </p>
        )}
        {minLocked > 0 && <p className="mt-0.5 text-xs text-gold">Minimum {minLocked} required for this gig</p>}
      </div>

      {locked ? (
        <span className="shrink-0 rounded-full bg-gold-soft px-2.5 py-1 text-[11px] font-semibold text-gold-dim">Included</span>
      ) : showStepper ? (
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => onChange(Math.max(floor, quantity - 1))}
            disabled={quantity <= floor}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm hover:border-gold disabled:opacity-30"
          >
            −
          </button>
          <span className="w-6 text-center text-sm tabular-nums">{quantity}</span>
          <button
            onClick={() => onChange(Math.min(lineItem.max_quantity ?? 99, quantity + 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm hover:border-gold"
          >
            +
          </button>
        </div>
      ) : (
        <button
          onClick={() => onChange(selected ? 0 : 1)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            selected ? "border-gold bg-gold/10 text-gold" : "border-border text-muted hover:border-gold hover:text-foreground"
          )}
        >
          {selected ? "Added" : "Add"}
        </button>
      )}
    </div>
  );
}
