"use client";

import { use, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { EventQrCode } from "@/components/dashboard/event-qr-code";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { X } from "lucide-react";

interface EventDj {
  display_name: string;
  photo_url: string | null;
}

interface GuestSettings {
  guestRequestsEnabled: boolean;
  boostsEnabled: boolean;
  explicitAllowed: boolean;
  maxRequestPriceCents: number;
}

const DEFAULT_SETTINGS: GuestSettings = {
  guestRequestsEnabled: true,
  boostsEnabled: true,
  explicitAllowed: false,
  maxRequestPriceCents: 2000,
};

export default function EventSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId: eventCode } = use(params);

  const [dbId, setDbId] = useState<string | null>(null);
  const [dj, setDj] = useState<EventDj | null>(null);
  const [mustPlay, setMustPlay] = useState<string[]>([]);
  const [doNotPlay, setDoNotPlay] = useState<string[]>([]);
  const [settings, setSettings] = useState<GuestSettings>(DEFAULT_SETTINGS);
  const [newMustPlay, setNewMustPlay] = useState("");
  const [newDoNotPlay, setNewDoNotPlay] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/events/code/${eventCode}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load event");

        setDbId(data.event.id);
        setDj(data.event.djs ?? null);
        setMustPlay(data.event.must_play ?? []);
        setDoNotPlay(data.event.do_not_play ?? []);
        setSettings({ ...DEFAULT_SETTINGS, ...(data.event.guest_request_settings ?? {}) });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [eventCode]);

  async function handleSave() {
    if (!dbId) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/events/${dbId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mustPlay, doNotPlay, guestRequestSettings: settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Event Settings"
        subtitle="Control what guests can request and how requests are handled."
        action={dj && <DjAvatar name={dj.display_name} photoUrl={dj.photo_url} size={44} />}
      />
      <div className="flex flex-col gap-6 p-6">
        <EventQrCode eventCode={eventCode} />

        {loading && <p className="text-sm text-muted">Loading event settings...</p>}
        {error && <p className="text-sm text-status-declined">{error}</p>}

        {!loading && dbId && (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <ListEditor
                title="Must-Play List"
                titleClass="text-status-approved"
                items={mustPlay}
                setItems={setMustPlay}
                value={newMustPlay}
                setValue={setNewMustPlay}
                placeholder="Add a song..."
              />
              <ListEditor
                title="Do-Not-Play List"
                titleClass="text-status-declined"
                items={doNotPlay}
                setItems={setDoNotPlay}
                value={newDoNotPlay}
                setValue={setNewDoNotPlay}
                placeholder="Add a song or artist..."
              />
            </div>

            <GlassCard className="flex flex-col gap-4">
              <p className="text-sm font-semibold">Guest Request Settings</p>
              <ToggleRow
                label="Guest requests enabled"
                checked={settings.guestRequestsEnabled}
                onChange={(v) => setSettings((s) => ({ ...s, guestRequestsEnabled: v }))}
              />
              <ToggleRow
                label="Boosts enabled"
                checked={settings.boostsEnabled}
                onChange={(v) => setSettings((s) => ({ ...s, boostsEnabled: v }))}
              />
              <ToggleRow
                label="Allow explicit songs"
                checked={settings.explicitAllowed}
                onChange={(v) => setSettings((s) => ({ ...s, explicitAllowed: v }))}
              />
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
                  Max paid request price ($)
                </span>
                <input
                  type="number"
                  value={settings.maxRequestPriceCents / 100}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, maxRequestPriceCents: Math.round(Number(e.target.value) * 100) }))
                  }
                  className="w-40 rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                />
              </label>
            </GlassCard>

            <div className="flex items-center gap-3">
              <NeonButton color="gold" onClick={handleSave} disabled={saving} className="w-full sm:w-fit">
                {saving ? "Saving..." : "Save Settings"}
              </NeonButton>
              {saved && <span className="text-xs text-status-approved">Saved</span>}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ListEditor({
  title,
  titleClass,
  items,
  setItems,
  value,
  setValue,
  placeholder,
}: {
  title: string;
  titleClass: string;
  items: string[];
  setItems: (items: string[]) => void;
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
}) {
  function add() {
    const trimmed = value.trim();
    if (!trimmed) return;
    setItems([...items, trimmed]);
    setValue("");
  }

  return (
    <GlassCard className="flex flex-col gap-3">
      <p className={`text-sm font-semibold ${titleClass}`}>{title}</p>
      <ul className="flex flex-col gap-2 text-sm text-muted">
        {items.map((s, i) => (
          <li key={`${s}-${i}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-panel px-3 py-2">
            {s}
            <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="text-muted hover:text-status-declined">
              <X size={14} />
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-muted/60">Nothing added yet.</li>}
      </ul>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-white/10 bg-panel px-4 py-2 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
        />
        <button onClick={add} className="rounded-xl border border-white/15 px-3 text-xs text-muted hover:text-foreground">
          Add
        </button>
      </div>
    </GlassCard>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-gold" : "bg-white/10"}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}
