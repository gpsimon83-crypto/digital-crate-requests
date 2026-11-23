"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, PenLine, Plus, Power, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell, SectionCard, FieldGroup, FieldRow, INPUT } from "@/components/layout/grid";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SideDrawer } from "@/components/ui/side-drawer";
import { cn } from "@/lib/utils";
import { PRICING_LABEL, PRICING_TYPES, priceLabel, type AdminAddon, type AdminPackage, type Category, type PricingType } from "@/lib/data/catalog";
import { computePayout, dollars, parseDollars, STANDARD_PERCENT } from "@/lib/payouts/rule";

type Catalog = { ready: boolean; categories: Category[]; packages: AdminPackage[]; addons: AdminAddon[]; money: { view: boolean; manage: boolean } };

const UNSORTED = "_none";

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't save");
  return data;
}

export default function AdminServicesPage() {
  return (
    <Suspense>
      <ServicesPage />
    </Suspense>
  );
}

function ServicesPage() {
  const params = useSearchParams();
  const [cat, setCat] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPackage | "new" | null>(null);
  const [editingAddon, setEditingAddon] = useState<AdminAddon | "new" | null>(null);
  const [managing, setManaging] = useState(false);

  const load = useCallback(
    () =>
      fetch("/api/admin/services", { cache: "no-store" })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Couldn't load services");
          setCat(data);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load services")),
    []
  );
  useEffect(() => {
    void load();
  }, [load]);

  const unsorted = useMemo(() => (cat?.packages ?? []).filter((p) => p.categories.length === 0), [cat]);
  const tabs = useMemo(() => {
    const t = (cat?.categories ?? []).map((c) => ({ key: c.slug, label: c.is_active ? c.name : `${c.name} (off)` }));
    if (unsorted.length) t.push({ key: UNSORTED, label: `Not in a category (${unsorted.length})` });
    return t;
  }, [cat, unsorted.length]);
  const activeKey = tabs.find((t) => t.key === params.get("cat"))?.key ?? tabs[0]?.key ?? UNSORTED;
  const category = cat?.categories.find((c) => c.slug === activeKey) ?? null;

  const inTab = useMemo(() => {
    if (!cat) return [];
    if (!category) return unsorted;
    return cat.packages
      .map((p) => ({ p, pos: p.categories.find((l) => l.category_id === category.id)?.position }))
      .filter((x): x is { p: AdminPackage; pos: number } => x.pos !== undefined)
      .sort((a, b) => Number(b.p.is_active) - Number(a.p.is_active) || a.pos - b.pos || a.p.name.localeCompare(b.p.name))
      .map((x) => x.p);
  }, [cat, category, unsorted]);
  const addonsHere = (cat?.addons ?? []).filter((a) => !category || a.category_ids.length === 0 || a.category_ids.includes(category.id));

  async function run(fn: () => Promise<unknown>, done?: string) {
    setError(null);
    try {
      await fn();
      if (done) setNotice(done);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  function move(p: AdminPackage, dir: -1 | 1) {
    if (!category) return;
    const active = inTab.filter((x) => x.is_active);
    const i = active.findIndex((x) => x.id === p.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= active.length) return;
    const ids = active.map((x) => x.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => send("/api/admin/services/order", "POST", { categoryId: category.id, packageIds: ids }));
  }

  return (
    <>
      <PageHeader title="Services" subtitle="Manage your bookable packages and add-ons. Clients see them on the Services page." action={<a href="/services" target="_blank" rel="noreferrer" data-tour="services-client-link" className="text-sm font-medium text-gold hover:underline">View client Services page ↗</a>} />
      <PageShell className="flex flex-col gap-5">
        {cat && !cat.ready && (
          <p role="alert" className="rounded-[10px] border border-status-urgent/40 px-3 py-2 text-sm">
            Run migration <strong>0066_services_catalog_payouts.sql</strong> in Supabase to turn on categories, payout rules and DJ offers. Until then this shows your current packages without categories.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-[10px] border border-status-declined/40 px-3 py-2 text-sm text-status-declined">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="flex items-start justify-between gap-3 rounded-[10px] border border-status-approved/40 px-3 py-2 text-sm">
            {notice}
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-muted hover:text-foreground">
              ×
            </button>
          </p>
        )}

        {tabs.length > 0 && <Tabs variant="pill" label="Event categories" items={tabs} active={activeKey} hrefFor={(k) => `/admin/services?cat=${k}`} />}

        <SectionCard
          data-tour="services-packages"
          title="Packages"
          description={category ? `Bookable DJ packages for ${category.name.toLowerCase()}.` : cat?.ready ? "These packages aren't in any category, so clients don't see them. Edit one to place it." : "Your packages."}
          actions={
            <>
              {cat?.ready && (
                <Button variant="secondary" onClick={() => setManaging(true)} data-tour="services-categories">
                  Manage Categories
                </Button>
              )}
              <Button variant="primary" onClick={() => setEditing("new")}>
                <Plus size={15} aria-hidden /> Add Package
              </Button>
            </>
          }
        >
          {!cat ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : inTab.length === 0 ? (
            <p className="text-sm text-muted">No packages here yet.</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {inTab.map((p) => {
                const active = inTab.filter((x) => x.is_active);
                const idx = active.findIndex((x) => x.id === p.id);
                const included = p.included_addon_ids.map((id) => cat.addons.find((a) => a.id === id)?.name).filter(Boolean);
                return (
                  <li key={p.id} className={cn("flex min-w-0 flex-col gap-3 rounded-[14px] border border-border p-5", !p.is_active && "opacity-60")} data-package={p.name}>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 break-words text-lg font-semibold leading-snug">{p.name}</h3>
                      <p className="shrink-0 text-right text-lg font-semibold text-gold">{priceLabel(p)}</p>
                    </div>
                    <p className="-mt-1 text-sm text-muted">
                      {p.hours != null ? `${p.hours} hours` : "Coverage set per quote"}
                      {!p.is_active && " · Off"}
                      {p.quote_before_payment && " · Quote confirmed before payment"}
                    </p>
                    {p.description && <p className="text-sm text-foreground/85">{p.description}</p>}
                    {p.features.length > 0 && (
                      <ul className="flex flex-col gap-1 text-sm">
                        {p.features.map((f, i) => (
                          <li key={`${f}-${i}`} className="flex gap-2">
                            <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/60" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                    {included.length > 0 && <p className="text-xs text-muted">Included add-ons: {included.join(", ")}</p>}
                    {cat.money.view && p.payout_type && (
                      <p className="text-xs text-muted" title="Only staff with finance access see this">
                        DJ payout: {p.payout_type === "flat" ? `${dollars(p.payout_flat_cents ?? 0)} flat` : `${p.payout_percent ?? STANDARD_PERCENT}%${p.eligible_service_cents != null ? ` of ${dollars(p.eligible_service_cents)}` : ""}`}
                      </p>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
                      <button type="button" onClick={() => setEditing(p)} className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:underline" aria-label={`Edit ${p.name}`}>
                        <PenLine size={14} aria-hidden /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => run(() => send(`/api/admin/services/packages/${p.id}`, "PATCH", { isActive: !p.is_active }), p.is_active ? `${p.name} is off. Clients and new inquiries no longer see it; existing bookings keep it.` : `${p.name} is on again.`)}
                        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
                        aria-label={`${p.is_active ? "Deactivate" : "Activate"} ${p.name}`}
                      >
                        <Power size={14} aria-hidden /> {p.is_active ? "Deactivate" : "Activate"}
                      </button>
                      {category && p.is_active && active.length > 1 && (
                        <span className="ml-auto flex gap-1">
                          <button type="button" disabled={idx <= 0} onClick={() => move(p, -1)} aria-label={`Move ${p.name} earlier`} className="rounded-[8px] p-1.5 text-muted hover:text-foreground disabled:opacity-30">
                            <ArrowLeft size={15} aria-hidden />
                          </button>
                          <button type="button" disabled={idx >= active.length - 1} onClick={() => move(p, 1)} aria-label={`Move ${p.name} later`} className="rounded-[8px] p-1.5 text-muted hover:text-foreground disabled:opacity-30">
                            <ArrowRight size={15} aria-hidden />
                          </button>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          data-tour="services-addons"
          title="Add-Ons"
          description={category ? `Offered with ${category.name.toLowerCase()} packages. A package that already includes one shows it as Included, with no extra charge.` : "Optional extras."}
          actions={
            <Button variant="primary" onClick={() => setEditingAddon("new")}>
              <Plus size={15} aria-hidden /> Add Add-On
            </Button>
          }
        >
          {addonsHere.length === 0 ? (
            <p className="text-sm text-muted">No add-ons here yet.</p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {addonsHere.map((a) => (
                <li key={a.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 py-3", !a.is_active && "opacity-60")}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {a.name}
                      {!a.is_active && <span className="ml-2 text-xs text-muted">Off</span>}
                    </p>
                    {a.description && <p className="text-sm text-muted">{a.description}</p>}
                  </div>
                  <span className="font-semibold text-gold">{dollars(Math.round(a.price * 100))}</span>
                  <button type="button" onClick={() => setEditingAddon(a)} aria-label={`Edit ${a.name}`} className="rounded-[8px] p-1.5 text-gold hover:bg-gold/10">
                    <PenLine size={15} aria-hidden />
                  </button>
                  <button type="button" onClick={() => run(() => send(`/api/admin/services/addons/${a.id}`, "PATCH", { isActive: !a.is_active }))} className="text-sm text-muted hover:text-foreground" aria-label={`${a.is_active ? "Deactivate" : "Activate"} ${a.name}`}>
                    {a.is_active ? "Deactivate" : "Activate"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </PageShell>

      {cat && editing && (
        <PackageDrawer
          key={editing === "new" ? "new" : editing.id}
          pkg={editing === "new" ? null : editing}
          catalog={cat}
          defaultCategoryId={category?.id ?? null}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            setNotice(msg);
            await load();
          }}
        />
      )}
      {cat && editingAddon && (
        <AddonDrawer
          key={editingAddon === "new" ? "new-addon" : editingAddon.id}
          addon={editingAddon === "new" ? null : editingAddon}
          catalog={cat}
          defaultCategoryId={category?.id ?? null}
          onClose={() => setEditingAddon(null)}
          onSaved={async (msg) => {
            setEditingAddon(null);
            setNotice(msg);
            await load();
          }}
        />
      )}
      {cat && <CategoriesDrawer open={managing} categories={cat.categories} onClose={() => setManaging(false)} onChanged={load} />}
    </>
  );
}

// ------------------------------------------------------------ package

function PackageDrawer({ pkg, catalog, defaultCategoryId, onClose, onSaved }: { pkg: AdminPackage | null; catalog: Catalog; defaultCategoryId: string | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [name, setName] = useState(pkg?.name ?? "");
  const [description, setDescription] = useState(pkg?.description ?? "");
  const [pricingType, setPricingType] = useState<PricingType>(pkg?.pricing_type ?? "fixed");
  const [price, setPrice] = useState(pkg ? String(pkg.price) : "");
  const [hours, setHours] = useState(pkg?.hours != null ? String(pkg.hours) : "");
  const [features, setFeatures] = useState<string[]>(pkg?.features ?? []);
  const [newFeature, setNewFeature] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>(pkg ? pkg.categories.map((c) => c.category_id) : defaultCategoryId ? [defaultCategoryId] : []);
  const [included, setIncluded] = useState<string[]>(pkg?.included_addon_ids ?? []);
  const [quoteFirst, setQuoteFirst] = useState(pkg?.quote_before_payment ?? false);
  const [payoutType, setPayoutType] = useState<"percent" | "flat">(pkg?.payout_type ?? "percent");
  const [percent, setPercent] = useState(String(pkg?.payout_percent ?? STANDARD_PERCENT));
  const [flat, setFlat] = useState(pkg?.payout_flat_cents != null ? String(pkg.payout_flat_cents / 100) : "");
  const [eligible, setEligible] = useState(pkg?.eligible_service_cents != null ? String(pkg.eligible_service_cents / 100) : "");
  const [thirdParty, setThirdParty] = useState(pkg?.third_party_fee_cents != null ? String(pkg.third_party_fee_cents / 100) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const clientCents = parseDollars(price) ?? 0;
  const preview = computePayout({
    rule: { type: payoutType, percent: Number(percent) || 0, flatCents: parseDollars(flat) },
    clientPriceCents: clientCents,
    eligibleCents: parseDollars(eligible),
    thirdPartyFeeCents: parseDollars(thirdParty) ?? 0
  });
  const moveFeature = (i: number, d: -1 | 1) =>
    setFeatures((f) => {
      const j = i + d;
      if (j < 0 || j >= f.length) return f;
      const n = [...f];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  async function save() {
    if (!name.trim()) return setErr("Give the package a name.");
    if (pricingType !== "quote" && parseDollars(price) == null) return setErr("Enter a price.");
    const body: Record<string, unknown> = {
      name,
      description,
      pricingType,
      price: pricingType === "quote" && !price ? 0 : Number(String(price).replace(/[$,]/g, "")),
      hours: hours === "" ? null : Number(hours),
      features: newFeature.trim() ? [...features, newFeature.trim()] : features,
      quoteBeforePayment: quoteFirst,
      includedAddonIds: included
    };
    if (catalog.ready) body.categoryIds = categoryIds;
    if (catalog.money.manage) Object.assign(body, { payoutType, payoutPercent: Number(percent) || 0, payoutFlatCents: payoutType === "flat" ? parseDollars(flat) : (pkg?.payout_flat_cents ?? null), eligibleServiceCents: parseDollars(eligible), thirdPartyFeeCents: parseDollars(thirdParty) });
    setSaving(true);
    setErr(null);
    try {
      if (pkg) await send(`/api/admin/services/packages/${pkg.id}`, "PATCH", body);
      else await send("/api/admin/services/packages", "POST", body);
      onSaved(pkg ? `Saved ${name.trim()}. New offers and inquiries use it now; existing proposals, bookings and invoices keep their prices.` : `Added ${name.trim()}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SideDrawer open onClose={onClose} title={pkg ? "Edit Package" : "Add Package"}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <FieldGroup label="Package name" htmlFor="pkg-name">
          <input id="pkg-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required className={INPUT} />
        </FieldGroup>
        {catalog.ready && (
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Categories</legend>
            <div className="flex flex-wrap gap-2">
              {catalog.categories.map((c) => {
                const on = categoryIds.includes(c.id);
                return (
                  <label key={c.id} className={cn("flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm", on ? "border-gold bg-gold/10" : "border-border")}>
                    <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={on} onChange={() => setCategoryIds((ids) => (on ? ids.filter((x) => x !== c.id) : [...ids, c.id]))} />
                    {c.name}
                  </label>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted">Tick more than one to show the same package in several categories. Editing it changes it everywhere.</p>
          </fieldset>
        )}
        <FieldRow>
          <FieldGroup label="Pricing type" htmlFor="pkg-pricing">
            <select id="pkg-pricing" value={pricingType} onChange={(e) => setPricingType(e.target.value as PricingType)} className={INPUT}>
              {PRICING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PRICING_LABEL[t]}
                </option>
              ))}
            </select>
          </FieldGroup>
          <FieldGroup label={pricingType === "starting_at" ? "Starting price ($)" : "Price ($)"} htmlFor="pkg-price" hint={pricingType === "quote" ? "Optional: clients see “Request a quote”." : undefined}>
            <input id="pkg-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT} />
          </FieldGroup>
        </FieldRow>
        <FieldGroup label="Coverage (hours)" htmlFor="pkg-hours" size="short">
          <input id="pkg-hours" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 5" className={INPUT} />
        </FieldGroup>
        <FieldGroup label="Description" htmlFor="pkg-desc">
          <textarea id="pkg-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} className={INPUT} />
        </FieldGroup>

        <fieldset data-tour="package-features">
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Included features</legend>
          <ul className="flex flex-col gap-1.5">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-1.5 rounded-[10px] border border-border px-2 py-1">
                <input value={f} onChange={(e) => setFeatures((all) => all.map((x, k) => (k === i ? e.target.value : x)))} aria-label={`Feature ${i + 1}`} className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm focus:outline-none" />
                <button type="button" onClick={() => moveFeature(i, -1)} disabled={i === 0} aria-label={`Move ${f || "feature"} up`} className="p-1 text-muted hover:text-foreground disabled:opacity-30">
                  <ArrowUp size={14} aria-hidden />
                </button>
                <button type="button" onClick={() => moveFeature(i, 1)} disabled={i === features.length - 1} aria-label={`Move ${f || "feature"} down`} className="p-1 text-muted hover:text-foreground disabled:opacity-30">
                  <ArrowDown size={14} aria-hidden />
                </button>
                <button type="button" onClick={() => setFeatures((all) => all.filter((_, k) => k !== i))} aria-label={`Remove ${f || "feature"}`} className="p-1 text-status-declined">
                  <Trash2 size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input
              value={newFeature}
              onChange={(e) => setNewFeature(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newFeature.trim()) {
                    setFeatures((f) => [...f, newFeature.trim()]);
                    setNewFeature("");
                  }
                }
              }}
              placeholder="Add a feature"
              aria-label="New feature"
              className={INPUT}
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 whitespace-nowrap"
              onClick={() => {
                if (newFeature.trim()) {
                  setFeatures((f) => [...f, newFeature.trim()]);
                  setNewFeature("");
                }
              }}
            >
              <Plus size={14} aria-hidden /> Add Feature
            </Button>
          </div>
        </fieldset>

        {catalog.addons.length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Add-ons this package includes</legend>
            <div className="flex flex-col gap-1.5">
              {catalog.addons
                .filter((a) => a.is_active || included.includes(a.id))
                .map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={included.includes(a.id)} onChange={(e) => setIncluded((ids) => (e.target.checked ? [...ids, a.id] : ids.filter((x) => x !== a.id)))} />
                    {a.name} <span className="text-muted">({dollars(Math.round(a.price * 100))} on its own)</span>
                  </label>
                ))}
            </div>
            <p className="mt-1 text-xs text-muted">Shown to clients as Included, and never charged again on top of this package.</p>
          </fieldset>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={quoteFirst} onChange={(e) => setQuoteFirst(e.target.checked)} />
          Confirm a quote before the client pays
        </label>

        {catalog.money.view && (
          <fieldset className="flex flex-col gap-3 rounded-[12px] border border-gold/40 p-4" data-tour="package-payout">
            <legend className="px-1 text-sm font-semibold">DJ Payout</legend>
            <p className="-mt-1 text-xs text-muted">Admins only. Used to suggest the payout on new DJ offers. Accepted offers keep the amount the DJ agreed to.</p>
            <FieldRow>
              <FieldGroup label="Payout type" htmlFor="pkg-payout-type">
                <select id="pkg-payout-type" value={payoutType} onChange={(e) => setPayoutType(e.target.value as "percent" | "flat")} disabled={!catalog.money.manage} className={INPUT}>
                  <option value="percent">Percentage</option>
                  <option value="flat">Flat amount</option>
                </select>
              </FieldGroup>
              {payoutType === "percent" ? (
                <FieldGroup label="DJ share (%)" htmlFor="pkg-payout-pct">
                  <input id="pkg-payout-pct" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} disabled={!catalog.money.manage} className={INPUT} />
                </FieldGroup>
              ) : (
                <FieldGroup label="Flat payout ($)" htmlFor="pkg-payout-flat">
                  <input id="pkg-payout-flat" inputMode="decimal" value={flat} onChange={(e) => setFlat(e.target.value)} disabled={!catalog.money.manage} className={INPUT} />
                </FieldGroup>
              )}
            </FieldRow>
            {payoutType === "percent" && (
              <FieldGroup label="Eligible DJ service amount ($)" htmlFor="pkg-eligible" hint="For bundles: the part of the price that is DJ service. Leave blank to use the whole price. Tax, tips, band fees and rentals are never included.">
                <input id="pkg-eligible" inputMode="decimal" value={eligible} onChange={(e) => setEligible(e.target.value)} disabled={!catalog.money.manage} placeholder={price ? `Whole price (${dollars(clientCents)})` : ""} className={INPUT} />
              </FieldGroup>
            )}
            <FieldGroup label="Known third-party fees ($)" htmlFor="pkg-third" hint="e.g. the band fee. Only used for the estimate below.">
              <input id="pkg-third" inputMode="decimal" value={thirdParty} onChange={(e) => setThirdParty(e.target.value)} disabled={!catalog.money.manage} className={INPUT} />
            </FieldGroup>
            <dl className="grid grid-cols-3 gap-2 rounded-[10px] bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] p-3 text-sm" aria-label="Payout preview" data-testid="payout-preview">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Client price</dt>
                <dd className="font-semibold">{dollars(clientCents)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Est. DJ payout</dt>
                <dd className="font-semibold">{dollars(preview.payoutCents)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Est. DCDJs share</dt>
                <dd className="font-semibold">{dollars(preview.companyShareCents)}</dd>
              </div>
            </dl>
            <p className="-mt-1 text-[11px] text-muted">DCDJs share is before expenses. DJ-sourced bookings use 65/35, chosen on the offer.</p>
          </fieldset>
        )}

        {err && (
          <p role="alert" className="text-sm text-status-declined">
            {err}
          </p>
        )}
        <Button variant="primary" type="submit" disabled={saving} className="w-full justify-center">
          {saving ? "Saving…" : pkg ? "Save Changes" : "Add Package"}
        </Button>
      </form>
    </SideDrawer>
  );
}

// -------------------------------------------------------------- add-on

function AddonDrawer({ addon, catalog, defaultCategoryId, onClose, onSaved }: { addon: AdminAddon | null; catalog: Catalog; defaultCategoryId: string | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [name, setName] = useState(addon?.name ?? "");
  const [description, setDescription] = useState(addon?.description ?? "");
  const [price, setPrice] = useState(addon ? String(addon.price) : "");
  const [cats, setCats] = useState<string[]>(addon?.category_ids ?? (defaultCategoryId ? [defaultCategoryId] : []));
  const [pkgs, setPkgs] = useState<string[]>(addon ? catalog.packages.filter((p) => p.included_addon_ids.includes(addon.id)).map((p) => p.id) : []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setErr("Give the add-on a name.");
    if (parseDollars(price) == null) return setErr("Enter a price.");
    setSaving(true);
    setErr(null);
    const body: Record<string, unknown> = { name, description, price: Number(String(price).replace(/[$,]/g, "")) };
    if (catalog.ready) Object.assign(body, { categoryIds: cats, includedInPackageIds: pkgs });
    try {
      if (addon) await send(`/api/admin/services/addons/${addon.id}`, "PATCH", body);
      else await send("/api/admin/services/addons", "POST", body);
      onSaved(addon ? `Saved ${name.trim()}.` : `Added ${name.trim()}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SideDrawer open onClose={onClose} title={addon ? "Edit Add-On" : "Add Add-On"}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <FieldGroup label="Name" htmlFor="addon-name">
          <input id="addon-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required className={INPUT} />
        </FieldGroup>
        <FieldGroup label="Description" htmlFor="addon-desc">
          <textarea id="addon-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1000} className={INPUT} />
        </FieldGroup>
        <FieldGroup label="Price ($)" htmlFor="addon-price" size="short">
          <input id="addon-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT} />
        </FieldGroup>
        {catalog.ready && (
          <>
            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Offered in</legend>
              <div className="flex flex-wrap gap-2">
                {catalog.categories.map((c) => {
                  const on = cats.includes(c.id);
                  return (
                    <label key={c.id} className={cn("flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm", on ? "border-gold bg-gold/10" : "border-border")}>
                      <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={on} onChange={() => setCats((ids) => (on ? ids.filter((x) => x !== c.id) : [...ids, c.id]))} />
                      {c.name}
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted">None ticked = offered in every category.</p>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Included in these packages</legend>
              <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                {catalog.packages
                  .filter((p) => p.is_active || pkgs.includes(p.id))
                  .map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={pkgs.includes(p.id)} onChange={(e) => setPkgs((ids) => (e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id)))} />
                      {p.name}
                    </label>
                  ))}
              </div>
              <p className="mt-1 text-xs text-muted">Those packages show it as Included and it isn&apos;t charged again.</p>
            </fieldset>
          </>
        )}
        {err && (
          <p role="alert" className="text-sm text-status-declined">
            {err}
          </p>
        )}
        <Button variant="primary" type="submit" disabled={saving} className="w-full justify-center">
          {saving ? "Saving…" : addon ? "Save Changes" : "Add Add-On"}
        </Button>
      </form>
    </SideDrawer>
  );
}

// ---------------------------------------------------------- categories

function CategoriesDrawer({ open, categories, onClose, onChanged }: { open: boolean; categories: Category[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameOf = (c: Category) => names[c.id] ?? c.name;

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= categories.length) return;
    const ids = categories.map((c) => c.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    act(() => send("/api/admin/services/categories/order", "POST", { ids }));
  };

  return (
    <SideDrawer open={open} onClose={onClose} title="Manage Categories" subtitle="The tabs on the Services page, in this order. Turning one off hides it from clients; its packages stay.">
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {categories.map((c, i) => (
            <li key={c.id} className={cn("flex items-center gap-1.5 rounded-[10px] border border-border p-2", !c.is_active && "opacity-70")}>
              <input value={nameOf(c)} onChange={(e) => setNames((n) => ({ ...n, [c.id]: e.target.value }))} aria-label={`Name of ${c.name}`} className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm focus:outline-none" />
              {nameOf(c).trim() !== c.name && (
                <button type="button" disabled={busy || !nameOf(c).trim()} onClick={() => act(() => send(`/api/admin/services/categories/${c.id}`, "PATCH", { name: nameOf(c) }))} aria-label={`Save name for ${c.name}`} className="p-1 text-gold">
                  <Check size={15} aria-hidden />
                </button>
              )}
              <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${c.name} up`} className="p-1 text-muted hover:text-foreground disabled:opacity-30">
                <ArrowUp size={14} aria-hidden />
              </button>
              <button type="button" disabled={busy || i === categories.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${c.name} down`} className="p-1 text-muted hover:text-foreground disabled:opacity-30">
                <ArrowDown size={14} aria-hidden />
              </button>
              <button type="button" disabled={busy} onClick={() => act(() => send(`/api/admin/services/categories/${c.id}`, "PATCH", { isActive: !c.is_active }))} className="whitespace-nowrap px-1 text-xs text-muted hover:text-foreground" aria-label={`${c.is_active ? "Turn off" : "Turn on"} ${c.name}`}>
                {c.is_active ? "Turn off" : "Turn on"}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim())
              act(async () => {
                await send("/api/admin/services/categories", "POST", { name: newName });
                setNewName("");
              });
          }}
        >
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category, e.g. Holiday Parties" aria-label="New category name" className={INPUT} />
          <Button type="submit" variant="primary" disabled={busy || !newName.trim()}>
            Add
          </Button>
        </form>
        {err && (
          <p role="alert" className="text-sm text-status-declined">
            {err}
          </p>
        )}
      </div>
    </SideDrawer>
  );
}
