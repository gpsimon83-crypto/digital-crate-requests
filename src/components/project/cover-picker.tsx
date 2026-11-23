"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT_COVERS } from "@/lib/project-covers";

/** A grid of the built-in banner photos. `value` is the chosen photo's src. */
export function CoverPicker({ value, onPick, disabled, label = "Default photos" }: { value: string | null; onPick: (src: string) => void; disabled?: boolean; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {PROJECT_COVERS.map((c) => {
        const on = value === c.src;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${c.group}: ${c.label}`}
            disabled={disabled}
            onClick={() => onPick(c.src)}
            className={cn("group relative overflow-hidden rounded-[10px] border-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60", on ? "border-gold" : "border-transparent hover:border-gold/50")}
          >
            <span className="relative block aspect-[752/325] w-full">
              <Image src={c.src} alt="" fill sizes="(min-width: 1024px) 180px, 45vw" className="object-cover" />
            </span>
            <span className="block truncate bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] px-2 py-1 text-[11px] text-muted">{c.label}</span>
            {on && (
              <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gold text-black" aria-hidden>
                <Check size={14} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
