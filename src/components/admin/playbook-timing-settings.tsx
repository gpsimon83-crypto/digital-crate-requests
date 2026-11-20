"use client";

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ownerLabel, STAGES, type Owner } from "@/lib/playbook";

type Row = { key: string; title: string; stage: number; owner: Owner; anchor: "event" | "booked"; offset: number; active: boolean };

/**
 * Admin → Settings: when each Wedding Playbook task is due. Changes apply to
 * open tasks the next time a wedding's Tasks tab loads; due dates someone
 * set by hand on a task are left alone.
 */
export function PlaybookTimingSettings() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [ready, setReady] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings/playbook-timing")
      .then((r) => r.json())
      .then((j) => {
        setReady(j.ready !== false);
        setRows(j.timing ?? []);
      })
      .catch(() => setRows([]));
  }, []);

  async function save() {
    if (!rows) return;
    setSaving(true);
    setMsg(null);
    const r = await fetch("/api/admin/settings/playbook-timing", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timing: rows.map(({ key, offset, active }) => ({ key, offset, active })) }) });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    setMsg(r.ok ? "Saved" : (j.error ?? "Couldn't save."));
  }

  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const describe = (r: Row) => (r.anchor === "booked" ? "days after booking" : r.offset < 0 ? "days before the wedding" : r.offset === 0 ? "wedding day" : "days after the wedding");

  return (
    <GlassCard className="flex flex-col gap-3" data-tour="playbook-timing">
      <div className="flex items-start gap-2">
        <ListChecks size={16} className="mt-0.5 text-gold" />
        <div>
          <p className="text-sm font-semibold">Wedding Playbook timing</p>
          <p className="text-xs text-muted">When each playbook task is due. Open tasks move to the new timing; due dates set by hand on a task stay put. Turn a task off to stop adding it to new weddings.</p>
        </div>
      </div>
      {!ready && <p className="text-xs text-status-pending">Run migration 0059_wedding_playbook.sql to save changes.</p>}
      {!rows ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {rows.map((r) => (
            <div key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <input type="checkbox" checked={r.active} onChange={(e) => set(r.key, { active: e.target.checked })} className="h-4 w-4 accent-[var(--gold)]" aria-label={`Use ${r.title}`} />
                <span className={r.active ? "" : "text-muted line-through"}>{r.title}</span>
              </label>
              <span className="hidden w-40 text-xs text-muted md:block">
                {r.stage}. {STAGES[r.stage - 1]} · {ownerLabel(r.owner, "staff")}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <input
                  type="number"
                  value={r.anchor === "event" ? Math.abs(r.offset) : r.offset}
                  min={0}
                  max={400}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(400, Math.round(Number(e.target.value) || 0)));
                    set(r.key, { offset: r.anchor === "event" && r.offset < 0 ? -n : n });
                  }}
                  className="w-16 rounded-[8px] border border-black/10 bg-panel px-2 py-1 text-right text-sm focus:border-gold focus:outline-none"
                  aria-label={`${r.title} days`}
                />
                {describe(r)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" disabled={saving || !rows?.length} onClick={() => void save()}>
          {saving ? "Saving…" : "Save timing"}
        </Button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
    </GlassCard>
  );
}
