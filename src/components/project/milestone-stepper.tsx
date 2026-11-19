"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The booking rail: a slim line with one short vertical tick per pipeline
 * stage and its label centred below. The current tick is the theme's accent
 * (thicker, taller) with an accent label; the others are taupe. Reads the
 * same `pipeline_stage` as the sidebar's Pipeline Stage control (not booking
 * Status). Clicking a stage moves the project there. On narrow screens it
 * scrolls sideways in its own box, starting scrolled to the current stage.
 */
export function StageRail({
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
  const railRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keep the current stage in view inside the rail's own scroll box (never scrolls the page).
  useEffect(() => {
    const rail = railRef.current;
    const tick = index >= 0 ? tickRefs.current[index] : null;
    if (!rail || !tick || rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollLeft = Math.max(0, tick.offsetLeft + tick.offsetWidth / 2 - rail.clientWidth / 2);
  }, [index]);

  const half = `${50 / stages.length}%`;

  return (
    <div ref={railRef} className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
      <ol className="relative grid min-w-[880px] pt-1 lg:min-w-[760px]" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }} aria-label="Booking timeline">
        {/* The line runs from the first tick to the last. */}
        <span aria-hidden className="pointer-events-none absolute top-[13px] h-px bg-[var(--taupe)]" style={{ left: half, right: half }} />
        {stages.map((stage, i) => {
          const isCurrent = i === index;
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
                <span aria-hidden className={cn("h-[19px] rounded-full transition-colors", isCurrent ? "w-[4px] bg-gold" : "w-[1.5px] bg-[var(--taupe)] group-hover:bg-gold/60")} />
                <span className={cn("whitespace-nowrap text-[13px] leading-tight", isCurrent ? "font-bold text-gold" : "text-foreground/85 group-hover:text-foreground")}>{stage}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
