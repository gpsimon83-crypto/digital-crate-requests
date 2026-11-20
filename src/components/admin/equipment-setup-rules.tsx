"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import type { GigCondition } from "@/lib/packages/gig-calculator";
import { SPACE_LABEL, type SetupRule, type Space } from "@/lib/equipment-plan";
import { cn } from "@/lib/utils";

type Item = { id: string; name: string; category: string };
const SPACES: Space[] = ["reception", "ceremony", "cocktail", "microphones"];
const FIELDS: { source: GigCondition["source"]; field: string; label: string; values?: string[] }[] = [
  { source: "event", field: "guest_count", label: "Guest count" },
  { source: "event", field: "event_type", label: "Event type", values: ["wedding", "corporate", "school_dance", "private_party", "bar_nightclub", "holiday"] },
  { source: "event", field: "hours_booked", label: "Hours booked" },
  { source: "answer", field: "setting", label: "Indoors / outdoors", values: ["indoors", "outdoors", "both"] },
  { source: "answer", field: "ceremony_space", label: "Ceremony space", values: ["same_room", "same_venue", "different", "none"] },
  { source: "answer", field: "cocktail_space", label: "Cocktail space", values: ["same_room", "separate", "none"] },
  { source: "answer", field: "microphones", label: "Microphones", values: ["officiant", "toasts", "announcements", "live"] }
];
const OPS: { op: GigCondition["op"]; label: string }[] = [
  { op: "eq", label: "is" },
  { op: "ne", label: "is not" },
  { op: "gte", label: "≥" },
  { op: "lte", label: "≤" },
  { op: "gt", label: ">" },
  { op: "lt", label: "<" },
  { op: "in", label: "is one of" },
  { op: "includes", label: "includes" },
  { op: "excludes", label: "doesn't include" }
];
const input = "rounded-[8px] border border-black/10 bg-panel px-2 py-1.5 text-sm focus:border-gold focus:outline-none";

/**
 * Admin → Equipment: the rules that turn an event's details into a proposed
 * setup. Each rule belongs to a space, applies when all its conditions match
 * (no conditions = always), and adds a quantity of one item or of the best
 * available item in a category.
 */
export function EquipmentSetupRules({ inventory }: { inventory: Item[] }) {
  const [rules, setRules] = useState<SetupRule[] | null>(null);
  const [ready, setReady] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const nextNew = useRef(1);

  useEffect(() => {
    fetch("/api/admin/equipment-setup-rules")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        setReady(j.ready !== false);
        setRules(j.rules ?? []);
      })
      .catch(() => setRules(null));
  }, []);

  const categories = [...new Set(["speakers", "mixer", "microphone", "lights", ...inventory.map((i) => i.category.toLowerCase())])];
  const edit = (id: string, patch: Partial<SetupRule>) => {
    setRules((rs) => (rs ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty((d) => new Set(d).add(id));
  };

  async function save(r: SetupRule) {
    setMsg(null);
    const body = { space: r.space, label: r.label, conditions: r.conditions, equipment_id: r.equipment_id, equipment_category: r.equipment_id ? null : r.equipment_category, quantity: r.quantity, reason: r.reason, position: r.position, is_active: r.is_active };
    const isNew = r.id.startsWith("new-");
    const res = await fetch(isNew ? "/api/admin/equipment-setup-rules" : `/api/admin/equipment-setup-rules/${r.id}`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(j.error ?? "Couldn't save.");
    setRules((rs) => (rs ?? []).map((x) => (x.id === r.id ? j.rule : x)));
    setDirty((d) => {
      const n = new Set(d);
      n.delete(r.id);
      return n;
    });
    setMsg(`Saved “${j.rule.label}”.`);
  }
  async function remove(r: SetupRule) {
    if (!r.id.startsWith("new-")) {
      const res = await fetch(`/api/admin/equipment-setup-rules/${r.id}`, { method: "DELETE" });
      if (!res.ok) return setMsg("Couldn't delete.");
    }
    setRules((rs) => (rs ?? []).filter((x) => x.id !== r.id));
  }
  function add(space: Space) {
    const id = `new-${nextNew.current++}`;
    setRules((rs) => [...(rs ?? []), { id, space, label: "New rule", conditions: [], equipment_id: null, equipment_category: space === "microphones" ? "microphone" : "speakers", quantity: 1, reason: "", position: 99, is_active: true }]);
    setDirty((d) => new Set(d).add(id));
  }

  if (rules === null) return null; // no permission, or not loaded
  return (
    <GlassCard className="flex flex-col gap-4" data-tour="equipment-setup-rules">
      <div className="flex items-start gap-3">
        <Wand2 size={18} className="mt-0.5 shrink-0 text-gold" />
        <div>
          <p className="text-sm font-semibold">Setup rules</p>
          <p className="text-xs text-muted">
            How a project&rsquo;s Equipment card proposes gear from the guest count, spaces, indoors/outdoors and microphone needs. A rule applies when all its conditions match (no conditions = always) and adds a quantity of one item, or of whichever item in a category has the most free for that date.
          </p>
        </div>
      </div>
      {!ready && <p className="rounded-[10px] bg-status-pending/10 p-3 text-xs text-status-pending">Run migration 0058_equipment_setup_plans.sql in Supabase to use setup rules.</p>}
      {msg && <p className="text-xs text-muted">{msg}</p>}

      {ready &&
        SPACES.map((space) => (
          <div key={space} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">{SPACE_LABEL[space]}</p>
              <button onClick={() => add(space)} className="flex items-center gap-1 rounded-[6px] text-xs font-medium text-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                <Plus size={12} /> Add rule
              </button>
            </div>
            {rules
              .filter((r) => r.space === space)
              .sort((a, b) => a.position - b.position)
              .map((r) => (
                <div key={r.id} className={cn("flex flex-col gap-2 rounded-[12px] border p-3", r.is_active ? "border-border" : "border-dashed border-border opacity-70")}>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4.5rem]">
                    <input value={r.label} onChange={(e) => edit(r.id, { label: e.target.value })} className={input} aria-label="Rule name" />
                    <select
                      value={r.equipment_id ? `item:${r.equipment_id}` : `cat:${r.equipment_category ?? ""}`}
                      onChange={(e) => {
                        const [kind, v] = e.target.value.split(/:(.*)/);
                        edit(r.id, kind === "item" ? { equipment_id: v, equipment_category: null } : { equipment_id: null, equipment_category: v });
                      }}
                      className={input}
                      aria-label="Gear"
                    >
                      <optgroup label="Any item in a category">
                        {categories.map((c) => (
                          <option key={c} value={`cat:${c}`}>
                            Any {c}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="A specific item">
                        {inventory.map((i) => (
                          <option key={i.id} value={`item:${i.id}`}>
                            {i.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <input type="number" min={1} max={50} value={r.quantity} onChange={(e) => edit(r.id, { quantity: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} className={input} aria-label="Quantity" />
                  </div>
                  <input value={r.reason ?? ""} onChange={(e) => edit(r.id, { reason: e.target.value })} placeholder="Why (shown to staff)" className={input} aria-label="Reason" />
                  <div className="flex flex-col gap-1.5">
                    {r.conditions.map((c, ci) => {
                      const f = FIELDS.find((x) => x.field === c.field && x.source === c.source) ?? FIELDS[0];
                      const setC = (patch: Partial<GigCondition>) => edit(r.id, { conditions: r.conditions.map((x, i) => (i === ci ? { ...x, ...patch } : x)) });
                      return (
                        <div key={ci} className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="text-muted">{ci === 0 ? "When" : "and"}</span>
                          <select
                            value={`${c.source}:${c.field}`}
                            onChange={(e) => {
                              const [source, field] = e.target.value.split(":");
                              setC({ source: source as GigCondition["source"], field });
                            }}
                            className={input}
                            aria-label="Condition field"
                          >
                            {FIELDS.map((x) => (
                              <option key={x.field} value={`${x.source}:${x.field}`}>
                                {x.label}
                              </option>
                            ))}
                          </select>
                          <select value={c.op} onChange={(e) => setC({ op: e.target.value as GigCondition["op"] })} className={input} aria-label="Condition">
                            {OPS.map((o) => (
                              <option key={o.op} value={o.op}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <input
                            value={String(c.value)}
                            onChange={(e) => setC({ value: f.values ? e.target.value : e.target.value === "" || isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value) })}
                            list={f.values ? `vals-${f.field}` : undefined}
                            className={cn(input, "w-36")}
                            aria-label="Value"
                          />
                          {f.values && (
                            <datalist id={`vals-${f.field}`}>
                              {f.values.map((v) => (
                                <option key={v} value={v} />
                              ))}
                            </datalist>
                          )}
                          <button onClick={() => edit(r.id, { conditions: r.conditions.filter((_, i) => i !== ci) })} className="rounded p-1 text-muted hover:text-status-declined" aria-label="Remove condition">
                            ×
                          </button>
                        </div>
                      );
                    })}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <button onClick={() => edit(r.id, { conditions: [...r.conditions, { source: "event", field: "guest_count", op: "gte", value: 100 }] })} className="font-medium text-gold hover:underline">
                        + Condition
                      </button>
                      {!r.conditions.length && <span className="text-muted">Always applies for this space</span>}
                      <label className="ml-auto flex items-center gap-1.5">
                        <input type="checkbox" checked={r.is_active} onChange={(e) => edit(r.id, { is_active: e.target.checked })} className="accent-[var(--gold)]" /> Active
                      </label>
                      <button onClick={() => void remove(r)} className="flex items-center gap-1 text-status-declined hover:underline">
                        <Trash2 size={12} /> Delete
                      </button>
                      <Button variant={dirty.has(r.id) ? "primary" : "secondary"} size="sm" onClick={() => void save(r)} disabled={!dirty.has(r.id)}>
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ))}
    </GlassCard>
  );
}
