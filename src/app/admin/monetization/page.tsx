"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { DEFAULT_PRICING_CONFIG, type PaymentMode, type PricingConfig } from "@/lib/pricing";
import { X } from "lucide-react";

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: "free", label: "Free Requests" },
  { value: "tips_only", label: "Tips Only" },
  { value: "paid_requests", label: "Paid Requests" },
  { value: "priority_requests", label: "Priority Requests" },
  { value: "jukebox_credits", label: "Jukebox Credits" },
  { value: "vip_access", label: "VIP Access" },
  { value: "custom", label: "Custom Mode" },
];

export default function MonetizationPage() {
  const [config, setConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/pricing");
        const data = await res.json();
        setConfig(data.config);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load pricing.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save pricing");
      setConfig(data.config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function dollars(cents: number) {
    return (cents / 100).toString();
  }
  function toCents(value: string) {
    return Math.round(Number(value) * 100);
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Monetization Center" subtitle="All pricing is controlled here — nothing is hardcoded." />
        <p className="p-6 text-sm text-muted">Loading...</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Monetization Center" subtitle="All pricing is controlled here — nothing is hardcoded." />
      <div className="flex flex-col gap-6 p-6">
        {error && <p className="text-xs text-status-declined">{error}</p>}

        <GlassCard neon className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Payment Mode</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PAYMENT_MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setConfig((c) => ({ ...c, paymentMode: m.value }))}
                className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors ${
                  config.paymentMode === m.value ? "border-gold bg-gold/10 text-gold" : "border-white/10 text-muted"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col gap-4">
          <p className="text-sm font-semibold">Request Pricing</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <PriceField
              label="Base Request Price"
              cents={config.requestPricing.basePriceCents}
              onChange={(v) => setConfig((c) => ({ ...c, requestPricing: { ...c.requestPricing, basePriceCents: v } }))}
            />
            <PriceField
              label="Priority Price"
              cents={config.requestPricing.priorityPriceCents}
              onChange={(v) => setConfig((c) => ({ ...c, requestPricing: { ...c.requestPricing, priorityPriceCents: v } }))}
            />
            <PriceField
              label="Rush Request Price"
              cents={config.requestPricing.rushPriceCents}
              onChange={(v) => setConfig((c) => ({ ...c, requestPricing: { ...c.requestPricing, rushPriceCents: v } }))}
            />
            <PriceField
              label="Top of Queue Price"
              cents={config.requestPricing.topOfQueuePriceCents}
              onChange={(v) => setConfig((c) => ({ ...c, requestPricing: { ...c.requestPricing, topOfQueuePriceCents: v } }))}
            />
            <PriceField
              label="Dedication Price"
              cents={config.requestPricing.dedicationPriceCents}
              onChange={(v) => setConfig((c) => ({ ...c, requestPricing: { ...c.requestPricing, dedicationPriceCents: v } }))}
            />
            <PriceField
              label="Custom Message Price"
              cents={config.requestPricing.customMessagePriceCents}
              onChange={(v) => setConfig((c) => ({ ...c, requestPricing: { ...c.requestPricing, customMessagePriceCents: v } }))}
            />
          </div>

          <PresetEditor
            label="Request Preset Buttons"
            values={config.requestPricing.presetCents}
            onChange={(vals) => setConfig((c) => ({ ...c, requestPricing: { ...c.requestPricing, presetCents: vals } }))}
          />
        </GlassCard>

        <GlassCard className="flex flex-col gap-4">
          <p className="text-sm font-semibold">Tip Settings</p>
          <PresetEditor
            label="Tip Preset Buttons"
            values={config.tipSettings.presetCents}
            onChange={(vals) => setConfig((c) => ({ ...c, tipSettings: { ...c.tipSettings, presetCents: vals } }))}
          />
          <label className="flex items-center justify-between text-sm">
            <span>Allow custom tip amount</span>
            <button
              onClick={() =>
                setConfig((c) => ({ ...c, tipSettings: { ...c.tipSettings, allowCustomAmount: !c.tipSettings.allowCustomAmount } }))
              }
              className={`relative h-6 w-11 rounded-full transition-colors ${config.tipSettings.allowCustomAmount ? "bg-gold" : "bg-white/10"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-transform ${config.tipSettings.allowCustomAmount ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </label>
        </GlassCard>

        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Jukebox Mode</p>
            <button
              onClick={() => setConfig((c) => ({ ...c, jukebox: { ...c.jukebox, enabled: !c.jukebox.enabled } }))}
              className={`relative h-6 w-11 rounded-full transition-colors ${config.jukebox.enabled ? "bg-gold" : "bg-white/10"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-transform ${config.jukebox.enabled ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <CreditField
              label="Song = Credits"
              value={config.jukebox.songCredits}
              onChange={(v) => setConfig((c) => ({ ...c, jukebox: { ...c.jukebox, songCredits: v } }))}
            />
            <CreditField
              label="Priority = Credits"
              value={config.jukebox.priorityCredits}
              onChange={(v) => setConfig((c) => ({ ...c, jukebox: { ...c.jukebox, priorityCredits: v } }))}
            />
            <CreditField
              label="Dedication = Credits"
              value={config.jukebox.dedicationCredits}
              onChange={(v) => setConfig((c) => ({ ...c, jukebox: { ...c.jukebox, dedicationCredits: v } }))}
            />
            <CreditField
              label="Vote = Credits"
              value={config.jukebox.voteCredits}
              onChange={(v) => setConfig((c) => ({ ...c, jukebox: { ...c.jukebox, voteCredits: v } }))}
            />
          </div>

          <p className="text-xs uppercase tracking-wide text-muted">Credit Packs</p>
          <div className="grid gap-3 sm:grid-cols-4">
            {config.jukebox.creditPacks.map((pack, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-panel p-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] uppercase text-muted">Credits</span>
                  <input
                    type="number"
                    value={pack.credits}
                    onChange={(e) => {
                      const packs = [...config.jukebox.creditPacks];
                      packs[i] = { ...packs[i], credits: Number(e.target.value) };
                      setConfig((c) => ({ ...c, jukebox: { ...c.jukebox, creditPacks: packs } }));
                    }}
                    className="w-full rounded-lg border border-white/10 bg-background px-2 py-1.5 text-sm focus:border-gold focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] uppercase text-muted">Price ($)</span>
                  <input
                    type="number"
                    value={dollars(pack.priceCents)}
                    onChange={(e) => {
                      const packs = [...config.jukebox.creditPacks];
                      packs[i] = { ...packs[i], priceCents: toCents(e.target.value) };
                      setConfig((c) => ({ ...c, jukebox: { ...c.jukebox, creditPacks: packs } }));
                    }}
                    className="w-full rounded-lg border border-white/10 bg-background px-2 py-1.5 text-sm focus:border-gold focus:outline-none"
                  />
                </label>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="flex items-center gap-3">
          <NeonButton color="gold" onClick={handleSave} disabled={saving} className="w-full sm:w-fit">
            {saving ? "Saving..." : "Save Pricing"}
          </NeonButton>
          {saved && <span className="text-xs text-status-approved">Saved</span>}
        </div>
      </div>
    </>
  );
}

function PriceField({ label, cents, onChange }: { label: string; cents: number; onChange: (cents: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label} ($)</span>
      <input
        type="number"
        value={(cents / 100).toString()}
        onChange={(e) => onChange(Math.round(Number(e.target.value) * 100))}
        className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
      />
    </label>
  );
}

function CreditField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
      />
    </label>
  );
}

function PresetEditor({
  label,
  values,
  onChange,
}: {
  label: string;
  values: number[];
  onChange: (values: number[]) => void;
}) {
  const [newValue, setNewValue] = useState("");

  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wide text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-panel px-3 py-1.5 text-xs">
            {v === 0 ? "Free" : `$${(v / 100).toFixed(v % 100 === 0 ? 0 : 2)}`}
            <button onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="text-muted hover:text-status-declined">
              <X size={12} />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="$ amount"
            className="w-24 rounded-full border border-white/10 bg-panel px-3 py-1.5 text-xs focus:border-gold focus:outline-none"
          />
          <button
            onClick={() => {
              if (newValue === "") return;
              onChange([...values, Math.round(Number(newValue) * 100)]);
              setNewValue("");
            }}
            className="rounded-full border border-white/15 px-2.5 py-1.5 text-xs text-muted hover:text-foreground"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
