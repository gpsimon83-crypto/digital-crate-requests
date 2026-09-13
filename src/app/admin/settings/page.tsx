"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Field } from "@/components/ui/field";
import { HeroBanner } from "@/components/ui/hero-banner";
import { HeroCropControls } from "@/components/ui/hero-crop-controls";
import { mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";
import { ShieldCheck, ChevronRight, CalendarDays, Image as ImageIcon, Sparkles } from "lucide-react";

const HERO_COPY_EXAMPLES: Record<"portal" | "admin", { heading: string; subheading: string }> = {
  portal: {
    heading: "Welcome to your event hub",
    subheading: "Everything for your big day, all in one place."
  },
  admin: {
    heading: "Digital Crate DJs",
    subheading: "Book smarter, play better."
  }
};

function HeroImageUpload({
  imageUrl,
  uploading,
  onUpload,
  onClear
}: {
  imageUrl: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Banner Image</span>
      <div className="flex items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
        <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
          {uploading ? "Uploading…" : imageUrl ? "Replace image" : "Upload image"}
        </Button>
        {imageUrl && (
          <Button variant="text" size="sm" onClick={onClear} disabled={uploading}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function CopyFieldWithAI({
  label,
  value,
  placeholder,
  onChange,
  onGenerate,
  generating
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Field label={label} value={value} placeholder={placeholder} onChange={onChange} />
      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        className="flex w-fit items-center gap-1 text-[11px] font-medium text-gold hover:underline disabled:opacity-60"
      >
        <Sparkles size={11} /> {generating ? "Writing…" : "Write with AI"}
      </button>
    </div>
  );
}

interface Settings {
  allow_dj_self_registration: boolean;
  require_disclaimer_acceptance: boolean;
  crowd_vote_boosts_enabled: boolean;
  push_notifications_enabled: boolean;
  portal_hero_image_url: string | null;
  portal_hero_heading: string | null;
  portal_hero_subheading: string | null;
  portal_hero_settings: Partial<HeroSettings> | null;
  admin_hero_image_url: string | null;
  admin_hero_heading: string | null;
  admin_hero_subheading: string | null;
  review_url: string | null;
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
  const [uploading, setUploading] = useState<"portal" | "admin" | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  async function uploadHeroImage(surface: "portal" | "admin", file: File) {
    setUploading(surface);
    setError(null);
    try {
      const form = new FormData();
      form.append(surface === "portal" ? "portalHeroPhoto" : "adminHeroPhoto", file);
      const res = await fetch("/api/admin/settings", { method: "PATCH", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to upload image");
      setSettings((s) => s && { ...s, [surface === "portal" ? "portal_hero_image_url" : "admin_hero_image_url"]: json.settings[surface === "portal" ? "portal_hero_image_url" : "admin_hero_image_url"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(null);
    }
  }

  async function clearHeroImage(surface: "portal" | "admin") {
    setUploading(surface);
    setError(null);
    try {
      const column = surface === "portal" ? "portal_hero_image_url" : "admin_hero_image_url";
      const form = new FormData();
      form.append(`clear_${column}`, "true");
      const res = await fetch("/api/admin/settings", { method: "PATCH", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove image");
      setSettings((s) => s && { ...s, [column]: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(null);
    }
  }

  async function generateHeroCopy(surface: "portal" | "admin", field: "heading" | "subheading") {
    const key = `${surface}-${field}`;
    setGenerating(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/generate-hero-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface, field })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate copy");
      const column = `${surface}_hero_${field}` as "portal_hero_heading" | "portal_hero_subheading" | "admin_hero_heading" | "admin_hero_subheading";
      setSettings((s) => s && { ...s, [column]: json.text });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(null);
    }
  }

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
          portalHeroImageUrl: settings.portal_hero_image_url,
          portalHeroHeading: settings.portal_hero_heading,
          portalHeroSubheading: settings.portal_hero_subheading,
          portalHeroSettings: settings.portal_hero_settings,
          adminHeroImageUrl: settings.admin_hero_image_url,
          adminHeroHeading: settings.admin_hero_heading,
          adminHeroSubheading: settings.admin_hero_subheading,
          reviewUrl: settings.review_url
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
                label="Allow new DJ self-registration with an invite code"
                checked={settings.allow_dj_self_registration}
                onChange={(v) => setSettings((s) => s && { ...s, allow_dj_self_registration: v })}
              />
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

            <GlassCard className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold">Reviews</p>
                <p className="text-xs text-muted">Used by the &ldquo;Post-Event Review Request&rdquo; automation (Library → Automations) — it&rsquo;s seeded off by default until you set this and confirm the email copy.</p>
              </div>
              <Field
                label="Review link"
                value={settings.review_url ?? ""}
                onChange={(v) => setSettings((s) => s && { ...s, review_url: v || null })}
                placeholder="Your Google Business / The Knot / WeddingWire review link"
              />
            </GlassCard>

            <GlassCard className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <ImageIcon size={18} className="shrink-0 text-gold" />
                <div>
                  <p className="text-sm font-semibold">Branding — Hero Banners</p>
                  <p className="text-xs text-muted">Optional banners at the top of the client portal home and the admin dashboard. Leave blank to show nothing.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Client Portal</p>
                  <HeroImageUpload
                    imageUrl={settings.portal_hero_image_url}
                    uploading={uploading === "portal"}
                    onUpload={(f) => uploadHeroImage("portal", f)}
                    onClear={() => clearHeroImage("portal")}
                  />
                  <CopyFieldWithAI
                    label="Heading"
                    value={settings.portal_hero_heading ?? ""}
                    placeholder={`e.g. "${HERO_COPY_EXAMPLES.portal.heading}"`}
                    onChange={(v) => setSettings((s) => s && { ...s, portal_hero_heading: v || null })}
                    onGenerate={() => generateHeroCopy("portal", "heading")}
                    generating={generating === "portal-heading"}
                  />
                  <CopyFieldWithAI
                    label="Subheading"
                    value={settings.portal_hero_subheading ?? ""}
                    placeholder={`e.g. "${HERO_COPY_EXAMPLES.portal.subheading}"`}
                    onChange={(v) => setSettings((s) => s && { ...s, portal_hero_subheading: v || null })}
                    onGenerate={() => generateHeroCopy("portal", "subheading")}
                    generating={generating === "portal-subheading"}
                  />
                  <HeroBanner imageUrl={settings.portal_hero_image_url} heading={settings.portal_hero_heading} subheading={settings.portal_hero_subheading} />
                  {settings.portal_hero_image_url && (
                    <HeroCropControls
                      photoUrl={settings.portal_hero_image_url}
                      settings={mergeHeroSettings(settings.portal_hero_settings)}
                      onChange={(v) => setSettings((s) => s && { ...s, portal_hero_settings: v })}
                      previewLabel="Default Portal Hero"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Admin Dashboard</p>
                  <HeroImageUpload
                    imageUrl={settings.admin_hero_image_url}
                    uploading={uploading === "admin"}
                    onUpload={(f) => uploadHeroImage("admin", f)}
                    onClear={() => clearHeroImage("admin")}
                  />
                  <CopyFieldWithAI
                    label="Heading"
                    value={settings.admin_hero_heading ?? ""}
                    placeholder={`e.g. "${HERO_COPY_EXAMPLES.admin.heading}"`}
                    onChange={(v) => setSettings((s) => s && { ...s, admin_hero_heading: v || null })}
                    onGenerate={() => generateHeroCopy("admin", "heading")}
                    generating={generating === "admin-heading"}
                  />
                  <CopyFieldWithAI
                    label="Subheading"
                    value={settings.admin_hero_subheading ?? ""}
                    placeholder={`e.g. "${HERO_COPY_EXAMPLES.admin.subheading}"`}
                    onChange={(v) => setSettings((s) => s && { ...s, admin_hero_subheading: v || null })}
                    onGenerate={() => generateHeroCopy("admin", "subheading")}
                    generating={generating === "admin-subheading"}
                  />
                  <HeroBanner imageUrl={settings.admin_hero_image_url} heading={settings.admin_hero_heading} subheading={settings.admin_hero_subheading} />
                </div>
              </div>
            </GlassCard>

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
