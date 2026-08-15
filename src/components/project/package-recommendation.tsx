"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface PackageRow {
  id: string;
  name: string;
  description: string;
  price: number;
  hours: number | null;
  features: string[];
}

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function PackageRecommendation({ eventId }: { eventId: string }) {
  const [packages, setPackages] = useState<PackageRow[] | null>(null);
  const [suggestedId, setSuggestedId] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  function load() {
    fetch(`/api/events/${eventId}/package-recommendation`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setPackages([]);
          return;
        }
        setPackages(data.packages);
        setSuggestedId(data.suggestedPackageId);
        setReason(data.reason);
      })
      .catch(() => setPackages([]));
  }

  useEffect(load, [eventId]);

  if (!packages || packages.length === 0) return null;

  return (
    <GlassCard className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Packages</p>
      {reason && (
        <p className="flex items-start gap-1.5 text-xs text-gold">
          <Sparkles size={13} className="mt-0.5 shrink-0" /> {reason}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {packages.map((pkg) => {
          const suggested = pkg.id === suggestedId;
          return (
            <div
              key={pkg.id}
              className={cn("flex flex-col gap-1.5 rounded-[10px] border p-3", suggested ? "border-gold bg-gold/5" : "border-black/10 bg-panel")}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{pkg.name}</p>
                {suggested && <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold text-black">Suggested</span>}
              </div>
              <p className="text-base font-bold text-gold">{money(pkg.price)}</p>
              {pkg.hours != null && <p className="text-xs text-muted">{pkg.hours} hours</p>}
              <ul className="flex flex-col gap-0.5 text-xs text-muted">
                {pkg.features.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted">Staff picks the actual package and price for this booking — nothing here is shown to the client.</p>
    </GlassCard>
  );
}
