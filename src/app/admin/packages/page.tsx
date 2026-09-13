"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusChip } from "@/components/ui/status-chip";
import { SideDrawer } from "@/components/ui/side-drawer";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Field } from "@/components/ui/field";
import { DraftField } from "@/components/ui/draft-field";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { cn } from "@/lib/utils";
import { PackageOpen, Sparkles, Tag, Plus, Calculator, Trash2 } from "lucide-react";
import type { CatalogItemData, DealData, PricingMethod } from "@/lib/packages/types";
import type { TemplateSummary } from "@/lib/data/package-builder";
import type { GigCondition, GigEquipmentRuleData } from "@/lib/packages/gig-calculator";

type Tab = "templates" | "catalog" | "deals" | "equipment";

const STARTER_SLUGS = [
  "Wedding — Signature",
  "Bar & Nightclub",
  "Corporate Event",
  "Private Party",
  "School & Community",
  "Holiday Event",
  "Recurring Residency",
  "Custom Performance"
];

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function AdminPackagesPage() {
  const [tab, setTab] = useState<Tab>("templates");

  return (
    <>
      <PageHeader title="Packages" subtitle="Build performance packages, pricing rules, and deals." />
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          <TabPill active={tab === "templates"} onClick={() => setTab("templates")}>
            Templates
          </TabPill>
          <TabPill active={tab === "catalog"} onClick={() => setTab("catalog")}>
            Service Catalog
          </TabPill>
          <TabPill active={tab === "deals"} onClick={() => setTab("deals")}>
            Deals
          </TabPill>
          <TabPill active={tab === "equipment"} onClick={() => setTab("equipment")}>
            Equipment Rules
          </TabPill>
        </div>

        {tab === "templates" && <TemplatesTab />}
        {tab === "catalog" && <CatalogTab />}
        {tab === "deals" && <DealsTab />}
        {tab === "equipment" && <EquipmentRulesTab />}
      </div>
    </>
  );
}

function TabPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active ? "bg-[#161616] text-white" : "bg-panel text-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// ── Templates ───────────────────────────────────────────────────────

function TemplatesTab() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);

  function load() {
    fetch("/api/admin/package-templates")
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load templates");
        setTemplates(data.templates);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }

  useEffect(load, []);

  async function createBlank() {
    const name = window.prompt("Package name");
    if (!name?.trim()) return;
    const res = await fetch("/api/admin/package-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() })
    });
    const data = await res.json();
    if (res.ok) router.push(`/admin/packages/${data.template.id}`);
    else setError(data.error);
  }

  async function createFromStarter(starterName: string) {
    setShowNewMenu(false);
    const starter = (templates ?? []).find((t) => t.name === starterName && t.is_starter);
    if (!starter) return;
    const res = await fetch("/api/admin/package-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicateFrom: starter.id, name: `${starter.name} (Copy)` })
    });
    const data = await res.json();
    if (res.ok) router.push(`/admin/packages/${data.template.id}`);
    else setError(data.error);
  }

  async function duplicate(t: TemplateSummary) {
    const res = await fetch("/api/admin/package-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicateFrom: t.id })
    });
    const data = await res.json();
    if (res.ok) load();
    else setError(data.error);
  }

  async function archive(t: TemplateSummary) {
    await fetch(`/api/admin/package-templates/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" })
    });
    load();
  }

  const columns: DataTableColumn<TemplateSummary>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (t) => t.name,
      render: (t) => (
        <div>
          <p className="font-medium">{t.name}</p>
          {t.is_starter && <span className="text-xs text-muted">Starter example</span>}
        </div>
      )
    },
    { key: "event_type", header: "Event Type", sortValue: (t) => t.event_type ?? "", render: (t) => t.event_type ?? "—", hideBelow: "sm" },
    { key: "tier", header: "Tier", sortValue: (t) => t.tier ?? "", render: (t) => (t.tier ? <span className="capitalize">{t.tier}</span> : "—"), hideBelow: "md" },
    {
      key: "status",
      header: "Status",
      sortValue: (t) => t.status,
      render: (t) => (
        <StatusChip tone={t.status === "published" ? "approved" : t.status === "archived" ? "muted" : "pending"} variant="dot">
          {t.status}
        </StatusChip>
      )
    },
    { key: "price", header: "Price", sortValue: (t) => t.base_price_cents, align: "right", render: (t) => money(t.base_price_cents), hideBelow: "sm" },
    { key: "items", header: "Items", align: "right", render: (t) => `${t.section_count} sections · ${t.line_item_count} items`, hideBelow: "lg" },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (t) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="text" size="sm" onClick={() => duplicate(t)}>
            Duplicate
          </Button>
          {t.status !== "archived" && (
            <Button variant="text" size="sm" onClick={() => archive(t)}>
              Archive
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <GlassCard className="flex flex-col gap-4">
      {error && <p className="text-sm text-status-declined">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Package templates</p>
        <div className="relative">
          <Button variant="primary" size="sm" onClick={() => setShowNewMenu((v) => !v)}>
            <Plus size={14} /> New Package
          </Button>
          {showNewMenu && (
            <>
              <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10" onClick={() => setShowNewMenu(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-[10px] border border-border bg-card py-1 shadow-lg">
                <button onClick={createBlank} className="block w-full px-3 py-2 text-left text-sm font-medium hover:bg-black/5">
                  Start blank
                </button>
                <div className="my-1 border-t border-border" />
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">From a starter template</p>
                {STARTER_SLUGS.map((s) => (
                  <button key={s} onClick={() => createFromStarter(s)} className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5">
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={templates ?? []}
        rowKey={(t) => t.id}
        onRowClick={(t) => router.push(`/admin/packages/${t.id}`)}
        searchFn={(t, q) => t.name.toLowerCase().includes(q)}
        loading={templates === null}
        emptyIcon={PackageOpen}
        emptyTitle="No packages yet"
        emptyBody="Start blank or duplicate a starter template."
      />
    </GlassCard>
  );
}

// ── Service catalog ──────────────────────────────────────────────────

const PRICING_METHOD_LABELS: Record<PricingMethod, string> = {
  fixed: "Fixed",
  hourly: "Hourly",
  per_person: "Per person",
  per_unit: "Per unit",
  per_event: "Per event",
  quote_only: "Quote only"
};

function CatalogTab() {
  const [items, setItems] = useState<CatalogItemData[] | null>(null);
  const [editing, setEditing] = useState<Partial<CatalogItemData> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/service-catalog?all=1")
      .then((r) => r.json())
      .then((data) => setItems(data.items))
      .catch(() => setError("Something went wrong."));
  }
  useEffect(load, []);

  async function save() {
    if (!editing) return;
    const isNew = !editing.id;
    const res = await fetch(isNew ? "/api/admin/service-catalog" : `/api/admin/service-catalog/${editing.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/service-catalog/${id}`, { method: "DELETE" });
    load();
  }

  const columns: DataTableColumn<CatalogItemData>[] = [
    { key: "name", header: "Name", sortValue: (i) => i.name, render: (i) => <p className="font-medium">{i.name}</p> },
    { key: "category", header: "Category", sortValue: (i) => i.category, render: (i) => <span className="capitalize">{i.category}</span>, hideBelow: "sm" },
    { key: "method", header: "Pricing", render: (i) => PRICING_METHOD_LABELS[i.pricing_method], hideBelow: "md" },
    { key: "price", header: "Default price", align: "right", sortValue: (i) => i.price_cents, render: (i) => (i.pricing_method === "quote_only" ? "Quote" : money(i.price_cents)) },
    {
      key: "visible",
      header: "Client visible",
      align: "center",
      render: (i) => <StatusChip tone={i.is_client_visible ? "approved" : "muted"} variant="dot">{i.is_client_visible ? "Visible" : "Internal"}</StatusChip>,
      hideBelow: "sm"
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (i) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="text" size="sm" onClick={() => setEditing(i)}>
            Edit
          </Button>
          <Button variant="text" size="sm" onClick={() => remove(i.id)}>
            Delete
          </Button>
        </div>
      )
    }
  ];

  return (
    <GlassCard className="flex flex-col gap-4">
      {error && <p className="text-sm text-status-declined">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Reusable service catalog</p>
          <p className="text-xs text-muted">Shared service types every DJ can offer — each DJ sets their own actual price under their profile&rsquo;s Services & Pricing.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setEditing({ pricing_method: "fixed", is_client_visible: true, is_active: true, category: "other" })}>
          <Plus size={14} /> Add item
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={items ?? []}
        rowKey={(i) => i.id}
        searchFn={(i, q) => i.name.toLowerCase().includes(q)}
        loading={items === null}
        emptyIcon={Sparkles}
        emptyTitle="No catalog items yet"
        emptyBody="Add DJ performance, MC services, lighting, and other reusable services here."
      />

      <SideDrawer open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit service" : "Add service"}>
        {editing && (
          <div className="flex flex-col gap-3">
            <Field label="Name" value={editing.name ?? ""} onChange={(v) => setEditing({ ...editing, name: v })} />
            <Field label="Description" value={editing.description ?? ""} onChange={(v) => setEditing({ ...editing, description: v })} />
            <Field label="Category" value={editing.category ?? ""} onChange={(v) => setEditing({ ...editing, category: v })} placeholder="performance, sound, lighting, staffing, logistics, other" />
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Pricing method</span>
              <select
                value={editing.pricing_method ?? "fixed"}
                onChange={(e) => setEditing({ ...editing, pricing_method: e.target.value as PricingMethod })}
                className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                {Object.entries(PRICING_METHOD_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <DraftField
              label="Default price (USD) — each DJ can set their own"
              type="number"
              value={editing.price_cents != null ? String(editing.price_cents / 100) : ""}
              onCommit={(v) => setEditing({ ...editing, price_cents: Math.round(parseFloat(v || "0") * 100) })}
            />
            <Field label="Unit label" value={editing.unit_label ?? ""} onChange={(v) => setEditing({ ...editing, unit_label: v })} placeholder="hour, guest, speaker..." />
            <DraftField
              label="Internal cost (USD, staff only)"
              type="number"
              value={editing.internal_cost_cents != null ? String(editing.internal_cost_cents / 100) : ""}
              onCommit={(v) => setEditing({ ...editing, internal_cost_cents: v ? Math.round(parseFloat(v) * 100) : null })}
            />
            <div className="grid grid-cols-2 gap-3">
              <DraftField
                label="Min quantity"
                type="number"
                value={editing.min_quantity != null ? String(editing.min_quantity) : ""}
                onCommit={(v) => setEditing({ ...editing, min_quantity: v ? parseInt(v, 10) : null })}
              />
              <DraftField
                label="Max quantity"
                type="number"
                value={editing.max_quantity != null ? String(editing.max_quantity) : ""}
                onCommit={(v) => setEditing({ ...editing, max_quantity: v ? parseInt(v, 10) : null })}
              />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-[10px] bg-panel px-3 py-2">
              <span className="text-sm">Visible to clients</span>
              <ToggleSwitch checked={editing.is_client_visible ?? true} onChange={(v) => setEditing({ ...editing, is_client_visible: v })} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-[10px] bg-panel px-3 py-2">
              <span className="text-sm">Active</span>
              <ToggleSwitch checked={editing.is_active ?? true} onChange={(v) => setEditing({ ...editing, is_active: v })} />
            </label>
            <Button variant="primary" onClick={save} className="mt-2">
              Save
            </Button>
          </div>
        )}
      </SideDrawer>
    </GlassCard>
  );
}

// ── Deals ─────────────────────────────────────────────────────────────

const DEAL_TYPE_LABELS: Record<string, string> = {
  percent: "Percentage discount",
  fixed: "Fixed-amount discount",
  bundle: "Bundle pricing",
  complimentary_upgrade: "Complimentary upgrade",
  early_booking: "Early-booking offer",
  last_minute: "Last-minute offer",
  loyalty: "Loyalty deal",
  referral: "Referral code",
  multi_event: "Multi-event discount"
};

function DealsTab() {
  const [deals, setDeals] = useState<DealData[] | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [eligibility, setEligibility] = useState<{ deal_id: string; package_template_id: string | null }[]>([]);
  const [editing, setEditing] = useState<Partial<DealData> | null>(null);
  const [editingEligible, setEditingEligible] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<DealData | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/deals")
      .then((r) => r.json())
      .then((data) => {
        setDeals(data.deals);
        setEligibility(data.eligibility ?? []);
      })
      .catch(() => setError("Something went wrong."));
    fetch("/api/admin/package-templates")
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates ?? []));
  }
  useEffect(load, []);

  function openEdit(d: Partial<DealData> | null) {
    setEditing(d ?? { deal_type: "percent", is_public: true, is_stackable: false, status: "draft", blackout_dates: [] });
    setEditingEligible(new Set(eligibility.filter((e) => e.deal_id === d?.id).map((e) => e.package_template_id!).filter(Boolean)));
  }

  async function save() {
    if (!editing) return;
    const isNew = !editing.id;
    const payload = {
      name: editing.name,
      description: editing.description,
      dealType: editing.deal_type,
      value: editing.value,
      code: editing.code,
      startsAt: editing.starts_at,
      endsAt: editing.ends_at,
      eligibleEventStart: editing.eligible_event_start,
      eligibleEventEnd: editing.eligible_event_end,
      blackoutDates: editing.blackout_dates,
      minSpendCents: editing.min_spend_cents,
      usageLimit: editing.usage_limit,
      maxDiscountCents: editing.max_discount_cents,
      isPublic: editing.is_public,
      isStackable: editing.is_stackable,
      status: editing.status
    };
    const res = await fetch(isNew ? "/api/admin/deals" : `/api/admin/deals/${editing.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    const dealId = data.deal.id;
    await fetch(`/api/admin/deals/${dealId}/eligibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageTemplateIds: Array.from(editingEligible) })
    });
    setEditing(null);
    load();
  }

  async function remove(d: DealData) {
    await fetch(`/api/admin/deals/${d.id}`, { method: "DELETE" });
    setPendingDelete(null);
    load();
  }

  function toggleEligible(id: string) {
    setEditingEligible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const columns: DataTableColumn<DealData>[] = [
    { key: "name", header: "Name", sortValue: (d) => d.name, render: (d) => <p className="font-medium">{d.name}</p> },
    { key: "type", header: "Type", render: (d) => DEAL_TYPE_LABELS[d.deal_type], hideBelow: "sm" },
    {
      key: "value",
      header: "Value",
      align: "right",
      render: (d) => (d.value == null ? "—" : ["percent", "early_booking", "last_minute", "loyalty", "referral", "multi_event"].includes(d.deal_type) ? `${d.value}%` : money(d.value)),
      hideBelow: "sm"
    },
    { key: "code", header: "Code", render: (d) => d.code ?? "—", hideBelow: "md" },
    {
      key: "status",
      header: "Status",
      sortValue: (d) => d.status,
      render: (d) => (
        <StatusChip tone={d.status === "active" ? "approved" : d.status === "expired" ? "declined" : d.status === "archived" ? "muted" : "pending"} variant="dot">
          {d.status}
        </StatusChip>
      )
    },
    { key: "public", header: "Visibility", render: (d) => (d.is_public ? "Public" : "Private"), hideBelow: "lg" },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (d) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="text" size="sm" onClick={() => openEdit(d)}>
            Edit
          </Button>
          <Button variant="text" size="sm" onClick={() => setPendingDelete(d)}>
            Delete
          </Button>
        </div>
      )
    }
  ];

  return (
    <GlassCard className="flex flex-col gap-4">
      {error && <p className="text-sm text-status-declined">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Deals & promotions</p>
        <Button variant="primary" size="sm" onClick={() => openEdit(null)}>
          <Plus size={14} /> Add deal
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={deals ?? []}
        rowKey={(d) => d.id}
        searchFn={(d, q) => d.name.toLowerCase().includes(q)}
        loading={deals === null}
        emptyIcon={Tag}
        emptyTitle="No deals yet"
        emptyBody="Percentage/fixed discounts, early-booking, referral codes, and more."
      />

      <SideDrawer open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit deal" : "Add deal"}>
        {editing && (
          <div className="flex flex-col gap-3">
            <Field label="Name" value={editing.name ?? ""} onChange={(v) => setEditing({ ...editing, name: v })} />
            <Field label="Description" value={editing.description ?? ""} onChange={(v) => setEditing({ ...editing, description: v })} />
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Deal type</span>
              <select
                value={editing.deal_type ?? "percent"}
                onChange={(e) => setEditing({ ...editing, deal_type: e.target.value as DealData["deal_type"] })}
                className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                {Object.entries(DEAL_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <DraftField
              label={["percent", "early_booking", "last_minute", "loyalty", "referral", "multi_event"].includes(editing.deal_type ?? "") ? "Value (%)" : "Value (USD)"}
              type="number"
              value={editing.value != null ? String(editing.value) : ""}
              onCommit={(v) => setEditing({ ...editing, value: v ? parseFloat(v) : null })}
            />
            <Field label="Promo / referral code (optional)" value={editing.code ?? ""} onChange={(v) => setEditing({ ...editing, code: v || null })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts" type="date" value={editing.starts_at?.slice(0, 10) ?? ""} onChange={(v) => setEditing({ ...editing, starts_at: v || null })} />
              <Field label="Ends" type="date" value={editing.ends_at?.slice(0, 10) ?? ""} onChange={(v) => setEditing({ ...editing, ends_at: v || null })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Eligible event start" type="date" value={editing.eligible_event_start ?? ""} onChange={(v) => setEditing({ ...editing, eligible_event_start: v || null })} />
              <Field label="Eligible event end" type="date" value={editing.eligible_event_end ?? ""} onChange={(v) => setEditing({ ...editing, eligible_event_end: v || null })} />
            </div>
            <DraftField
              label="Minimum spend (USD)"
              type="number"
              value={editing.min_spend_cents != null ? String(editing.min_spend_cents / 100) : ""}
              onCommit={(v) => setEditing({ ...editing, min_spend_cents: v ? Math.round(parseFloat(v) * 100) : null })}
            />
            <div className="grid grid-cols-2 gap-3">
              <DraftField
                label="Usage limit"
                type="number"
                value={editing.usage_limit != null ? String(editing.usage_limit) : ""}
                onCommit={(v) => setEditing({ ...editing, usage_limit: v ? parseInt(v, 10) : null })}
              />
              <DraftField
                label="Max discount (USD)"
                type="number"
                value={editing.max_discount_cents != null ? String(editing.max_discount_cents / 100) : ""}
                onCommit={(v) => setEditing({ ...editing, max_discount_cents: v ? Math.round(parseFloat(v) * 100) : null })}
              />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-[10px] bg-panel px-3 py-2">
              <span className="text-sm">Public (client-visible)</span>
              <ToggleSwitch checked={editing.is_public ?? true} onChange={(v) => setEditing({ ...editing, is_public: v })} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-[10px] bg-panel px-3 py-2">
              <span className="text-sm">Stackable with other deals</span>
              <ToggleSwitch checked={editing.is_stackable ?? false} onChange={(v) => setEditing({ ...editing, is_stackable: v })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Status</span>
              <select
                value={editing.status ?? "draft"}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as DealData["status"] })}
                className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            <div>
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Eligible packages (blank = public deals apply everywhere)</span>
              <div className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-panel p-2">
                {templates.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                    <input type="checkbox" checked={editingEligible.has(t.id)} onChange={() => toggleEligible(t.id)} />
                    {t.name}
                  </label>
                ))}
              </div>
            </div>

            <Button variant="primary" onClick={save} className="mt-2">
              Save
            </Button>
          </div>
        )}
      </SideDrawer>

      <ConfirmModal
        open={!!pendingDelete}
        title={pendingDelete ? `Delete "${pendingDelete.name}"?` : ""}
        body="This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </GlassCard>
  );
}

// ── Equipment Rules (gig calculator) ────────────────────────────────

const CONDITION_FIELD_OPTIONS = [
  { source: "event" as const, field: "guest_count", label: "Guest count" },
  { source: "event" as const, field: "event_type", label: "Event type" },
  { source: "event" as const, field: "hours_booked", label: "Hours booked" },
  { source: "answer" as const, field: "ceremony_audio", label: "Answer: ceremony_audio" },
  { source: "answer" as const, field: "cocktail_hour", label: "Answer: cocktail_hour" }
];

function emptyRule(): Partial<GigEquipmentRuleData> {
  return { label: "", conditions: [{ source: "event", field: "guest_count", op: "gte", value: 150 }], quantity: 1, is_active: true };
}

function EquipmentRulesTab() {
  const [rules, setRules] = useState<GigEquipmentRuleData[] | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItemData[]>([]);
  const [editing, setEditing] = useState<Partial<GigEquipmentRuleData> | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GigEquipmentRuleData | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/gig-equipment-rules")
      .then((r) => {
        if (r.status === 403) {
          setForbidden(true);
          return { rules: [] };
        }
        return r.json();
      })
      .then((data) => setRules(data.rules ?? []))
      .catch(() => setError("Something went wrong."));
    fetch("/api/admin/service-catalog?all=1")
      .then((r) => r.json())
      .then((d) => setCatalogItems(d.items ?? []))
      .catch(() => {});
  }
  useEffect(load, []);

  function catalogName(id: string) {
    return catalogItems.find((c) => c.id === id)?.name ?? "Item";
  }

  async function save() {
    if (!editing) return;
    const isNew = !editing.id;
    const payload = {
      label: editing.label,
      conditions: editing.conditions,
      catalogItemId: editing.catalog_item_id,
      quantity: editing.quantity,
      reason: editing.reason,
      isActive: editing.is_active
    };
    const res = await fetch(isNew ? "/api/admin/gig-equipment-rules" : `/api/admin/gig-equipment-rules/${editing.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setEditing(null);
    load();
  }

  async function remove(rule: GigEquipmentRuleData) {
    await fetch(`/api/admin/gig-equipment-rules/${rule.id}`, { method: "DELETE" });
    setPendingDelete(null);
    load();
  }

  function updateCondition(idx: number, updates: Partial<GigCondition>) {
    if (!editing) return;
    const conditions = [...(editing.conditions ?? [])];
    conditions[idx] = { ...conditions[idx], ...updates };
    setEditing({ ...editing, conditions });
  }
  function addCondition() {
    if (!editing) return;
    setEditing({ ...editing, conditions: [...(editing.conditions ?? []), { source: "event", field: "guest_count", op: "gte", value: 0 }] });
  }
  function removeCondition(idx: number) {
    if (!editing) return;
    setEditing({ ...editing, conditions: (editing.conditions ?? []).filter((_, i) => i !== idx) });
  }

  if (forbidden) {
    return (
      <GlassCard className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Equipment Rules</p>
        <p className="text-sm text-muted">Owner/admin only — these rules set locked equipment minimums, so editing them is restricted.</p>
      </GlassCard>
    );
  }

  const columns: DataTableColumn<GigEquipmentRuleData>[] = [
    { key: "label", header: "Rule", sortValue: (r) => r.label, render: (r) => <p className="font-medium">{r.label}</p> },
    { key: "item", header: "Recommends", render: (r) => `${catalogName(r.catalog_item_id)} × ${r.quantity}`, hideBelow: "sm" },
    {
      key: "active",
      header: "Status",
      render: (r) => (
        <StatusChip tone={r.is_active ? "approved" : "muted"} variant="dot">
          {r.is_active ? "Active" : "Inactive"}
        </StatusChip>
      )
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="text" size="sm" onClick={() => setEditing(r)}>
            Edit
          </Button>
          <Button variant="text" size="sm" onClick={() => setPendingDelete(r)}>
            Delete
          </Button>
        </div>
      )
    }
  ];

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Gig equipment calculator rules</p>
          <p className="text-xs text-muted">
            &ldquo;When [condition], recommend [item] × [qty].&rdquo; These become locked minimums on a gig&rsquo;s package — DJs can add more equipment but can&rsquo;t go below what a rule requires.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setEditing(emptyRule())} disabled={catalogItems.length === 0}>
          <Calculator size={14} /> Add rule
        </Button>
      </div>

      {error && <p className="text-sm text-status-declined">{error}</p>}
      {catalogItems.length === 0 && rules !== null && (
        <p className="rounded-[10px] border border-dashed border-gold/40 bg-gold/5 px-3 py-2 text-xs text-gold">
          Add at least one item to the Service Catalog tab first — a rule needs something to recommend.
        </p>
      )}

      <DataTable
        columns={columns}
        rows={rules ?? []}
        rowKey={(r) => r.id}
        loading={rules === null}
        emptyIcon={Calculator}
        emptyTitle="No equipment rules yet"
        emptyBody="e.g. 150+ guests → 2 additional speakers; ceremony_audio = yes → wireless mic."
      />

      <SideDrawer open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit rule" : "Add rule"}>
        {editing && (
          <div className="flex flex-col gap-3">
            <Field label="Label" value={editing.label ?? ""} onChange={(v) => setEditing({ ...editing, label: v })} placeholder='e.g. "150+ guests needs extra sound"' />

            <div>
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Conditions (all must match)</span>
              <div className="flex flex-col gap-2">
                {(editing.conditions ?? []).map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-[10px] border border-border bg-panel p-2">
                    <select
                      value={`${c.source}:${c.field}`}
                      onChange={(e) => {
                        const opt = CONDITION_FIELD_OPTIONS.find((o) => `${o.source}:${o.field}` === e.target.value)!;
                        updateCondition(i, { source: opt.source, field: opt.field });
                      }}
                      className="min-w-0 flex-1 rounded-[10px] border border-black/10 bg-card px-2 py-1.5 text-xs focus:border-gold focus:outline-none"
                    >
                      {CONDITION_FIELD_OPTIONS.map((o) => (
                        <option key={`${o.source}:${o.field}`} value={`${o.source}:${o.field}`}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={c.op}
                      onChange={(e) => updateCondition(i, { op: e.target.value as GigCondition["op"] })}
                      className="rounded-[10px] border border-black/10 bg-card px-2 py-1.5 text-xs focus:border-gold focus:outline-none"
                    >
                      <option value="gte">≥</option>
                      <option value="lte">≤</option>
                      <option value="gt">&gt;</option>
                      <option value="lt">&lt;</option>
                      <option value="eq">=</option>
                      <option value="ne">≠</option>
                    </select>
                    <input
                      value={String(c.value)}
                      onChange={(e) => updateCondition(i, { value: e.target.value })}
                      className="w-20 rounded-[10px] border border-black/10 bg-card px-2 py-1.5 text-xs focus:border-gold focus:outline-none"
                    />
                    <button onClick={() => removeCondition(i)} className="p-1 text-muted hover:text-status-declined">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addCondition} className="mt-2 flex items-center gap-1 text-xs font-medium text-muted hover:text-gold">
                <Plus size={12} /> Add condition
              </button>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Recommend</span>
              <select
                value={editing.catalog_item_id ?? ""}
                onChange={(e) => setEditing({ ...editing, catalog_item_id: e.target.value })}
                className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                <option value="">Choose item…</option>
                {catalogItems.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <DraftField label="Quantity" type="number" value={String(editing.quantity ?? 1)} onCommit={(v) => setEditing({ ...editing, quantity: parseInt(v || "1", 10) })} />
            <Field label="Reason shown to staff/DJ (optional)" value={editing.reason ?? ""} onChange={(v) => setEditing({ ...editing, reason: v || null })} />

            <label className="flex items-center justify-between gap-3 rounded-[10px] bg-panel px-3 py-2">
              <span className="text-sm">Active</span>
              <ToggleSwitch checked={editing.is_active ?? true} onChange={(v) => setEditing({ ...editing, is_active: v })} />
            </label>

            <Button variant="primary" onClick={save} className="mt-2" disabled={!editing.label?.trim() || !editing.catalog_item_id}>
              Save
            </Button>
            {(!editing.label?.trim() || !editing.catalog_item_id) && (
              <p className="text-xs text-muted">
                {!editing.label?.trim() ? "Give this rule a label." : "Choose which item it recommends."}
              </p>
            )}
          </div>
        )}
      </SideDrawer>

      <ConfirmModal
        open={!!pendingDelete}
        title={pendingDelete ? `Delete "${pendingDelete.label}"?` : ""}
        body="This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </GlassCard>
  );
}
