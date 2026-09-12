"use client";

import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";
import { mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";

export function DjProfileModal({
  name,
  photoUrl,
  heroSettings,
  bio,
  onClose
}: {
  name: string;
  photoUrl: string | null;
  heroSettings: Partial<HeroSettings> | null;
  bio: string | null;
  onClose: () => void;
}) {
  const settings = mergeHeroSettings(heroSettings);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="relative h-48 w-full">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={name}
              fill
              sizes="400px"
              className="object-cover"
              style={{ objectPosition: `${settings.xPosition}% ${settings.yPosition}%`, transform: `scale(${settings.zoom / 100})` }}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[var(--gold-light)] to-[var(--gold-dim)]" />
          )}
          <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent 50%)" }} />
          <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60">
            <X size={16} />
          </button>
          <p className="absolute bottom-3 left-4 font-display text-2xl italic text-white">{name}</p>
        </div>
        <div className="p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-muted">About your DJ</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{bio || "No bio added yet."}</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
