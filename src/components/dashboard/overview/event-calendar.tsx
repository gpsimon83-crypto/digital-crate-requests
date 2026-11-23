"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronRight as Arrow } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashLayout } from "@/lib/dashboard-layout";
import { dayKey, eventsByDay, monthGrid, type DashEvent } from "@/lib/dashboard/overview";
import { CAL_KIND_LABEL, calKind, fromKey, isProjectId, keyMove, monthAgenda, monthOfKey, sameDayIn, sameMonth, timeRange, type CalKind } from "@/lib/dashboard/calendar";
import { Panel, useDashLinks } from "./widgets";

/** Focus ring in the text colour: never the same as the lime "selected" border. */
const RING = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground)]";

const DOT: Record<CalKind, string> = {
  booked: "bg-gold",
  inquiry: "border-[1.5px] border-status-pending bg-transparent",
  away: "bg-muted/60"
};

const PILL: Record<CalKind, string> = {
  booked: "bg-gold text-[var(--on-gold,#1a140a)]",
  inquiry: "border border-status-pending text-status-pending",
  away: "bg-muted/20 text-muted"
};

/** The project's own status, when it says more than Booked/Inquiry (e.g. Pending, Live, Completed). */
const EXTRA_STATUS: Record<string, string> = { pending_confirmation: "Pending confirmation", live: "Live now", ended: "Completed" };

const longDate = (k: string) => fromKey(k).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: fromKey(k).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
const plural = (n: number) => `${n} ${n === 1 ? "event" : "events"}`;

function Dot({ kind, className }: { kind: CalKind; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", DOT[kind], className)} aria-hidden />;
}

function KindPill({ kind }: { kind: CalKind }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", PILL[kind])}>{CAL_KIND_LABEL[kind]}</span>;
}

function EventCard({ e, showDj }: { e: DashEvent; showDj: boolean }) {
  const links = useDashLinks();
  const kind = calKind(e.status);
  const extra = EXTRA_STATUS[e.status];
  const venue = e.venues?.name;
  const dj = showDj ? e.djs?.display_name : null;
  return (
    <li className="rounded-[14px] border border-border bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindPill kind={kind} />
            {extra && <span className="text-[11px] text-muted">{extra}</span>}
          </div>
          <p className="mt-1.5 break-words font-semibold leading-snug">{e.title}</p>
          <p className="mt-0.5 text-sm tabular-nums text-muted">{timeRange(e)}</p>
          {(dj || venue) && (
            <p className="mt-0.5 text-xs text-muted">
              {[dj, venue].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {isProjectId(e.id) ? (
          <Link href={links.project(e.id)} className={cn("inline-flex min-h-9 shrink-0 items-center gap-1 rounded-[10px] border border-border px-3 text-xs font-semibold hover:border-gold", RING)} aria-label={`View event: ${e.title}`}>
            View event <Arrow size={14} aria-hidden />
          </Link>
        ) : (
          <span className="shrink-0 pt-1 text-[11px] text-muted">{e.calendar_source === "venue_night" ? "Venue night" : "Google Calendar"}</span>
        )}
      </div>
    </li>
  );
}

/**
 * The event calendar card: month grid (or a month agenda) beside the selected
 * day's events. Same data, links and month loading as before; the layout and
 * states follow the dashboard calendar design. Two columns when the card is
 * wide enough, stacked otherwise (container query, so it fits any slot).
 */
export function MiniCalendar({
  events,
  loading,
  error,
  layout,
  now,
  onMonth,
  monthNote,
  showDj = true
}: {
  events: DashEvent[];
  loading: boolean;
  error?: boolean;
  layout: DashLayout;
  now: Date;
  /** Told the first day of the month on screen whenever it changes (to load that month's dates). */
  onMonth?: (first: Date) => void;
  /** A line under the grid about the month on screen (e.g. "Loading this month…"). */
  monthNote?: React.ReactNode;
  /** Show the assigned DJ on event cards (staff views). */
  showDj?: boolean;
}) {
  const links = useDashLinks();
  const todayKey = dayKey(now);
  const [cursor, setCursorState] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [picked, setPicked] = useState(todayKey);
  const [view, setView] = useState<"month" | "agenda">("month");
  const focusNext = useRef<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const byDay = useMemo(() => eventsByDay(events), [events]);
  const grid = monthGrid(cursor);
  const weeks = grid.length / 7;
  const dayList = byDay.get(picked) ?? [];
  const agenda = useMemo(() => monthAgenda(events, cursor), [events, cursor]);
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i)); // 2023-01-01 is a Sunday

  const showMonth = (first: Date) => {
    if (sameMonth(first, cursor)) return;
    setCursorState(first);
    onMonth?.(first);
  };
  /** Pick a day; a day from the next or previous month brings that month on screen. */
  const select = (k: string, focus = false) => {
    setPicked(k);
    showMonth(monthOfKey(k));
    if (focus) focusNext.current = k;
  };
  const stepMonth = (n: number) => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth() + n, 1);
    showMonth(first);
    setPicked(sameDayIn(first, picked));
  };
  const goToday = () => {
    showMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setPicked(todayKey);
  };

  // Keyboard moves land focus on the new day once it's rendered (it may be in another month).
  useEffect(() => {
    if (!focusNext.current) return;
    const el = gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusNext.current}"]`);
    focusNext.current = null;
    el?.focus();
  });

  const onGridKey = (ev: React.KeyboardEvent, k: string) => {
    const next = keyMove(k, ev.key);
    if (!next) return;
    ev.preventDefault();
    select(next, true);
  };

  const ctrl = cn("inline-flex h-10 min-w-10 items-center justify-center rounded-[10px] border border-border px-3 text-sm hover:border-gold", RING);

  return (
    <Panel layout={layout} aria-labelledby="dash-cal" data-tour="dash-calendar" className="@container">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[3px] text-muted">
            Event calendar <span className="h-px w-8 bg-gold" aria-hidden />
          </p>
          <h2 id="dash-cal" className="mt-1 font-display text-[28px] font-light leading-tight @2xl:text-[34px]" aria-live="polite">
            {monthLabel}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-tour="cal-controls">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => stepMonth(-1)} className={ctrl} aria-label="Previous month">
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button type="button" onClick={goToday} className={ctrl}>
              Today
            </button>
            <button type="button" onClick={() => stepMonth(1)} className={ctrl} aria-label="Next month">
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
          <div role="group" aria-label="Calendar view" className="flex rounded-[12px] border border-border p-1">
            {(["month", "agenda"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn("h-8 rounded-[9px] px-3.5 text-sm", view === v ? "bg-gold font-semibold text-[var(--on-gold,#1a140a)]" : "text-muted hover:text-foreground", RING)}
              >
                {v === "month" ? "Month" : "Agenda"}
              </button>
            ))}
          </div>
          <span className="hidden h-8 w-px bg-border @3xl:block" aria-hidden />
          <Link href={links.calendar} className={cn("inline-flex h-10 items-center gap-2 rounded-[10px] border border-gold px-3.5 text-sm font-semibold hover:bg-gold/10", RING)}>
            <CalendarDays size={16} className="text-gold" aria-hidden />
            Full calendar
          </Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-[10px] border border-status-declined/40 px-3 py-2 text-xs text-status-declined">
          Events couldn&apos;t load, so the calendar shows no events. Refresh to try again.
        </p>
      )}

      <div className="mt-4 grid gap-5 @3xl:grid-cols-[minmax(0,72fr)_minmax(0,28fr)] @3xl:gap-0">
        {/* Left: month grid or month agenda */}
        <div className="min-w-0 @3xl:pr-5">
          {view === "month" ? (
            <>
              <div className="grid grid-cols-7" aria-hidden>
                {weekdays.map((d) => (
                  <div key={d.getDay()} className="pb-2 text-center text-[11px] font-semibold uppercase tracking-[2px] text-muted">
                    {d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)}
                  </div>
                ))}
              </div>
              <div ref={gridRef} role="group" aria-label={`${monthLabel}, ${weeks} weeks. Use the arrow keys to move between days.`} className="grid grid-cols-7 overflow-hidden rounded-[12px] border border-border">
                {grid.map((d, i) => {
                  const k = dayKey(d);
                  const inMonth = d.getMonth() === cursor.getMonth();
                  const evs = byDay.get(k) ?? [];
                  const isToday = k === todayKey;
                  const isPicked = k === picked;
                  const shown = evs.slice(0, 2);
                  const more = evs.length - shown.length;
                  const kinds = [...new Set(evs.map((e) => calKind(e.status)))];
                  return (
                    <button
                      key={k}
                      type="button"
                      data-day={k}
                      tabIndex={isPicked ? 0 : -1}
                      onClick={() => select(k)}
                      onKeyDown={(ev) => onGridKey(ev, k)}
                      aria-pressed={isPicked}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={`${longDate(k)}${isToday ? ", today" : ""}${!inMonth ? `, ${d.toLocaleDateString(undefined, { month: "long" })}` : ""}: ${
                        evs.length ? `${plural(evs.length)}, ${evs.map((e) => `${CAL_KIND_LABEL[calKind(e.status)]}: ${e.title}`).join("; ")}` : "no events"
                      }`}
                      className={cn(
                        "relative flex min-h-14 flex-col items-start gap-1 p-1.5 text-left align-top hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] @2xl:min-h-[92px] @2xl:p-2",
                        i % 7 !== 6 && "border-r border-border",
                        i < grid.length - 7 && "border-b border-border",
                        !inMonth && "bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]",
                        isPicked && "z-[1] bg-gold/10 shadow-[inset_0_0_0_1.5px_var(--gold)]",
                        "focus-visible:z-[2] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[var(--foreground)]"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm tabular-nums @2xl:text-[15px]",
                            !inMonth && "text-muted/60",
                            isToday && "font-semibold ring-[1.5px] ring-[var(--foreground)]",
                            isPicked && inMonth && "font-semibold"
                          )}
                        >
                          {d.getDate()}
                        </span>
                        {isToday && <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-muted @2xl:inline">Today</span>}
                      </span>
                      {/* Wide: up to two summaries, then +N more. Narrow: dots and a count. */}
                      {evs.length > 0 && (
                        <>
                          <span className="hidden w-full flex-col gap-1 @2xl:flex" aria-hidden>
                            {shown.map((e) => {
                              const kind = calKind(e.status);
                              return (
                                <span key={e.id} className={cn("flex min-w-0 items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[11px] leading-tight", kind === "away" ? "text-muted" : "bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]", !inMonth && "opacity-70")}>
                                  <Dot kind={kind} />
                                  <span className="truncate">{e.title}</span>
                                </span>
                              );
                            })}
                            {more > 0 && <span className="px-1.5 text-[11px] font-semibold text-muted">+{more} more</span>}
                          </span>
                          <span className="flex items-center gap-1 @2xl:hidden" aria-hidden>
                            {kinds.map((kd) => (
                              <Dot key={kd} kind={kd} className="h-1.5 w-1.5" />
                            ))}
                            {evs.length > 1 && <span className="text-[10px] font-semibold leading-none text-muted">{evs.length}</span>}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div aria-label={`${monthLabel} agenda`}>
              {loading ? (
                <p className="py-6 text-sm text-muted">Loading events…</p>
              ) : agenda.length === 0 ? (
                <p className="rounded-[12px] border border-border px-4 py-8 text-center text-sm text-muted">No events in {cursor.toLocaleDateString(undefined, { month: "long" })}.</p>
              ) : (
                <ol className="flex flex-col gap-4">
                  {agenda.map((day) => (
                    <li key={day.key}>
                      <button type="button" onClick={() => select(day.key)} className={cn("mb-2 flex w-full items-baseline justify-between gap-2 text-left", RING)} aria-label={`${longDate(day.key)}, ${plural(day.events.length)}. Show in the day panel`}>
                        <span className={cn("text-sm font-semibold", day.key === picked && "text-gold")}>
                          {longDate(day.key)}
                          {day.key === todayKey && <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Today</span>}
                        </span>
                        <span className="text-xs text-muted">{plural(day.events.length)}</span>
                      </button>
                      <ul className="flex flex-col gap-2">
                        {day.events.map((e) => (
                          <EventCard key={e.id} e={e} showDj={showDj} />
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Legend and notes */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
            {(["booked", "inquiry", "away"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <Dot kind={k} className="h-2.5 w-2.5" />
                {CAL_KIND_LABEL[k]}
              </span>
            ))}
          </div>
          {loading && view === "month" && <p className="mt-2 text-xs text-muted">Loading events…</p>}
          {monthNote && <div className="mt-2 text-xs text-muted">{monthNote}</div>}
        </div>

        {/* Right: the selected day */}
        <aside data-tour="cal-day" aria-labelledby="dash-cal-day" aria-live="polite" className="min-w-0 border-t border-border pt-4 @3xl:border-l @3xl:border-t-0 @3xl:pl-5 @3xl:pt-0">
          <p className="text-sm text-muted">Selected day</p>
          <h3 id="dash-cal-day" className="mt-0.5 text-xl font-semibold leading-tight">
            {longDate(picked)}
          </h3>
          <p className="mt-0.5 text-sm text-muted">{loading ? "Loading…" : error ? "Events couldn't load" : plural(dayList.length)}</p>
          {!loading && !error && (
            dayList.length === 0 ? (
              <div className="mt-4 flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
                <CalendarDays size={26} aria-hidden />
                No events scheduled for this day.
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-2.5">
                {dayList.map((e) => (
                  <EventCard key={e.id} e={e} showDj={showDj} />
                ))}
              </ul>
            )
          )}
        </aside>
      </div>
    </Panel>
  );
}
