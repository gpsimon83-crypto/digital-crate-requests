"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";

interface Settings {
  allow_dj_self_registration: boolean;
  require_disclaimer_acceptance: boolean;
  crowd_vote_boosts_enabled: boolean;
  push_notifications_enabled: boolean;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load settings");
        setSettings(data.settings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowDjSelfRegistration: settings.allow_dj_self_registration,
          requireDisclaimerAcceptance: settings.require_disclaimer_acceptance,
          crowdVoteBoostsEnabled: settings.crowd_vote_boosts_enabled,
          pushNotificationsEnabled: settings.push_notifications_enabled,
        }),
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
      <PageHeader title="Platform Settings" subtitle="Global configuration for Digital Crate Requests." />
      <div className="flex flex-col gap-4 p-6">
        {error && <p className="text-xs text-status-declined">{error}</p>}
        {!settings && !error && <p className="text-sm text-muted">Loading...</p>}

        {settings && (
          <>
            <GlassCard className="flex flex-col gap-4">
              <ToggleRow
                label="Require disclaimer acceptance before paid requests"
                checked={settings.require_disclaimer_acceptance}
                onChange={(v) => setSettings((s) => s && { ...s, require_disclaimer_acceptance: v })}
              />
              <ToggleRow
                label="Enable Crowd Vote boosts platform-wide"
                checked={settings.crowd_vote_boosts_enabled}
                onChange={(v) => setSettings((s) => s && { ...s, crowd_vote_boosts_enabled: v })}
              />
            </GlassCard>

            <div>
              <p className="mb-3 text-xs uppercase tracking-wide text-muted">Reserved for future builds</p>
              <GlassCard className="flex flex-col gap-4 opacity-60">
                <ToggleRow
                  label="Allow new DJ self-registration with invite code (no self-registration page built yet)"
                  checked={settings.allow_dj_self_registration}
                  onChange={(v) => setSettings((s) => s && { ...s, allow_dj_self_registration: v })}
                />
                <ToggleRow
                  label="Enable push notifications (no delivery system built yet)"
                  checked={settings.push_notifications_enabled}
                  onChange={(v) => setSettings((s) => s && { ...s, push_notifications_enabled: v })}
                />
              </GlassCard>
            </div>
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
