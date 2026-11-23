"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { FieldGroup, FieldRow, INPUT, PageShell, SectionCard } from "@/components/layout/grid";
import { Button } from "@/components/ui/button";
import { SideDrawer } from "@/components/ui/side-drawer";
import { ActionMenu } from "@/components/ui/action-menu";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Plus, X, Boxes, PenLine, Trash2 } from "lucide-react";
import { EquipmentSetupRules } from "@/components/admin/equipment-setup-rules";

interface EquipmentRow {
  id: string;
  category: string;
  name: string;
  brand: string | null;
  model: string | null;
  status: string;
  condition?: string | null;
  quantity_owned: number;
  storage_location: string | null;
  notes?: string | null;
}

/** Suggested categories; any other one can be typed (e.g. "controller" for a Rev 7). */
const CATEGORIES = ["speakers", "subwoofers", "mixer", "controller", "microphone", "lights", "cables", "laptop", "stands", "cases"];
const STATUSES = [
  { v: "available", l: "Available" },
  { v: "in_use", l: "In use" },
  { v: "maintenance", l: "In for repair" },
  { v: "retired", l: "Retired" }
];
const CONDITIONS = ["excellent", "good", "fair", "poor"];
const nice = (s: string) => s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

type ItemDraft = { name: string; category: string; brand: string; model: string; quantity: string; status: string; condition: string; storageLocation: string; notes: string };
const EMPTY: ItemDraft = { name: "", category: "", brand: "", model: "", quantity: "1", status: "available", condition: "excellent", storageLocation: "", notes: "" };
const toDraft = (i: EquipmentRow): ItemDraft => ({ name: i.name, category: i.category, brand: i.brand ?? "", model: i.model ?? "", quantity: String(i.quantity_owned), status: i.status, condition: i.condition ?? "excellent", storageLocation: i.storage_location ?? "", notes: i.notes ?? "" });

/** The fields of one item: the same form adds a new item and edits one. */
function ItemFields({ d, set, categories, idPrefix, full }: { d: ItemDraft; set: (p: Partial<ItemDraft>) => void; categories: string[]; idPrefix: string; full?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <FieldRow>
        <FieldGroup label="Name" htmlFor={`${idPrefix}-name`} hint="What you call it, e.g. Rev 7 controller">
          <input id={`${idPrefix}-name`} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Rev 7 controller" className={INPUT} required />
        </FieldGroup>
        <FieldGroup label="Category" htmlFor={`${idPrefix}-cat`} hint="Pick one or type a new one">
          <input id={`${idPrefix}-cat`} list={`${idPrefix}-cats`} value={d.category} onChange={(e) => set({ category: e.target.value })} placeholder="controller" className={INPUT} required />
          <datalist id={`${idPrefix}-cats`}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </FieldGroup>
      </FieldRow>
      <FieldRow cols={3}>
        <FieldGroup label="Brand" htmlFor={`${idPrefix}-brand`}>
          <input id={`${idPrefix}-brand`} value={d.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="Pioneer DJ" className={INPUT} />
        </FieldGroup>
        <FieldGroup label="Model" htmlFor={`${idPrefix}-model`}>
          <input id={`${idPrefix}-model`} value={d.model} onChange={(e) => set({ model: e.target.value })} placeholder="DJ-REV7" className={INPUT} />
        </FieldGroup>
        <FieldGroup label="Quantity" htmlFor={`${idPrefix}-qty`} size="short">
          <input id={`${idPrefix}-qty`} type="number" min={0} inputMode="numeric" value={d.quantity} onChange={(e) => set({ quantity: e.target.value })} className={INPUT} />
        </FieldGroup>
      </FieldRow>
      <FieldRow cols={full ? 3 : 2}>
        {full && (
          <FieldGroup label="Status" htmlFor={`${idPrefix}-status`}>
            <select id={`${idPrefix}-status`} value={d.status} onChange={(e) => set({ status: e.target.value })} className={INPUT}>
              {STATUSES.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </FieldGroup>
        )}
        {full && (
          <FieldGroup label="Condition" htmlFor={`${idPrefix}-cond`}>
            <select id={`${idPrefix}-cond`} value={d.condition} onChange={(e) => set({ condition: e.target.value })} className={INPUT}>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {nice(c)}
                </option>
              ))}
            </select>
          </FieldGroup>
        )}
        <FieldGroup label="Storage location" htmlFor={`${idPrefix}-loc`}>
          <input id={`${idPrefix}-loc`} value={d.storageLocation} onChange={(e) => set({ storageLocation: e.target.value })} placeholder="Main Warehouse - Shelf A3" className={INPUT} />
        </FieldGroup>
      </FieldRow>
      {full && (
        <FieldGroup label="Notes" htmlFor={`${idPrefix}-notes`}>
          <textarea id={`${idPrefix}-notes`} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Serial number, what's in the case, quirks…" className={`${INPUT} min-h-[80px] resize-y`} />
        </FieldGroup>
      )}
    </div>
  );
}

export default function AdminEquipmentPage() {
  const [items, setItems] = useState<EquipmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ItemDraft>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; d: ItemDraft } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  const categories = [...new Set([...CATEGORIES, ...(items ?? []).map((i) => i.category.toLowerCase())])].sort();

  async function handleAdd() {
    if (!draft.name.trim() || !draft.category.trim()) {
      setError("Give the item a name and a category.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: draft.category.trim().toLowerCase(),
          name: draft.name.trim(),
          brand: draft.brand.trim() || undefined,
          model: draft.model.trim() || undefined,
          quantityOwned: Math.max(0, Math.round(Number(draft.quantity))) || 1,
          storageLocation: draft.storageLocation.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add equipment");
      setNotice(`Added ${draft.name.trim()}.`);
      setDraft(EMPTY);
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    const d = editing.d;
    if (!d.name.trim() || !d.category.trim()) {
      setEditError("An item needs a name and a category.");
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/equipment/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.name,
          category: d.category.trim().toLowerCase(),
          brand: d.brand,
          model: d.model,
          quantity_owned: Math.max(0, Math.round(Number(d.quantity) || 0)),
          status: d.status,
          condition: d.condition,
          storage_location: d.storageLocation,
          notes: d.notes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      setNotice(`Saved ${d.name.trim()}.`);
      setEditing(null);
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingEdit(false);
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
          <Button variant="primary" onClick={() => setShowCreate((v) => !v)} data-tour="equipment-new-item">
            {showCreate ? <X size={15} /> : <Plus size={15} />}
            {showCreate ? "Cancel" : "New Item"}
          </Button>
        }
      />
      <PageShell className="flex flex-col gap-4 xl:gap-5">
        {notice && (
          <p role="status" className="flex items-start justify-between gap-3 rounded-[10px] border border-status-approved/40 px-3 py-2 text-sm">
            {notice}
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="shrink-0 rounded-[6px] text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              <X size={15} aria-hidden />
            </button>
          </p>
        )}
        {showCreate && (
          <SectionCard title="New item" description="Add a piece of gear and name it whatever you call it.">
            <ItemFields d={draft} set={(p) => setDraft((d) => ({ ...d, ...p }))} categories={categories} idPrefix="new-item" />
            {error && <p role="alert" className="text-xs text-status-declined">{error}</p>}
            <div>
              <Button variant="primary" onClick={handleAdd} disabled={adding}>
                {adding ? "Adding…" : "Add Equipment"}
              </Button>
            </div>
          </SectionCard>
        )}

        <SectionCard icon={Boxes} title="Inventory" description={items ? `${items.length} ${items.length === 1 ? "item" : "items"}, ${items.reduce((n, i) => n + (i.quantity_owned ?? 0), 0)} pieces in all` : undefined}>
        <DataTable
          columns={equipmentColumns((i) => { setEditError(null); setEditing({ id: i.id, d: toDraft(i) }); }, setPendingDeleteId)}
          onRowClick={(i) => { setEditError(null); setEditing({ id: i.id, d: toDraft(i) }); }}
          rows={items ?? []}
          rowKey={(item) => item.id}
          loading={items === null}
          searchFn={(item, q) => item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || (item.brand ?? "").toLowerCase().includes(q)}
          searchPlaceholder="Search equipment…"
          emptyIcon={Boxes}
          emptyTitle="No equipment yet"
          emptyBody="Add your first piece of gear."
        />
        </SectionCard>

        <EquipmentSetupRules inventory={(items ?? []).map((i) => ({ id: i.id, name: i.name, category: i.category }))} />
      </PageShell>

      <SideDrawer open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.d.name || "item"}` : "Edit item"} subtitle="Changes show everywhere this item is used.">
        {editing && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveEdit();
            }}
          >
            <ItemFields d={editing.d} set={(p) => setEditing((cur) => (cur ? { ...cur, d: { ...cur.d, ...p } } : cur))} categories={categories} idPrefix="edit-item" full />
            {editError && <p role="alert" className="text-sm text-status-declined">{editError}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" type="submit" disabled={savingEdit} className="w-fit">
                {savingEdit ? "Saving…" : "Save changes"}
              </Button>
              <Button variant="secondary" type="button" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <button type="button" onClick={() => { const id = editing.id; setEditing(null); setPendingDeleteId(id); }} className="ml-auto rounded-[8px] px-2 py-1 text-sm text-status-declined hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                Remove item…
              </button>
            </div>
          </form>
        )}
      </SideDrawer>

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

function equipmentColumns(onEdit: (i: EquipmentRow) => void, onDelete: (id: string) => void): DataTableColumn<EquipmentRow>[] {
  return [
    { key: "name", header: "Name", sortValue: (i) => i.name, render: (i) => <span className="font-medium">{i.name}</span> },
    { key: "category", header: "Category", sortValue: (i) => i.category, render: (i) => <span className="capitalize text-muted">{i.category}</span> },
    { key: "brand", header: "Brand", hideBelow: "md", render: (i) => <span className="text-muted">{i.brand ?? "—"}</span> },
    { key: "qty", header: "Qty", sortValue: (i) => i.quantity_owned, render: (i) => <span className="tabular-nums">{i.quantity_owned}</span> },
    { key: "status", header: "Status", hideBelow: "md", render: (i) => <span className="text-muted">{STATUSES.find((o) => o.v === i.status)?.l ?? nice(i.status)}</span> },
    { key: "location", header: "Location", hideBelow: "lg", render: (i) => <span className="text-muted">{i.storage_location ?? "—"}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (i) => (
        <ActionMenu
          label={`More actions for ${i.name}`}
          items={[
            { label: "Edit", icon: PenLine, onSelect: () => onEdit(i) },
            "separator",
            { label: "Remove…", icon: Trash2, danger: true, onSelect: () => onDelete(i.id) }
          ]}
        />
      )
    }
  ];
}
