"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { Boxes } from "lucide-react";

interface EquipmentRow {
  id: string;
  category: string;
  name: string;
  brand: string | null;
  model: string | null;
  status: string;
  quantity_owned: number;
  storage_location: string | null;
}

const CATEGORIES = ["speakers", "mixer", "microphone", "lights", "cables", "laptop"];

export default function AdminEquipmentPage() {
  const [items, setItems] = useState<EquipmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [storageLocation, setStorageLocation] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/equipment");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load equipment");
      setItems(data.equipment ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          name: name.trim(),
          brand: brand.trim() || undefined,
          quantityOwned: Number(quantity) || 1,
          storageLocation: storageLocation.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add equipment");
      setName("");
      setBrand("");
      setQuantity("1");
      setStorageLocation("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this equipment? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/equipment/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove equipment");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <>
      <PageHeader title="Manage Equipment" subtitle="Speakers, mixers, lights, and everything else in the gear closet." />
      <div className="flex flex-col gap-6 p-6">
        <GlassCard neon className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block flex-1">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="QSC K12.2 Active Speaker"
              className="w-full rounded-xl border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Brand</span>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block w-24">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Qty</span>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Storage Location</span>
            <input
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              placeholder="Main Warehouse - Shelf A3"
              className="w-full rounded-xl border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <NeonButton color="gold" onClick={handleAdd} disabled={adding} className="shrink-0">
            {adding ? "Adding..." : "+ Add Equipment"}
          </NeonButton>
        </GlassCard>

        {error && <p className="text-xs text-status-declined">{error}</p>}

        <div className="flex flex-col gap-3">
          {items === null && <p className="text-sm text-muted">Loading...</p>}
          {items?.length === 0 && <p className="text-sm text-muted">No equipment yet.</p>}
          {items?.map((item) => (
            <GlassCard key={item.id} className="flex items-center justify-between">
              <div>
                <p className="flex items-center gap-1.5 font-semibold">
                  <Boxes size={14} />
                  {item.name}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {item.category} {item.brand ? `· ${item.brand}` : ""} · qty {item.quantity_owned} · {item.status}
                  {item.storage_location ? ` · ${item.storage_location}` : ""}
                </p>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                className="rounded-full border border-status-declined/40 px-3 py-1.5 text-xs text-status-declined"
              >
                Remove
              </button>
            </GlassCard>
          ))}
        </div>
      </div>
    </>
  );
}
