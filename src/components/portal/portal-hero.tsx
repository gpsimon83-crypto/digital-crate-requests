"use client";

import Image from "next/image";
import { CalendarDays } from "lucide-react";
import { mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";
import { computeCountdown } from "@/lib/portal-countdown";

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
  heroSettings: Partial<HeroSettings> | null;
  headline: string | null;
  displayName: string | null;
  eventDateLabel: string | null;
  venueName: string | null;
  tagline?: string | null;
}) {
  if (!imageUrl) return null;
  const settings = mergeHeroSettings(heroSettings);

  return (
    <div className="relative h-[240px] w-full overflow-hidden sm:h-[300px] lg:h-[340px]">
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
        <p className="absolute right-[4%] top-6 max-w-[16ch] text-right text-[10px] font-semibold uppercase leading-relaxed tracking-[2px] text-white/80">
          {tagline}
        </p>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-[4%] pb-9">
        {headline && <p className="text-[11px] font-semibold uppercase tracking-[3px] text-white/90">{headline}</p>}
        <span className="h-px w-10 bg-gold" />
        {displayName && <p className="font-display text-3xl italic text-white sm:text-4xl">{displayName}</p>}
        {(eventDateLabel || venueName) && (
          <p className="text-xs font-medium uppercase tracking-[2px] text-white/80">
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
