"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Boxes, TriangleAlert, Trash2 } from "lucide-react";

export interface EquipmentAssignmentRow {
  id: string;
  equipment_id: string;
  quantity: number;
  notes: string | null;
  equipment: { id: string; name: string; category: string; quantity_owned: number } | null;
}

interface EquipmentOption {
  id: string;
  name: string;
  category: string;
  quantity_owned: number;
}

interface ConflictCheck {
  quantityOwned: number;
  alreadyAssigned: number;
  requested: number;
  available: number;
  hasConflict: boolean;
  conflictingEvents: { eventId: string; title: string | null; startsAt: string | null; quantity: number }[];
}

export function EquipmentAssignmentsPanel({ eventId }: { eventId: string }) {
  const [assignments, setAssignments] = useState<EquipmentAssignmentRow[] | null>(null);
  const [options, setOptions] = useState<EquipmentOption[] | null>(null);
  const [equipmentId, setEquipmentId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictCheck | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch(`/api/events/${eventId}/equipment`)
      .then((r) => r.json())
      .then((data) => setAssignments(data.assignments ?? []))
      .catch(() => setAssignments([]));
  }

  useEffect(load, [eventId]);

  useEffect(() => {
    fetch("/api/admin/equipment")
      .then((r) => r.json())
      .then((data) => setOptions((data.equipment ?? []).map((e: EquipmentOption) => ({ id: e.id, name: e.name, category: e.category, quantity_owned: e.quantity_owned }))))
      .catch(() => setOptions([]));
  }, []);

  async function submit(force: boolean) {
    if (!equipmentId) return;
    const qty = parseInt(quantity, 10) || 1;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipmentId, quantity: qty, force })
      });
      const data = await res.json();
      if (res.status === 409) {
        setConflict(data.conflict);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to assign equipment");
      setEquipmentId("");
      setQuantity("1");
      setConflict(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/equipment-assignments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove");
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Boxes size={16} className="text-gold" />
        <p className="text-sm font-medium">Equipment</p>
      </div>
      {error && <p className="text-xs text-status-declined">{error}</p>}

      {assignments === null ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : assignments.length === 0 ? (
        <p className="text-xs text-muted">Nothing assigned to this event yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {assignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm">
                  {a.quantity}× {a.equipment?.name ?? "Unknown item"}
                </p>
                <p className="text-xs text-muted">{a.equipment?.category}</p>
              </div>
              <button onClick={() => handleRemove(a.id)} className="flex shrink-0 items-center gap-1 text-xs text-status-declined hover:underline">
                <Trash2 size={12} /> Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {conflict && (
        <div className="flex flex-col gap-2 border border-status-declined/40 bg-status-declined/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-status-declined">
            <TriangleAlert size={13} /> Possible double-booking
          </div>
          <p className="text-xs text-muted">
            {conflict.alreadyAssigned} of {conflict.quantityOwned} already assigned to overlapping event
            {conflict.conflictingEvents.length === 1 ? "" : "s"} — only {Math.max(conflict.available, 0)} available, you requested{" "}
            {conflict.requested}.
          </p>
          <ul className="flex flex-col gap-0.5 text-xs text-muted">
            {conflict.conflictingEvents.map((c) => (
              <li key={c.eventId}>
                • {c.quantity}× on {c.title ?? "another event"} {c.startsAt ? `(${new Date(c.startsAt).toLocaleDateString()})` : ""}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={() => submit(true)} disabled={saving}>
              Assign anyway
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConflict(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!conflict && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
            className="flex-1 rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
          >
            <option value="">Select equipment…</option>
            {(options ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.category})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none sm:w-20"
          />
          <Button variant="primary" size="sm" onClick={() => submit(false)} disabled={!equipmentId || saving}>
            {saving ? "Checking…" : "Assign"}
          </Button>
        </div>
      )}
    </GlassCard>
  );
}
