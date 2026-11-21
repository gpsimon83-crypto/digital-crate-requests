"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, FileText, Pencil, Plus, AlertTriangle } from "lucide-react";
import { BRIEF_FIELDS, fmtGigDate, fmtHours, recurrenceLong } from "@/lib/residency";
import { cn } from "@/lib/utils";
import { GigChip } from "./residency-header";
import type { ResGig, ResidencyData } from "./types";

const card = "rounded-[16px] border border-border bg-card/90 shadow-[var(--shadow-card)] backdrop-blur-sm";

function GigRows({ gigs, highlightId, onOpen, today }: { gigs: ResGig[]; highlightId: string | null; onOpen: (g: ResGig) => void; today: string }) {
  return (
    <>
      {/* Desktop / tablet: a table */}
      <table className="hidden w-full text-left sm:table">
        <thead>
          <tr className="text-[11px] uppercase tracking-[2.5px] text-foreground/75">
            <th className="px-4 py-3 font-semibold">Date</th>
            <th className="px-4 py-3 font-semibold">Set time</th>
            <th className="px-4 py-3 font-semibold">DJ</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {gigs.map((g) => (
            <tr
              key={g.id}
              tabIndex={0}
              onClick={() => onOpen(g)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(g))}
              data-gig={g.gig_date}
              aria-label={`${fmtGigDate(g.gig_date)}, ${g.status.label}. Open details`}
              className={cn(
                "cursor-pointer border-t border-border text-[16px] transition-colors hover:bg-panel/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold",
                g.id === highlightId && "bg-[color-mix(in_srgb,var(--gold)_7%,var(--panel))]",
                g.outcome === "canceled" && "text-muted"
              )}
            >
              <td className="px-4 py-3.5">
                <span className={cn(g.outcome === "canceled" && "line-through")}>{fmtGigDate(g.gig_date)}</span>
                {(g.off_schedule || g.notes || g.change_note) && (
                  <span className="mt-0.5 block text-[11px] text-muted">{g.off_schedule ? "Off the schedule now" : g.change_note ? g.change_note : "Note for this night"}</span>
                )}
              </td>
              <td className="px-4 py-3.5">{fmtHours(g.start_time, g.end_time)}</td>
              <td className="px-4 py-3.5">{g.djName ?? "—"}</td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-2">
                  <GigChip status={g.status} />
                  {g.issueOpen && <AlertTriangle size={15} className="text-status-pending" aria-label="Issue flagged" />}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Phone: one row per date, the date and status on top */}
      <ul className="flex flex-col sm:hidden">
        {gigs.map((g) => (
          <li key={g.id}>
            <button
              onClick={() => onOpen(g)}
              data-gig={g.gig_date}
              className={cn("flex w-full flex-col gap-1.5 border-t border-border px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold", g.id === highlightId && "bg-[color-mix(in_srgb,var(--gold)_7%,var(--panel))]")}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={cn("text-[16px] font-semibold", g.outcome === "canceled" && "text-muted line-through")}>{fmtGigDate(g.gig_date)}</span>
                <GigChip status={g.status} className="text-xs" />
              </span>
              <span className="flex items-center justify-between gap-2 text-sm text-foreground/80">
                <span>{fmtHours(g.start_time, g.end_time)}</span>
                <span>{g.djName ?? "No DJ yet"}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!gigs.length && <p className="border-t border-border px-4 py-5 text-sm text-muted">{today ? "Nothing here yet." : ""}</p>}
    </>
  );
}

export function CoverageTab({ data, onOpen, onSchedule, onEditSchedule, briefHref, recapsHref }: { data: ResidencyData; onOpen: (g: ResGig) => void; onSchedule: () => void; onEditSchedule: () => void; briefHref: string; recapsHref: string }) {
  const [view, setView] = useState<"next" | "all" | "past">("next");
  const upcoming = data.gigs.filter((g) => g.gig_date >= data.today);
  const past = data.gigs.filter((g) => g.gig_date < data.today).reverse();
  const shown = view === "next" ? upcoming.slice(0, 6) : view === "all" ? upcoming : past;
  const prior = data.gigs.find((g) => g.id === data.priorGigId) ?? null;
  const latest = data.recaps[0] ?? null;
  const filled = BRIEF_FIELDS.filter((f) => data.brief[f.key]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
      <section className={cn(card, "overflow-hidden")} data-tour="upcoming-gigs" aria-labelledby="upcoming-h">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-3 pt-4 sm:px-5">
          <h2 id="upcoming-h" className="font-display text-[28px] leading-none">
            {view === "past" ? "Past gigs" : "Upcoming gigs"}
          </h2>
          {prior && view !== "past" && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-foreground/85">
              <span>Prior gig: {fmtGigDate(prior.gig_date)}</span>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1">
                {prior.outcome === "played" ? "Played" : prior.coverage === "confirmed" ? "Not marked played" : "Not covered"}
                {prior.outcome === "played" && <Check size={14} className="text-gold" />}
              </span>
              {prior.outcome === "played" && (
                <span className="flex items-center gap-1">
                  {prior.recapId ? "Recap submitted" : "Recap due"}
                  {prior.recapId && <Check size={14} className="text-gold" />}
                </span>
              )}
            </p>
          )}
        </div>
        <GigRows gigs={shown} highlightId={view === "past" ? null : data.nextGigId} onOpen={onOpen} today={data.today} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-sm sm:px-5">
          {view !== "all" && upcoming.length > 6 && (
            <button onClick={() => setView("all")} className="font-medium text-gold hover:underline">
              Full schedule ({upcoming.length})
            </button>
          )}
          {view !== "next" && (
            <button onClick={() => setView("next")} className="font-medium text-gold hover:underline">
              Next six
            </button>
          )}
          {view !== "past" && past.length > 0 && (
            <button onClick={() => setView("past")} className="font-medium text-gold hover:underline">
              Past gigs ({past.length})
            </button>
          )}
          <span className="ml-auto flex gap-2">
            <button onClick={onEditSchedule} data-tour="edit-schedule" className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-xs hover:border-gold">
              <Pencil size={12} /> Edit schedule
            </button>
            <button onClick={onSchedule} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-xs hover:border-gold">
              <Plus size={12} /> Add a date
            </button>
          </span>
        </div>
        <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted sm:px-5">{recurrenceLong(data.residency)} · dates are added 4 months ahead</p>
      </section>

      <div className="flex flex-col gap-6">
        <section className={cn(card, "px-5 pb-2 pt-4")} aria-labelledby="brief-h">
          <div className="flex items-center justify-between gap-2">
            <h2 id="brief-h" className="font-display text-[28px] leading-none">
              Venue brief
            </h2>
            <Link href={briefHref} className="text-xs font-medium text-gold hover:underline">
              Edit
            </Link>
          </div>
          {filled.length ? (
            <dl className="mt-3">
              {filled.map((f) => (
                <div key={f.key} className="grid gap-1 border-t border-border py-3 sm:grid-cols-[150px_1fr] sm:gap-4">
                  <dt className="text-[11px] font-semibold uppercase tracking-[2.5px] text-foreground/75">{f.label}</dt>
                  <dd className="whitespace-pre-line text-[14px] leading-relaxed">{data.brief[f.key]}</dd>
                </div>
              ))}
              {data.pins.length > 0 && (
                <div className="grid gap-1 border-t border-border py-3 sm:grid-cols-[150px_1fr] sm:gap-4">
                  <dt className="text-[11px] font-semibold uppercase tracking-[2.5px] text-foreground/75">From recaps</dt>
                  <dd className="text-[14px] leading-relaxed">
                    <ul className="flex flex-col gap-1">
                      {data.pins.slice(-3).map((p) => (
                        <li key={p.id}>{p.text}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-3 border-t border-border py-4 text-sm text-muted">
              No standing instructions yet.{" "}
              <Link href={briefHref} className="text-gold hover:underline">
                Write the brief
              </Link>{" "}
              so every DJ gets load-in, house gear and music direction.
            </p>
          )}
        </section>

        <section className={cn(card, "px-5 py-4")} aria-labelledby="recap-h">
          <div className="flex items-center justify-between gap-2">
            <h2 id="recap-h" className="font-display text-[28px] leading-none">
              Latest recap
            </h2>
            {latest && (
              <Link href={`${recapsHref}&recap=${latest.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:underline">
                Open recap <ArrowRight size={15} />
              </Link>
            )}
          </div>
          {latest ? (
            <p className="mt-3 flex items-start gap-2.5 text-[15px] leading-relaxed">
              <FileText size={17} className="mt-0.5 shrink-0 opacity-80" />
              <span>
                The room picked up {latest.picked_up.replace(/^(at|around)\s/i, (m) => m.toLowerCase())}. {latest.worked}
                <span className="mt-1 block text-xs text-muted">
                  {latest.gig_date ? fmtGigDate(latest.gig_date) : ""}
                  {latest.djName ? ` · ${latest.djName}` : ""}
                  {latest.issue && !latest.issue_resolved_at ? " · issue flagged" : ""}
                </span>
              </span>
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">No recaps yet. The DJ gets three quick questions after each gig.</p>
          )}
        </section>
      </div>
    </div>
  );
}
