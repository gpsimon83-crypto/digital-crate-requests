"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { DEFAULT_HERO_SETTINGS, mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";

function BackToBookings() {
  return (
    <Link
      href="/dj-dashboard/bookings"
      className="flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-white/25 hover:text-foreground"
    >
      <ArrowLeft size={14} /> Back to Bookings
    </Link>
  );
}

interface DjRecord {
  id: string;
  display_name: string;
  photo_url: string | null;
  hero_settings: Partial<HeroSettings> | null;
}

export default function DjProfilePage() {
  const [dj, setDj] = useState<DjRecord | null>(null);
  const [settings, setSettings] = useState<HeroSettings>(DEFAULT_HERO_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/dj/profile");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load profile");
      setDj(data.dj);
      setSettings(mergeHeroSettings(data.dj.hero_settings));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dj/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroSettings: settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoSelected(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/dj/profile", { method: "PATCH", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload photo");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  if (!dj) {
    return (
      <>
        <PageHeader
          title="My Profile"
          subtitle="Manage your photo and how your hero appears on event pages."
          action={<BackToBookings />}
        />
        <p className="p-6 text-sm text-muted">{error ?? "Loading..."}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="My Profile"
        subtitle="Manage your photo and how your hero appears on event pages."
        action={<BackToBookings />}
      />
      <div className="flex flex-col gap-6 p-6">
        {error && <p className="text-xs text-status-declined">{error}</p>}

        <GlassCard className="flex items-center gap-4">
          <DjAvatar name={dj.display_name} photoUrl={dj.photo_url} size={64} />
          <div className="flex-1">
            <p className="font-semibold">{dj.display_name}</p>
            <p className="text-xs text-muted">This photo is used across the DJ Portal and as your event hero image.</p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhotoSelected(file);
              e.target.value = "";
            }}
          />
          <NeonButton
            color="gold"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="shrink-0 px-4 py-2 text-xs"
          >
            {uploading ? "Uploading..." : "Change Photo"}
          </NeonButton>
        </GlassCard>

        {/* Live preview */}
        <GlassCard className="!p-0 overflow-hidden">
          <div className="relative h-[220px] w-full overflow-hidden">
            {dj.photo_url ? (
              <Image
                src={dj.photo_url}
                alt={dj.display_name}
                fill
                sizes="500px"
                className="object-cover"
                style={{ objectPosition: `${settings.xPosition}% ${settings.yPosition}%`, transform: `scale(${settings.zoom / 100})` }}
              />
            ) : (
              <div
                className="h-full w-full"
                style={{
                  background:
                    "radial-gradient(120% 140% at 85% 0%, rgba(240,185,74,0.16), transparent 60%), linear-gradient(160deg, #1a1610 0%, #0d0d0d 55%, #0a0a0a 100%)",
                }}
              />
            )}
            <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${settings.overlayDarkness / 100})` }} />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 45%, transparent 75%)" }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%]"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.97) 0%, transparent 100%)" }}
            />
            <div className="absolute bottom-4 left-4">
              <span className="w-fit rounded-full border border-gold/50 bg-black/30 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[2px] text-gold backdrop-blur-sm">
                Live Preview
              </span>
              <p className="gold-text-gradient mt-2 text-2xl font-extrabold">Sample Event</p>
              <p className="text-xs text-white/85">with {dj.display_name}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col gap-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Hero Image Controls</p>
          <SliderRow
            label="Horizontal Position"
            value={settings.xPosition}
            min={0}
            max={100}
            onChange={(v) => setSettings((s) => ({ ...s, xPosition: v }))}
          />
          <SliderRow
            label="Vertical Position"
            value={settings.yPosition}
            min={0}
            max={100}
            onChange={(v) => setSettings((s) => ({ ...s, yPosition: v }))}
          />
          <SliderRow
            label="Zoom"
            value={settings.zoom}
            min={100}
            max={180}
            suffix="%"
            onChange={(v) => setSettings((s) => ({ ...s, zoom: v }))}
          />
          <SliderRow
            label="Overlay Darkness"
            value={settings.overlayDarkness}
            min={0}
            max={80}
            suffix="%"
            onChange={(v) => setSettings((s) => ({ ...s, overlayDarkness: v }))}
          />

          <div className="flex items-center gap-3">
            <NeonButton color="gold" onClick={handleSave} disabled={saving} className="w-full sm:w-fit">
              {saving ? "Saving..." : "Save Hero Settings"}
            </NeonButton>
            {saved && <span className="text-xs text-status-approved">Saved</span>}
            <button
              onClick={() => setSettings(DEFAULT_HERO_SETTINGS)}
              className="ml-auto rounded-full border border-white/15 px-4 py-2 text-xs text-muted hover:text-foreground"
            >
              Restore Default
            </button>
          </div>
        </GlassCard>
      </div>
    </>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  suffix = "",
  onChange,
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
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-gold"
      />
    </label>
  );
}
