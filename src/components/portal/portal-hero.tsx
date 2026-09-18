"use client";

import Image from "next/image";
import { CalendarDays } from "lucide-react";
import { mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";
import type { PortalHeroBannerSize, PortalHeroExtras } from "@/components/project/portal-hero-panel";
import { computeCountdown } from "@/lib/portal-countdown";

const BANNER_HEIGHT_CLASSES: Record<PortalHeroBannerSize, string> = {
  compact: "h-[180px] sm:h-[220px] lg:h-[260px]",
  standard: "h-[240px] sm:h-[300px] lg:h-[340px]",
  tall: "h-[320px] sm:h-[380px] lg:h-[440px]"
};

/** rgba() at the given alpha for a #rrggbb color — used to keep the secondary hero lines lighter than the main name, whatever color is picked. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(255,255,255,${alpha})`;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Full-bleed (edge-to-edge) photo band — render outside any max-width container. */
export function PortalHeroPhoto({
  imageUrl,
  heroSettings,
  headline,
  displayName,
  eventDateLabel,
  venueName,
  tagline
}: {
  imageUrl: string | null;
  heroSettings: (Partial<HeroSettings> & PortalHeroExtras) | null;
  headline: string | null;
  displayName: string | null;
  eventDateLabel: string | null;
  venueName: string | null;
  tagline?: string | null;
}) {
  if (!imageUrl) return null;
  const settings = mergeHeroSettings(heroSettings);
  const bannerSize = heroSettings?.bannerSize ?? "standard";
  const textColor = heroSettings?.textColor ?? "#ffffff";

  return (
    <div className={`relative w-full overflow-hidden ${BANNER_HEIGHT_CLASSES[bannerSize]}`}>
      <Image
        src={imageUrl}
        alt=""
        fill
        sizes="100vw"
        priority
        className="object-cover"
        style={{ objectPosition: `${settings.xPosition}% ${settings.yPosition}%`, transform: `scale(${settings.zoom / 100})` }}
      />
      <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: `rgba(10,8,4,${settings.overlayDarkness / 100})` }} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(10,8,4,0.7) 0%, rgba(10,8,4,0.15) 55%, transparent 85%)" }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
        style={{ background: "linear-gradient(to top, var(--background), transparent)" }}
      />

      {tagline && (
        <p
          className="absolute right-[4%] top-6 max-w-[16ch] text-right text-[10px] font-semibold uppercase leading-relaxed tracking-[2px]"
          style={{ color: withAlpha(textColor, 0.8) }}
        >
          {tagline}
        </p>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-[4%] pb-9">
        {headline && (
          <p className="text-[11px] font-semibold uppercase tracking-[3px]" style={{ color: withAlpha(textColor, 0.9) }}>
            {headline}
          </p>
        )}
        <span className="h-px w-10 bg-gold" />
        {displayName && (
          <p className="font-display text-3xl italic sm:text-4xl" style={{ color: textColor }}>
            {displayName}
          </p>
        )}
        {(eventDateLabel || venueName) && (
          <p className="text-xs font-medium uppercase tracking-[2px]" style={{ color: withAlpha(textColor, 0.8) }}>
            {eventDateLabel}
            {eventDateLabel && venueName ? " · " : ""}
            {venueName}
          </p>
        )}
      </div>
    </div>
  );
}

/** Welcome + countdown row — sits inside the normal content container, right below the full-bleed photo. */
export function PortalWelcomeRow({ firstName, startsAt, timezone }: { firstName: string | null; startsAt: string | null; timezone: string | null }) {
  const countdown = computeCountdown(startsAt, timezone);

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-display text-3xl font-light">
          Welcome back{firstName ? <>, <em className="not-italic font-medium">{firstName}</em></> : ""}.
        </p>
        <p className="mt-1 text-sm text-muted">Every detail, all in one place.</p>
      </div>
      {countdown && (
        <div className="flex items-center gap-3 border-l border-border pl-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold-dim">
            <CalendarDays size={17} />
          </span>
          <div>
            <p className="font-display text-3xl font-semibold leading-none text-gold-dim">{countdown.days === 0 ? "🎉" : countdown.days}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {countdown.days === 0 ? countdown.label : countdown.days === 1 ? "day to go" : "days to go"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
