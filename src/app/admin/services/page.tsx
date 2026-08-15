"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, X } from "lucide-react";

interface PackageRow {
  id: string;
  name: string;
  description: string;
  price: number;
  hours: number | null;
  features: string[];
  is_active: boolean;
}

interface AddonRow {
  id: string;
  name: string;
  description: string;
  price: number;
  is_active: boolean;
}

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const inputClass = "w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none";
const labelClass = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted";

export default function AdminServicesPage() {
  const [packages, setPackages] = useState<PackageRow[] | null>(null);
  const [addons, setAddons] = useState<AddonRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/packages?all=1")
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => setPackages(ok ? data.packages : []))
      .catch(() => setPackages([]));
    fetch("/api/admin/packages/addons?all=1")
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => setAddons(ok ? data.addons : []))
      .catch(() => setAddons([]));
  }

  useEffect(load, []);

  return (
    <>
      <PageHeader title="Services" subtitle="Your bookable packages and add-ons." />
      <div className="flex flex-col gap-8 p-6">
        {error && <p className="text-sm text-status-declined">{error}</p>}

        <PackagesSection packages={packages} onChange={setPackages} onError={setError} />
        <AddonsSection addons={addons} onChange={setAddons} onError={setError} />
      </div>
    </>
  );
}

function PackagesSection({
  packages,
  onChange,
  onError
}: {
  packages: PackageRow[] | null;
  onChange: (p: PackageRow[]) => void;
  onError: (e: string | null) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleCreate(input: { name: string; description: string; price: number; hours: number | null; features: string[] }) {
    onError(null);
    try {
      const res = await fetch("/api/admin/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, position: packages?.length ?? 0 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onChange([...(packages ?? []), data.package]);
      setShowAdd(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleUpdate(id: string, input: { name: string; description: string; price: number; hours: number | null; features: string[] }) {
    onError(null);
    try {
      const res = await fetch(`/api/admin/packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onChange((packages ?? []).map((p) => (p.id === id ? data.package : p)));
      setEditingId(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleToggleActive(pkg: PackageRow) {
    onChange((packages ?? []).map((p) => (p.id === pkg.id ? { ...p, is_active: !p.is_active } : p)));
    await fetch(`/api/admin/packages/${pkg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !pkg.is_active })
    });
  }

  async function handleDelete(id: string) {
    onChange((packages ?? []).filter((p) => p.id !== id));
    await fetch(`/api/admin/packages/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Packages</p>
          <p className="text-xs text-muted">
            All packages include two pre-event planning consultations, high-end speakers, bass subwoofers, and wireless microphones.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? <X size={13} /> : <Plus size={13} />} {showAdd ? "Cancel" : "Add Package"}
        </Button>
      </div>

      {showAdd && <PackageForm onSave={handleCreate} onCancel={() => setShowAdd(false)} />}

      {packages === null ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {packages.map((pkg) =>
            editingId === pkg.id ? (
              <div key={pkg.id} className="sm:col-span-3">
                <PackageForm
                  initial={pkg}
                  onSave={(input) => handleUpdate(pkg.id, input)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <GlassCard key={pkg.id} className={cn("flex flex-col gap-2", !pkg.is_active && "opacity-50")}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{pkg.name}</p>
                  <p className="shrink-0 text-lg font-bold text-gold">{money(pkg.price)}</p>
                </div>
                {pkg.hours != null && <p className="text-xs text-muted">{pkg.hours} hours</p>}
                <p className="text-xs text-muted">{pkg.description}</p>
                {pkg.features.length > 0 && (
                  <ul className="flex flex-col gap-1 text-xs">
                    {pkg.features.map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex items-center gap-3 border-t border-border pt-2 text-xs">
                  <button onClick={() => setEditingId(pkg.id)} className="flex items-center gap-1 text-gold hover:underline">
                    <Pencil size={11} /> Edit
                  </button>
                  <button onClick={() => handleToggleActive(pkg)} className="text-muted hover:underline">
                    {pkg.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => handleDelete(pkg.id)} className="flex items-center gap-1 text-status-declined hover:underline">
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </GlassCard>
            )
          )}
        </div>
      )}
    </div>
  );
}

function PackageForm({
  initial,
  onSave,
  onCancel
}: {
  initial?: PackageRow;
  onSave: (input: { name: string; description: string; price: number; hours: number | null; features: string[] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [hours, setHours] = useState(initial?.hours != null ? String(initial.hours) : "");
  const [features, setFeatures] = useState(initial?.features.join("\n") ?? "");

  function submit() {
    if (!name.trim() || !description.trim() || !price.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      hours: hours.trim() ? Number(hours) : null,
      features: features
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean)
    });
  }

  return (
    <GlassCard className="mb-4 flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Price ($)</span>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Hours (optional)</span>
          <input type="number" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={cn(inputClass, "min-h-[70px]")} />
      </label>
      <label className="block">
        <span className={labelClass}>Features (one per line)</span>
        <textarea value={features} onChange={(e) => setFeatures(e.target.value)} className={cn(inputClass, "min-h-[90px]")} />
      </label>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={submit} className="w-fit">
          Save
        </Button>
        <button onClick={onCancel} className="text-xs text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
    </GlassCard>
  );
}

function AddonsSection({
  addons,
  onChange,
  onError
}: {
  addons: AddonRow[] | null;
  onChange: (a: AddonRow[]) => void;
  onError: (e: string | null) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleCreate(input: { name: string; description: string; price: number }) {
    onError(null);
    try {
      const res = await fetch("/api/admin/packages/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, position: addons?.length ?? 0 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onChange([...(addons ?? []), data.addon]);
      setShowAdd(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleUpdate(id: string, input: { name: string; description: string; price: number }) {
    onError(null);
    try {
      const res = await fetch(`/api/admin/packages/addons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onChange((addons ?? []).map((a) => (a.id === id ? data.addon : a)));
      setEditingId(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleToggleActive(addon: AddonRow) {
    onChange((addons ?? []).map((a) => (a.id === addon.id ? { ...a, is_active: !a.is_active } : a)));
    await fetch(`/api/admin/packages/addons/${addon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !addon.is_active })
    });
  }

  async function handleDelete(id: string) {
    onChange((addons ?? []).filter((a) => a.id !== id));
    await fetch(`/api/admin/packages/addons/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Add-Ons</p>
        <Button variant="primary" size="sm" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? <X size={13} /> : <Plus size={13} />} {showAdd ? "Cancel" : "Add Add-On"}
        </Button>
      </div>

      {showAdd && <AddonForm onSave={handleCreate} onCancel={() => setShowAdd(false)} />}

      {addons === null ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : (
        <div className="flex flex-col divide-y divide-border border-y border-border">
          {addons.map((addon) =>
            editingId === addon.id ? (
              <div key={addon.id} className="py-3">
                <AddonForm initial={addon} onSave={(input) => handleUpdate(addon.id, input)} onCancel={() => setEditingId(null)} />
              </div>
            ) : (
              <div key={addon.id} className={cn("flex items-center justify-between gap-3 py-3", !addon.is_active && "opacity-50")}>
                <div>
                  <p className="text-sm font-medium">{addon.name}</p>
                  <p className="text-xs text-muted">{addon.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  <span className="font-semibold text-gold">{money(addon.price)}</span>
                  <button onClick={() => setEditingId(addon.id)} className="text-gold hover:underline">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => handleToggleActive(addon)} className="text-muted hover:underline">
                    {addon.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => handleDelete(addon.id)} className="text-status-declined hover:underline">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function AddonForm({
  initial,
  onSave,
  onCancel
}: {
  initial?: AddonRow;
  onSave: (input: { name: string; description: string; price: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");

  function submit() {
    if (!name.trim() || !description.trim() || !price.trim()) return;
    onSave({ name: name.trim(), description: description.trim(), price: Number(price) });
  }

  return (
    <GlassCard className="mb-4 flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className={labelClass}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Price ($)</span>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={cn(inputClass, "min-h-[60px]")} />
      </label>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={submit} className="w-fit">
          Save
        </Button>
        <button onClick={onCancel} className="text-xs text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
    </GlassCard>
  );
}
