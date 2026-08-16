"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Plus, X, Boxes } from "lucide-react";

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
  const [showCreate, setShowCreate] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new") === "1"
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/equipment/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove equipment");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Equipment"
        subtitle="Speakers, mixers, lights, and everything else in the gear closet."
        action={
          <Button variant="primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? <X size={15} /> : <Plus size={15} />}
            {showCreate ? "Cancel" : "New Item"}
          </Button>
        }
      />
      <div className="flex flex-col gap-4 p-6">
        {showCreate && (
          <div className="border border-border p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <div className="lg:col-span-2">
                <Field label="Name" value={name} onChange={setName} placeholder="QSC K12.2 Active Speaker" />
              </div>
              <Field label="Brand" value={brand} onChange={setBrand} />
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Qty</span>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
              </label>
              <div className="sm:col-span-2 lg:col-span-2">
                <Field label="Storage Location" value={storageLocation} onChange={setStorageLocation} placeholder="Main Warehouse - Shelf A3" />
              </div>
            </div>
            {error && <p className="mt-3 text-xs text-status-declined">{error}</p>}
            <div className="mt-4">
              <Button variant="primary" onClick={handleAdd} disabled={adding}>
                {adding ? "Adding…" : "Add Equipment"}
              </Button>
            </div>
          </div>
        )}

        <DataTable
          columns={equipmentColumns(setPendingDeleteId)}
          rows={items ?? []}
          rowKey={(item) => item.id}
          loading={items === null}
          searchFn={(item, q) => item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || (item.brand ?? "").toLowerCase().includes(q)}
          searchPlaceholder="Search equipment…"
          emptyIcon={Boxes}
          emptyTitle="No equipment yet"
          emptyBody="Add your first piece of gear."
        />
      </div>

      <ConfirmModal
        open={!!pendingDeleteId}
        title="Remove this equipment?"
        body="This cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => pendingDeleteId && handleDelete(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}

function equipmentColumns(onDelete: (id: string) => void): DataTableColumn<EquipmentRow>[] {
  return [
    { key: "name", header: "Name", sortValue: (i) => i.name, render: (i) => <span className="font-medium">{i.name}</span> },
    { key: "category", header: "Category", sortValue: (i) => i.category, render: (i) => <span className="capitalize text-muted">{i.category}</span> },
    { key: "brand", header: "Brand", hideBelow: "md", render: (i) => <span className="text-muted">{i.brand ?? "—"}</span> },
    { key: "qty", header: "Qty", sortValue: (i) => i.quantity_owned, render: (i) => <span className="tabular-nums">{i.quantity_owned}</span> },
    { key: "status", header: "Status", hideBelow: "md", render: (i) => <span className="capitalize text-muted">{i.status}</span> },
    { key: "location", header: "Location", hideBelow: "lg", render: (i) => <span className="text-muted">{i.storage_location ?? "—"}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (i) => (
        <button onClick={() => onDelete(i.id)} className="text-xs text-status-declined hover:underline">
          Remove
        </button>
      )
    }
  ];
}
