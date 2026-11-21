"use client";

import { CalendarDays, Check, Clock, ImagePlus, MapPin, Repeat2, User, UserPlus, Clock3, ArrowRight } from "lucide-react";
import { fmtGigDate, fmtHours, recurrenceLabel } from "@/lib/residency";
import { cn } from "@/lib/utils";
import type { ResGig, ResidencyData } from "./types";

const CHIP: Record<string, string> = {
  neutral: "border-border bg-panel/70 text-foreground/80",
  approved: "border-[color-mix(in_srgb,var(--gold)_55%,transparent)] bg-gold-soft text-gold",
  pending: "border-status-pending/60 bg-status-pending/10 text-status-pending",
  declined: "border-status-declined/50 bg-status-declined/10 text-status-declined",
  info: "border-border bg-panel text-muted"
};

/** Outlined status pill for a gig (Unassigned / Awaiting confirmation / Confirmed / …). */
export function GigChip({ status, className }: { status: ResGig["status"]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-[13px]", CHIP[status.tone], className)}>
      {status.tone === "approved" && <Check size={13} />}
      {status.tone === "pending" && <Clock3 size={13} />}
      {status.label}
    </span>
  );
}

/**
 * Split header for a recurring Bar / Club booking: the venue photo on the
 * left; venue, the night's name and a compact facts line on the right.
 */
export function ResidencyHeader({ data, projectPhoto, onAddPhoto }: { data: ResidencyData; projectPhoto: string | null; onAddPhoto: () => void }) {
  const r = data.residency;
  const photo = data.venue?.cover_url ?? projectPhoto;
  const place = [data.venue?.city, data.venue?.state].filter(Boolean).join(", ") || data.venue?.location || null;
  return (
    <header data-tour="residency-header" className="mx-4 mt-4 grid gap-6 sm:mx-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:items-center">
      <div
        className={cn("relative aspect-[16/8] w-full overflow-hidden rounded-[16px] border border-border bg-cover bg-center shadow-[var(--shadow-card)] lg:aspect-[16/6.6]", !photo && "bg-panel")}
        style={photo ? { backgroundImage: `url(${photo})` } : { backgroundImage: "radial-gradient(120% 90% at 30% 20%, var(--gold-soft), transparent 70%)" }}
        role={photo ? "img" : undefined}
        aria-label={photo ? `${data.venue?.name ?? "Venue"} photo` : undefined}
      >
        {!photo && (
          <button onClick={onAddPhoto} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted hover:text-foreground">
            <ImagePlus size={28} strokeWidth={1.4} className="text-gold" /> Add a photo
            <span className="text-xs">or upload the venue&rsquo;s cover photo on its venue record</span>
          </button>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[3px] text-gold">Project detail</p>
        <h1 className="mt-2 font-display text-4xl leading-[1.08] sm:text-[52px]">{data.venue?.name ?? "Venue not linked"}</h1>
        <p className="mt-1 font-display text-2xl italic text-foreground/90 sm:text-[34px]">{r.name}</p>
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] text-foreground/90 sm:text-[17px]">
          {place && (
            <>
              <span className="flex items-center gap-2">
                <MapPin size={18} strokeWidth={1.6} className="opacity-80" /> {place}
              </span>
              <span aria-hidden className="text-muted">•</span>
            </>
          )}
          <span className="flex items-center gap-2">
            <Clock size={18} strokeWidth={1.6} className="opacity-80" /> {fmtHours(r.start_time, r.end_time)}
          </span>
          <span aria-hidden className="text-muted">•</span>
          <span className="flex items-center gap-2">
            <Repeat2 size={18} strokeWidth={1.6} className="opacity-80" /> {r.active ? recurrenceLabel(r) : "Paused"}
          </span>
        </p>
      </div>
    </header>
  );
}

/**
 * Full-width strip with the earliest upcoming gig that isn't canceled, its
 * hours and DJ coverage, and the one action that fits.
 */
export function NextGigStrip({ data, onOpen, onSchedule }: { data: ResidencyData; onOpen: (gig: ResGig, focus?: "dj") => void; onSchedule: () => void }) {
  const g = data.gigs.find((x) => x.id === data.nextGigId) ?? null;
  const primary = "inline-flex shrink-0 items-center justify-center gap-2 rounded-[12px] px-5 py-3 text-[15px] font-semibold text-[var(--on-gold)] shadow-[0_8px_22px_-12px_var(--gold)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";
  return (
    <div data-tour="next-gig" className="flex flex-col gap-3 rounded-[16px] border border-border bg-card/90 px-4 py-4 shadow-[var(--shadow-card)] backdrop-blur-sm sm:flex-row sm:items-center sm:gap-0 sm:px-6">
      <p className="flex items-center gap-2.5 text-[15px] text-foreground/85 sm:pr-6 sm:text-[17px]">
        <CalendarDays size={20} strokeWidth={1.6} /> Next gig
      </p>
      {g ? (
        <>
          <p className="font-display text-2xl sm:border-l sm:border-border sm:px-8 sm:text-[28px]">
            {fmtGigDate(g.gig_date)} · {fmtHours(g.start_time, g.end_time)}
          </p>
          <p className="flex min-w-0 items-center gap-2.5 text-[15px] text-foreground/90 sm:flex-1 sm:border-l sm:border-border sm:px-8 sm:text-[17px]">
            <User size={19} strokeWidth={1.6} className="shrink-0" />
            {g.coverage === "unassigned" ? "DJ unassigned" : g.coverage === "awaiting" ? `${g.djName} · awaiting confirmation` : `${g.djName} · confirmed`}
          </p>
          {g.coverage === "unassigned" ? (
            <button className={primary} style={{ background: "var(--gold)" }} onClick={() => onOpen(g, "dj")}>
              <UserPlus size={18} /> Assign DJ
            </button>
          ) : (
            <button className={primary} style={{ background: "var(--gold)" }} onClick={() => onOpen(g)}>
              {g.coverage === "awaiting" ? "View assignment" : "Open gig"} <ArrowRight size={17} />
            </button>
          )}
        </>
      ) : (
        <>
          <p className="font-display text-2xl text-muted sm:flex-1 sm:border-l sm:border-border sm:px-8">No upcoming gigs</p>
          <button className={primary} style={{ background: "var(--gold)" }} onClick={onSchedule}>
            <CalendarDays size={18} /> Schedule gig
          </button>
        </>
      )}
    </div>
  );
}
