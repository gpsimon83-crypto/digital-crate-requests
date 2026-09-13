"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";

export interface ChangeOrderData {
  id: string;
  changes: { field: string; label: string; oldValue: string; newValue: string }[];
  client_acknowledged_at: string | null;
  client_acknowledged_by: string | null;
  dj_acknowledged_at: string | null;
  created_at: string;
}

/**
 * Shared by the client portal and the DJ project workspace — the original
 * signed contract never gets silently edited, so any change to its key
 * terms (price, times, venue, package) while it's already signed shows up
 * here until both the client and the assigned DJ have acknowledged it.
 */
export function ChangeOrdersPanel({
  changeOrders,
  role,
  onAcknowledge
}: {
  changeOrders: ChangeOrderData[];
  role: "client" | "dj";
  onAcknowledge: (id: string, fullName?: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const pending = changeOrders.filter((c) => (role === "client" ? !c.client_acknowledged_at : !c.dj_acknowledged_at));
  if (pending.length === 0) return null;

  async function handleAcknowledge(id: string) {
    setError(null);
    if (role === "client" && !nameById[id]?.trim()) {
      setError("Enter your full name to acknowledge this change.");
      return;
    }
    setBusyId(id);
    try {
      await onAcknowledge(id, nameById[id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {pending.map((c) => (
        <GlassCard key={c.id} neon className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold">Contract update needs your OK</p>
            <p className="text-xs text-muted">Something changed on this signed contract on {new Date(c.created_at).toLocaleDateString()} — please review and acknowledge.</p>
          </div>
          <div className="flex flex-col gap-1">
            {c.changes.map((change, i) => (
              <p key={i} className="text-sm">
                <span className="font-medium">{change.label}:</span> {change.oldValue} <span className="text-muted">→</span> {change.newValue}
              </p>
            ))}
          </div>
          {role === "client" && (
            <input
              value={nameById[c.id] ?? ""}
              onChange={(e) => setNameById((s) => ({ ...s, [c.id]: e.target.value }))}
              placeholder="Your full name"
              className="rounded-[10px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          )}
          {error && <p className="text-xs text-status-declined">{error}</p>}
          <Button variant="cta" size="sm" onClick={() => handleAcknowledge(c.id)} disabled={busyId === c.id} className="w-fit">
            {busyId === c.id ? "Saving..." : "Acknowledge this change"}
          </Button>
        </GlassCard>
      ))}
    </div>
  );
}
