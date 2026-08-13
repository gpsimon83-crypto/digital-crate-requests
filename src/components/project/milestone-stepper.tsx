"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

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
  const currentIndex = Math.max(stages.indexOf(current), 0);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-center">
        {stages.map((stage, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <div key={stage} className="flex items-center">
              <button
                onClick={() => onSelect(stage)}
                disabled={disabled}
                className="flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                    done && "border-gold bg-gold text-black",
                    active && "border-gold bg-gold/15 text-gold ring-2 ring-gold/30",
                    !done && !active && "border-black/15 bg-panel text-muted"
                  )}
                >
                  {done ? <Check size={13} /> : i + 1}
                </span>
                <span className={cn("whitespace-nowrap text-[11px]", active ? "font-semibold text-foreground" : "text-muted")}>{stage}</span>
              </button>
              {i < stages.length - 1 && <div className={cn("mb-4 h-px w-8 sm:w-12", done ? "bg-gold" : "bg-black/10")} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
