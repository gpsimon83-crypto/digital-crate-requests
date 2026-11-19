"use client";

import { useEffect, useRef } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Booking timeline for a project: a "Current stage" card beside a slim rail
 * of tick marks, one per pipeline stage, label centred under each tick. The
 * current tick is gold with a bold label; earlier ones are a softer gold,
 * later ones taupe. Reads the same `pipeline_stage` as the sidebar's
 * Pipeline Stage control (not booking Status), and clicking a stage still
 * moves the project there.
 *
 * Desktop: card and rail on one row. Narrow screens: card above, rail
 * scrolls sideways inside its own box and starts scrolled to the current
 * stage.
 */
export function MilestoneStepper({
  stages,
  current,
  onSelect,
  disabled
}: {
  stages: readonly string[];
  current: string;
  onSelect: (stage: string) => void;
  disabled?: boolean;
}) {
  const index = stages.indexOf(current);
  const onRail = index >= 0;
  const railRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keep the current stage in view inside the rail's own scroll box (never scrolls the page).
  useEffect(() => {
    const rail = railRef.current;
    const tick = onRail ? tickRefs.current[index] : null;
    if (!rail || !tick || rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollLeft = Math.max(0, tick.offsetLeft + tick.offsetWidth / 2 - rail.clientWidth / 2);
  }, [index, onRail]);

  const half = `${50 / stages.length}%`;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8" data-tour="project-timeline">
      <div className="flex shrink-0 items-stretch overflow-hidden rounded-[14px] border border-border bg-card lg:min-w-[270px]" aria-live="polite">
        <div className="flex items-center border-r border-border bg-panel/60 px-4">
          <CalendarDays size={22} strokeWidth={1.5} className="text-gold-dim" aria-hidden />
        </div>
        <div className="px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[2px] text-foreground/80">Current stage</p>
          <p className="mt-0.5 whitespace-nowrap text-[15px] text-foreground">
            <span className="font-bold">{current}</span>
            <span className="text-foreground/80">{onRail ? ` · Step ${index + 1} of ${stages.length}` : " · Not on the timeline"}</span>
          </p>
        </div>
      </div>

      <div ref={railRef} className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
        <ol className="relative grid min-w-[780px] pt-1" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }} aria-label="Booking timeline">
          {/* The rail runs from the first tick to the last. */}
          <span aria-hidden className="pointer-events-none absolute top-[12px] h-px bg-[var(--taupe)]" style={{ left: half, right: half }} />
          {stages.map((stage, i) => {
            const isCurrent = i === index;
            const done = onRail && i < index;
            return (
              <li key={stage} className="flex justify-center">
                <button
                  ref={(el) => {
                    tickRefs.current[i] = el;
                  }}
                  type="button"
                  onClick={() => onSelect(stage)}
                  disabled={disabled}
                  aria-current={isCurrent ? "step" : undefined}
                  title={isCurrent ? `Current stage: ${stage}` : `Move to ${stage}`}
                  className="group flex flex-col items-center gap-2 rounded-[6px] px-1 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:cursor-not-allowed"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "relative h-[17px] rounded-full transition-colors",
                      isCurrent ? "w-[4px] bg-gold" : done ? "w-[2px] bg-gold/55" : "w-[2px] bg-[var(--taupe)] group-hover:bg-gold/50"
                    )}
                  />
                  <span className={cn("whitespace-nowrap text-[13px] leading-tight", isCurrent ? "font-bold text-foreground" : "text-foreground/85 group-hover:text-foreground")}>{stage}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
