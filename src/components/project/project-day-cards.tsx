"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Clock, Gem, MapPin, Music2, PartyPopper } from "lucide-react";

type Day = { coverage: string[]; ceremonyLocation: string | null; setting: string | null; setupAccess: string | null; receptionStart: string | null; receptionEnd: string | null; venue: string | null };

const CEREMONY_TITLE: Record<string, string> = {
  "Same room as the reception": "In the reception room",
  "Same venue, different room or area": "At the venue",
  "A different location": "Separate location"
};

/**
 * The day at a glance, below the project tabs: Venue, Ceremony and
 * Reception for weddings (Venue and Event for everything else). Same photo
 * height on every card. Details come from the event and, for weddings, the
 * couple's Wedding Basics answers.
 */
export function ProjectDayCards({
  eventId,
  isWedding,
  venueName,
  venueId,
  heroUrl,
  startsAt,
  endsAt,
  timezone,
  serviceType,
  guests
}: {
  eventId: string;
  isWedding: boolean;
  venueName: string | null;
  venueId: string | null;
  heroUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  serviceType: string | null;
  guests: number | null;
}) {
  const [day, setDay] = useState<Day | null>(null);
  useEffect(() => {
    if (!isWedding) return;
    let live = true;
    fetch(`/api/events/${eventId}/wedding-basics`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && j?.day && setDay(j.day))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [eventId, isWedding]);

  const tz = timezone || undefined;
  const t = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const range = startsAt ? `${t(startsAt)}${endsAt ? ` – ${t(endsAt)}` : ""}` : day?.receptionStart ? `${day.receptionStart}${day.receptionEnd ? ` – ${day.receptionEnd}` : ""}` : null;
  const venue = venueName ?? day?.venue ?? null;
  const base = `/admin/events/${eventId}`;

  const cards: Card[] = [
    {
      key: "venue",
      eyebrow: "Venue",
      Icon: MapPin,
      title: venue ?? "No venue yet",
      bits: [day?.setting, day?.setupAccess],
      photo: heroUrl,
      href: venueId ? `/admin/venues/${venueId}` : `${base}?tab=Details`
    }
  ];
  if (isWedding) {
    const covered = day ? day.coverage.includes("ceremony") : null;
    cards.push({
      key: "ceremony",
      eyebrow: "Ceremony",
      Icon: Gem,
      title: covered === false ? "Not booked with us" : day?.ceremonyLocation ? (CEREMONY_TITLE[day.ceremonyLocation] ?? day.ceremonyLocation) : "Ceremony",
      bits: covered === false ? ["Reception only"] : [day ? (day.ceremonyLocation ? "Ceremony sound + mic" : "Location to confirm") : "Details come from Wedding Basics"],
      photo: "/project/ceremony.jpg",
      href: `${base}?tab=Files#wedding-basics`
    });
    cards.push({
      key: "reception",
      eyebrow: "Reception",
      Icon: PartyPopper,
      title: "Dinner & dancing",
      bits: [range, day?.setting],
      photo: "/project/reception.jpg",
      photoPosition: "70% 50%",
      href: `${base}?tab=Files#wedding-basics`
    });
  } else {
    cards.push({
      key: "event",
      eyebrow: "Event",
      Icon: Music2,
      title: serviceType || "The event",
      bits: [range, guests != null ? `${guests} guests` : null],
      photo: null,
      href: `${base}?tab=Details`
    });
  }

  return (
    <div className={isWedding ? "grid gap-6 md:grid-cols-3" : "grid gap-6 md:grid-cols-2"} data-tour="project-day-cards">
      {cards.map((c) => (
        <Link
          key={c.key}
          href={c.href}
          className="group flex flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)] transition-colors hover:border-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <div className="relative aspect-[16/7] w-full overflow-hidden bg-panel">
            {c.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- banner photos are user uploads on another host
              <img src={c.photo} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" style={{ objectPosition: c.photoPosition ?? "50% 50%" }} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(120%_90%_at_30%_20%,var(--gold-soft),transparent_70%)]">
                <c.Icon size={34} strokeWidth={1.25} className="text-gold/70" />
              </div>
            )}
          </div>
          <div className="flex flex-1 items-center gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm text-gold">
                <c.Icon size={16} strokeWidth={1.75} /> <span className="font-display text-base">{c.eyebrow}</span>
              </p>
              <p className="mt-1 truncate font-display text-[22px] leading-tight">{c.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                {c.bits.filter(Boolean).map((b, i) => (
                  <span key={i} className="flex items-center gap-2">
                    {i > 0 && <span aria-hidden>•</span>}
                    {b === range && range ? (
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {b}
                      </span>
                    ) : (
                      b
                    )}
                  </span>
                ))}
                {!c.bits.some(Boolean) && <span>&nbsp;</span>}
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-muted transition-colors group-hover:text-gold" />
          </div>
        </Link>
      ))}
    </div>
  );
}

type Card = { key: string; eyebrow: string; Icon: typeof MapPin; title: string; bits: (string | null | undefined)[]; photo: string | null; photoPosition?: string; href: string };
