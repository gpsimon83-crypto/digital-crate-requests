"use client";

import { useRef, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { HeroCropControls } from "@/components/ui/hero-crop-controls";
import { mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";

interface PortalHeroData {
  couple_display_name: string | null;
  portal_hero_image_url: string | null;
  portal_hero_settings: Partial<HeroSettings> | null;
  portal_hero_headline_override: string | null;
  portal_hero_subheading_override: string | null;
  timezone: string | null;
}

/**
 * Admin-only "Customize Portal" panel — a separate photo/field set from
 * the guest-request-page hero (events.hero_image_url, DJ-editable
 * elsewhere): this one controls what the booking client sees in their
 * own portal.
 */
export function PortalHeroPanel({ eventId, initial }: { eventId: string; initial: PortalHeroData }) {
  const [data, setData] = useState<PortalHeroData>(initial);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("portalHeroPhoto", file);
      const res = await fetch(`/api/admin/events/${eventId}/portal-hero`, { method: "PATCH", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to upload photo");
      setData((d) => ({ ...d, portal_hero_image_url: json.event.portal_hero_image_url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  async function clearPhoto() {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("clearPortalHero", "true");
      const res = await fetch(`/api/admin/events/${eventId}/portal-hero`, { method: "PATCH", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove photo");
      setData((d) => ({ ...d, portal_hero_image_url: null }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  async function saveFields() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/portal-hero`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coupleDisplayName: data.couple_display_name,
          portalHeroHeadlineOverride: data.portal_hero_headline_override,
          portalHeroSubheadingOverride: data.portal_hero_subheading_override,
          portalHeroSettings: data.portal_hero_settings,
          timezone: data.timezone
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold">Customize Portal</p>
        <p className="text-xs text-muted">What the client sees in their own portal — separate from the public guest-request page.</p>
      </div>

      {error && <p className="text-xs text-status-declined">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Couple / display name" value={data.couple_display_name ?? ""} onChange={(v) => setData((d) => ({ ...d, couple_display_name: v || null }))} placeholder="e.g. Sarah &amp; Michael" />
        <Field label="Timezone" value={data.timezone ?? ""} onChange={(v) => setData((d) => ({ ...d, timezone: v || null }))} placeholder="America/Chicago" />
      </div>
      <Field label="Hero headline override" value={data.portal_hero_headline_override ?? ""} onChange={(v) => setData((d) => ({ ...d, portal_hero_headline_override: v || null }))} placeholder="Falls back to the platform default" />
      <Field label="Hero subheading override" value={data.portal_hero_subheading_override ?? ""} onChange={(v) => setData((d) => ({ ...d, portal_hero_subheading_override: v || null }))} />

      <div>
        <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Hero photo</span>
        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadPhoto(file);
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : data.portal_hero_image_url ? "Replace photo" : "Upload photo"}
          </Button>
          {data.portal_hero_image_url && (
            <Button variant="text" size="sm" onClick={clearPhoto} disabled={uploading}>
              Remove
            </Button>
          )}
        </div>
      </div>

      {data.portal_hero_image_url && (
        <HeroCropControls
          photoUrl={data.portal_hero_image_url}
          settings={mergeHeroSettings(data.portal_hero_settings)}
          onChange={(v) => setData((d) => ({ ...d, portal_hero_settings: v }))}
          previewLabel={data.couple_display_name || "Your Event"}
        />
      )}

      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={saveFields} disabled={saving} className="w-fit">
          {saving ? "Saving…" : "Save"}
        </Button>
        {saved && <span className="text-xs text-status-approved">Saved</span>}
      </div>
    </GlassCard>
  );
}
