"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Hourglass, MapPin, Sparkles } from "lucide-react";
import { mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";
import { computeCountdown } from "@/lib/portal-countdown";

/**
 * Split event header for the client portal: the event's banner photo (sharp,
 * with the crop set in Customize Portal) on the left; the title, date,
 * countdown and Build Your Package link on the right. Stacks on phones.
 */
export function PortalEventHeader({
  imageUrl,
  heroSettings,
  fallbackImage,
  eyebrow,
  title,
  startsAt,
  timezone,
  venueName,
  packageHref
}: {
  imageUrl: string | null;
  heroSettings: Partial<HeroSettings> | null;
  /** Shown when there's no banner (weddings: the vineyard photo). */
  fallbackImage: string | null;
  eyebrow: string;
  title: string;
  startsAt: string | null;
  timezone: string | null;
  venueName: string | null;
  packageHref: string;
}) {
  const settings = mergeHeroSettings(heroSettings);
  const countdown = computeCountdown(startsAt, timezone);
  const date = startsAt ? new Date(startsAt).toLocaleDateString(undefined, { timeZone: timezone ?? undefined, weekday: "long", month: "long", day: "numeric", year: "numeric" }) : null;
  const photo = imageUrl ?? fallbackImage;

  return (
    <header className="grid overflow-hidden rounded-[18px] border border-border bg-card shadow-[var(--shadow-card)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="relative aspect-[16/9] w-full bg-panel lg:aspect-auto lg:min-h-[320px]">
        {photo ? (
          <Image
            src={photo}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
            style={imageUrl ? { objectPosition: `${settings.xPosition}% ${settings.yPosition}%`, transform: `scale(${settings.zoom / 100})` } : { objectPosition: "50% 40%" }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(120%_90%_at_30%_20%,var(--gold-soft),transparent_70%)]">
            <Sparkles size={36} strokeWidth={1.2} className="text-gold/70" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center gap-4 bg-[var(--header-panel)] px-6 py-7 text-[var(--header-fg)] sm:px-9 sm:py-9">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[3px] text-[var(--header-accent)]">{eyebrow}</p>
          <span className="mt-3 block h-px w-10 bg-[var(--header-accent)]" aria-hidden />
        </div>
        <h1 className="font-display text-4xl leading-[1.08] sm:text-[46px]">{title}</h1>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
          <span className="flex items-center gap-2">
            <CalendarDays size={17} strokeWidth={1.6} className="opacity-80" aria-hidden />
            {date ?? "Date to be confirmed"}
          </span>
          {venueName && (
            <span className="flex items-center gap-2">
              <MapPin size={17} strokeWidth={1.6} className="opacity-80" aria-hidden /> {venueName}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-[color-mix(in_srgb,var(--header-fg)_16%,transparent)] pt-5">
          {countdown && (
            <div className="flex items-center gap-3">
              <Hourglass size={20} strokeWidth={1.5} className="text-[var(--header-accent)]" aria-hidden />
              <p>
                <span className="font-display text-3xl leading-none">{countdown.days === 0 ? "Today" : countdown.days}</span>
                <span className="ml-2 text-[11px] font-semibold uppercase tracking-[2px] text-[var(--header-muted)]">{countdown.days === 0 ? countdown.label : countdown.days === 1 ? "day to go" : "days to go"}</span>
              </p>
            </div>
          )}
          <Link
            href={packageHref}
            className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border border-[color-mix(in_srgb,var(--header-fg)_30%,transparent)] px-3.5 py-2 text-sm font-medium transition-colors hover:border-[var(--header-accent)] hover:text-[var(--header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--header-accent)]"
          >
            Build Your Package <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </header>
  );
}
