"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { HeroCropControls } from "@/components/ui/hero-crop-controls";
import { cn } from "@/lib/utils";
import { mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";
import { PORTAL_THEMES, backdropSettings, resolvePortalTheme, type PortalThemeId } from "@/lib/portal-themes";
import { EVENT_CATEGORY_LABELS, type EventCategory } from "@/lib/event-category";

export type PortalHeroBannerSize = "compact" | "standard" | "tall";

// Portal-hero-only extras, stored alongside the shared HeroSettings
// fields in the same portal_hero_settings JSON blob — kept out of
// src/lib/hero-settings.ts and HeroCropControls on purpose, since those
// are shared with the DJ hero editor, which has no rendering path that
// would ever honor a banner size or text color.
export interface PortalHeroExtras {
  bannerSize?: PortalHeroBannerSize;
  textColor?: string;
  /** Portal palette for this event; unset = the event category's palette (src/lib/portal-themes.ts). */
  portalTheme?: PortalThemeId | null;
  /** Blurred banner backdrop behind the portal, configured separately from the palette. */
  backdrop?: { enabled: boolean; strength: number };
}

const DEFAULT_TEXT_COLOR = "#ffffff";

// Scaled-down versions of the real banner heights (240/300/340 standard,
// see BANNER_HEIGHT_CLASSES in portal-hero.tsx) so this small admin
// thumbnail changes proportionally instead of staying frozen regardless
// of which size is selected.
const PREVIEW_HEIGHT_CLASSES: Record<PortalHeroBannerSize, string> = {
  compact: "h-[130px]",
  standard: "h-[180px]",
  tall: "h-[240px]"
};

interface PortalHeroData {
  couple_display_name: string | null;
  portal_hero_image_url: string | null;
  portal_hero_settings: (Partial<HeroSettings> & PortalHeroExtras) | null;
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
export function PortalHeroPanel({ eventId, initial, eventCategory = null }: { eventId: string; initial: PortalHeroData; eventCategory?: EventCategory | null }) {
  const [data, setData] = useState<PortalHeroData>(initial);
  const [byCategory, setByCategory] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/admin/settings/portal-themes")
      .then((r) => r.json())
      .then((j) => setByCategory(j.byCategory ?? {}))
      .catch(() => {});
  }, []);
  const categoryTheme = resolvePortalTheme(eventCategory, null, byCategory);
  const pick = data.portal_hero_settings?.portalTheme ?? null;
  const backdrop = backdropSettings(data.portal_hero_settings?.backdrop);
  const setExtras = (v: Partial<PortalHeroExtras>) => setData((d) => ({ ...d, portal_hero_settings: { ...d.portal_hero_settings, ...v } }));
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Customize Portal</p>
          <p className="text-xs text-muted">What the client sees in their own portal — separate from the public guest-request page.</p>
        </div>
        <a
          href={`/portal/events/${eventId}`}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-gold hover:underline"
        >
          View Client Portal ↗
        </a>
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
        {!data.portal_hero_image_url && (
          <p className="mt-1.5 text-xs text-muted">Upload a photo to unlock framing, banner size, and text color controls.</p>
        )}
      </div>

      {data.portal_hero_image_url && (
        <>
          <HeroCropControls
            photoUrl={data.portal_hero_image_url}
            settings={mergeHeroSettings(data.portal_hero_settings)}
            onChange={(v) => setData((d) => ({ ...d, portal_hero_settings: { ...d.portal_hero_settings, ...v } }))}
            previewLabel={data.couple_display_name || "Your Event"}
            previewHeightClass={PREVIEW_HEIGHT_CLASSES[data.portal_hero_settings?.bannerSize ?? "standard"]}
            previewTextColor={data.portal_hero_settings?.textColor ?? DEFAULT_TEXT_COLOR}
          />

          <div>
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Banner Size</span>
            <div className="flex w-fit rounded-[10px] border border-black/10 bg-panel p-1">
              {(["compact", "standard", "tall"] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setData((d) => ({ ...d, portal_hero_settings: { ...d.portal_hero_settings, bannerSize: size } }))}
                  className={cn(
                    "rounded-[8px] px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    (data.portal_hero_settings?.bannerSize ?? "standard") === size ? "bg-[#161616] text-white" : "text-muted hover:text-foreground"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <label className="block w-fit">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Text Color</span>
            <div className="flex items-center gap-2 rounded-[10px] border border-black/10 bg-panel px-3 py-2">
              <input
                type="color"
                value={data.portal_hero_settings?.textColor ?? DEFAULT_TEXT_COLOR}
                onChange={(e) => setData((d) => ({ ...d, portal_hero_settings: { ...d.portal_hero_settings, textColor: e.target.value } }))}
                className="h-6 w-8 cursor-pointer border-none bg-transparent p-0"
              />
              <span className="font-mono text-xs text-muted">{data.portal_hero_settings?.textColor ?? DEFAULT_TEXT_COLOR}</span>
              {data.portal_hero_settings?.textColor && (
                <button
                  onClick={() => setData((d) => ({ ...d, portal_hero_settings: { ...d.portal_hero_settings, textColor: undefined } }))}
                  className="ml-1 text-xs text-muted hover:text-foreground"
                >
                  Reset
                </button>
              )}
            </div>
          </label>
        </>
      )}

      <div data-tour="portal-look">
        <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Portal look</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Portal look">
          {[{ id: null as PortalThemeId | null, name: `${eventCategory ? EVENT_CATEGORY_LABELS[eventCategory] : "Event type"} default`, swatch: PORTAL_THEMES.find((t) => t.id === categoryTheme)!.swatch, sub: PORTAL_THEMES.find((t) => t.id === categoryTheme)!.name }, ...PORTAL_THEMES.map((t) => ({ id: t.id as PortalThemeId | null, name: t.name, swatch: t.swatch, sub: null as string | null }))].map((o) => (
            <button
              key={o.id ?? "default"}
              type="button"
              role="radio"
              aria-checked={pick === o.id}
              onClick={() => setExtras({ portalTheme: o.id })}
              className={cn("flex items-center gap-2 rounded-[10px] border px-2.5 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold", pick === o.id ? "border-gold bg-gold-soft" : "border-black/10 hover:border-gold/50")}
            >
              <span className="flex h-5 w-5 shrink-0 overflow-hidden rounded-full border border-black/10" aria-hidden>
                <span className="h-full w-1/2" style={{ background: o.swatch[0] }} />
                <span className="h-full w-1/2" style={{ background: o.swatch[1] }} />
              </span>
              <span>
                <span className="block font-medium">{o.name}</span>
                {o.sub && <span className="block text-[10px] text-muted">{o.sub}</span>}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted">Default per event type is set in Admin → Settings → Client portal looks.</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={backdrop.enabled} onChange={(e) => setExtras({ backdrop: { ...backdrop, enabled: e.target.checked } })} className="h-4 w-4 accent-[var(--gold)]" />
          Blurred photo backdrop
        </label>
        <label className={cn("flex items-center gap-2 text-xs text-muted", !backdrop.enabled && "opacity-50")}>
          Strength
          <input type="range" min={0} max={100} step={5} value={backdrop.strength} disabled={!backdrop.enabled} onChange={(e) => setExtras({ backdrop: { ...backdrop, strength: Number(e.target.value) } })} className="w-32 accent-[var(--gold)]" />
          <span className="w-8 tabular-nums">{backdrop.strength}%</span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={saveFields} disabled={saving} className="w-fit">
          {saving ? "Saving…" : "Save"}
        </Button>
        {saved && <span className="text-xs text-status-approved">Saved</span>}
      </div>
    </GlassCard>
  );
}
