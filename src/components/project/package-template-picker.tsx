"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TemplateOption {
  id: string;
  name: string;
  tier: string | null;
  description: string | null;
  display_mode: string;
  base_price_cents: number;
}

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Lets staff or the assigned DJ push a published package template into a
 * client's portal ("Use This Package") — stages it with the template's
 * default quantities so the client opens their portal and finds it
 * already there to review, customize, and save/request.
 */
export function PackageTemplatePicker({ eventId, onUsed }: { eventId: string; onUsed?: () => void }) {
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/events/${eventId}/package/templates`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load packages");
        setTemplates(data.templates);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }, [eventId]);

  async function use(templateId: string) {
    setUsingId(templateId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/events/${eventId}/package/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to use package");
      setNotice("Added to the client's portal — they'll find it under Build Your Package, ready to customize.");
      onUsed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUsingId(null);
    }
  }

  if (templates && templates.length === 0) return null;

  return (
    <GlassCard className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Push a Package to the Client</p>
      {error && <p className="text-xs text-status-declined">{error}</p>}
      {notice && <p className="text-xs text-status-approved">{notice}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {(templates ?? []).map((t) => (
          <div key={t.id} className={cn("flex flex-col gap-1.5 rounded-[10px] border border-black/10 bg-panel p-3")}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{t.name}</p>
              {t.tier && <span className="text-[10px] font-semibold uppercase tracking-wide text-gold">{t.tier}</span>}
            </div>
            <p className="text-xs font-semibold">
              {t.display_mode === "quote_only" ? "Quote only" : t.display_mode === "starting_price" ? `From ${money(t.base_price_cents)}` : money(t.base_price_cents)}
            </p>
            <Button variant="secondary" size="sm" onClick={() => use(t.id)} disabled={usingId === t.id} className="w-fit">
              {usingId === t.id ? "Using…" : "Use This Package"}
            </Button>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
