"use client";

import Image from "next/image";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { DEFAULT_HERO_SETTINGS, type HeroSettings } from "@/lib/hero-settings";

/**
 * The position/zoom/overlay-darkness slider set + live preview, shared by
 * every hero-image editor in the app (DJ hero, per-event hero override,
 * the platform-wide default portal hero) — one implementation instead of
 * three copies of the same four sliders.
 */
export function HeroCropControls({
  photoUrl,
  settings,
  onChange,
  previewLabel = "Sample Event",
  previewName,
  previewHeightClass = "h-[180px]",
  previewTextColor = "#ffffff"
}: {
  photoUrl: string | null;
  settings: HeroSettings;
  onChange: (settings: HeroSettings) => void;
  previewLabel?: string;
  previewName?: string | null;
  /** Lets a caller show the preview at a height proportional to a real banner-size setting it owns (e.g. the portal hero's Compact/Standard/Tall) — this component has no concept of that itself. */
  previewHeightClass?: string;
  /** Same idea, for a caller-owned text-color setting. */
  previewTextColor?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <GlassCard className="!p-0 overflow-hidden">
        <div className={`relative w-full overflow-hidden ${previewHeightClass}`}>
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt="Hero preview"
              fill
              sizes="500px"
              className="object-cover"
              style={{ objectPosition: `${settings.xPosition}% ${settings.yPosition}%`, transform: `scale(${settings.zoom / 100})` }}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: "linear-gradient(155deg, var(--gold-light), var(--gold) 55%, var(--gold-dim))" }}
            />
          )}
          <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${settings.overlayDarkness / 100})` }} />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 45%, transparent 75%)" }}
          />
          <div className="absolute bottom-3 left-4">
            <span className="w-fit rounded-full border border-gold/50 bg-black/30 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[2px] text-gold backdrop-blur-sm">
              Live Preview
            </span>
            <p className="mt-1.5 text-lg font-semibold" style={{ color: previewTextColor }}>{previewLabel}</p>
            {previewName && <p className="text-xs opacity-80" style={{ color: previewTextColor }}>{previewName}</p>}
          </div>
        </div>
      </GlassCard>

      <SliderRow label="Horizontal Position" value={settings.xPosition} min={0} max={100} onChange={(v) => onChange({ ...settings, xPosition: v })} />
      <SliderRow label="Vertical Position" value={settings.yPosition} min={0} max={100} onChange={(v) => onChange({ ...settings, yPosition: v })} />
      <SliderRow label="Zoom" value={settings.zoom} min={100} max={180} suffix="%" onChange={(v) => onChange({ ...settings, zoom: v })} />
      <SliderRow label="Overlay Darkness" value={settings.overlayDarkness} min={0} max={80} suffix="%" onChange={(v) => onChange({ ...settings, overlayDarkness: v })} />

      <Button variant="secondary" size="sm" onClick={() => onChange(DEFAULT_HERO_SETTINGS)} className="w-fit">
        Restore Default
      </Button>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  suffix = "",
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center justify-between text-xs uppercase tracking-wide text-muted">
        {label}
        <span className="text-gold">
          {value}
          {suffix}
        </span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-gold" />
    </label>
  );
}
