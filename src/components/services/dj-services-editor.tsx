"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { DraftField } from "@/components/ui/draft-field";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import type { DjServiceRow } from "@/app/api/dj/services/route";

/**
 * Shared list UI for "my services" (DJ self-service, endpoint /api/dj/services)
 * and admin-on-behalf-of (endpoint /api/admin/djs/{id}/services) — same
 * shape, same fields, only the endpoint differs.
 */
export function DjServicesEditor({ endpoint }: { endpoint: string }) {
  const [services, setServices] = useState<DjServiceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setServices(data.services);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }, [endpoint]);

  async function save(row: DjServiceRow, patch: Partial<Pick<DjServiceRow, "price_cents" | "is_offered">>) {
    const next = { ...row, ...patch, is_set_up: true };
    setServices((s) => s && s.map((r) => (r.catalog_item_id === row.catalog_item_id ? next : r)));
    setSavingId(row.catalog_item_id);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogItemId: row.catalog_item_id,
          priceCents: next.price_cents,
          minQuantity: next.min_quantity,
          maxQuantity: next.max_quantity,
          isOffered: next.is_offered
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingId(null);
    }
  }

  if (error && !services) return <p className="text-sm text-status-declined">{error}</p>;
  if (!services) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs text-status-declined">{error}</p>}
      <p className="text-xs text-muted">
        These are the shared service types Digital Crate DJs offers — set your own price for each, or turn one off if you don&rsquo;t offer it. Turning a
        service off hides it from your packages entirely.
      </p>
      {services.map((row) => (
        <GlassCard key={row.catalog_item_id} className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${!row.is_offered ? "opacity-60" : ""}`}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{row.name}</p>
            <p className="text-xs text-muted">
              {row.category} · {row.pricing_method.replace("_", " ")}
              {row.unit_label ? ` / ${row.unit_label}` : ""}
              {!row.is_set_up && <span className="ml-1 italic text-gold">— not set up yet, showing default price</span>}
            </p>
            {row.description && <p className="mt-1 text-xs text-muted">{row.description}</p>}
          </div>
          <div className="flex shrink-0 items-end gap-3">
            <div className="w-28">
              <DraftField
                label="Your price ($)"
                value={(row.price_cents / 100).toFixed(2)}
                onCommit={(v) => {
                  const cents = Math.round(parseFloat(v || "0") * 100);
                  if (!Number.isNaN(cents)) save(row, { price_cents: cents });
                }}
              />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Offer this</span>
              <ToggleSwitch
                checked={row.is_offered}
                onChange={(v) => save(row, { is_offered: v })}
                disabled={savingId === row.catalog_item_id}
                label={`Offer ${row.name}`}
              />
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
