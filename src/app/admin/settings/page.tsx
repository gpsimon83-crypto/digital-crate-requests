"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { ShieldCheck, ChevronRight, CalendarDays } from "lucide-react";

interface Settings {
  allow_dj_self_registration: boolean;
  require_disclaimer_acceptance: boolean;
  crowd_vote_boosts_enabled: boolean;
  push_notifications_enabled: boolean;
}

interface CalendarConnection {
  googleCalendarId: string;
  connectedEmail: string | null;
  connectedAt: string;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
}

function GoogleCalendarCard() {
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("calendar") === "connected";
  const connectError = searchParams.get("calendar") === "error";

  const [connection, setConnection] = useState<CalendarConnection | null | undefined>(undefined);
  const [disconnecting, setDisconnecting] = useState(false);

  function load() {
    fetch("/api/admin/calendar")
      .then((r) => r.json())
      .then((data) => setConnection(data.connection ?? null))
      .catch(() => setConnection(null));
  }

  useEffect(load, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/admin/calendar", { method: "DELETE" });
      load();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <CalendarDays size={18} className="shrink-0 text-gold" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Google Calendar</p>
          <p className="text-xs text-muted">Two-way sync — confirmed bookings appear on your calendar, and your busy times block public booking slots.</p>
        </div>
      </div>

      {justConnected && <p className="text-xs text-status-approved">Connected — the next sync runs within 15 minutes.</p>}
      {connectError && <p className="text-xs text-status-declined">Something went wrong connecting to Google. Try again.</p>}

      {connection === undefined && <p className="text-xs text-muted">Loading…</p>}

      {connection === null && (
        <a href="/api/admin/calendar/oauth/start">
          <Button variant="primary" size="sm">
            Connect Google Calendar
          </Button>
        </a>
      )}

      {connection && (
        <div className="flex flex-col gap-2 text-xs text-muted">
          <p>
            Connected as <span className="text-foreground">{connection.connectedEmail ?? "unknown account"}</span>
          </p>
          <p>
            {connection.lastSyncedAt
              ? `Last synced ${new Date(connection.lastSyncedAt).toLocaleString()}${connection.lastSyncStatus === "error" ? " — last run failed" : ""}`
              : "Not synced yet — first run within 15 minutes."}
          </p>
          {connection.lastSyncStatus === "error" && connection.lastSyncError && (
            <p className="text-status-declined">{connection.lastSyncError}</p>
          )}
          <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="w-fit">
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </Button>
        </div>
      )}
    </GlassCard>
  );
}

function AdminSettingsPageInner() {
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

        <Link href="/admin/settings/permissions">
          <GlassCard className="flex items-center gap-3 transition-colors hover:border-gold/30">
            <ShieldCheck size={18} className="shrink-0 text-gold" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Permissions</p>
              <p className="text-xs text-muted">Control what each role — owner, admin, DJ, client — can see and do.</p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-muted" />
          </GlassCard>
        </Link>

        <GoogleCalendarCard />

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
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
              {saved && <span className="text-xs text-status-approved">Saved</span>}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading...</div>}>
      <AdminSettingsPageInner />
    </Suspense>
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
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
