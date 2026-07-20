"use client";

import { ChevronDown } from "lucide-react";

/**
 * A folder/crate "chip" that expands accordion-style to reveal its track
 * list in place. Controlled from the parent grid so that opening one chip
 * can dim and shrink its siblings ("solo" focus), rather than each chip
 * managing its own independent open state.
 */
export function ExpandableChip({
  title,
  subtitle,
  tracks,
  error,
  isOpen,
  dimmed,
  onToggle,
}: {
  title: string;
  subtitle: string;
  tracks: string[];
  error?: string | null;
  isOpen: boolean;
  dimmed: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg border transition-all duration-300 ${
        isOpen
          ? "col-span-full border-gold/40 bg-panel/70 shadow-lg shadow-black/30"
          : "border-black/8 bg-panel/40 hover:bg-black/5"
      } ${dimmed ? "opacity-30" : "opacity-100"}`}
    >
      <button
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-2 text-left ${isOpen ? "px-4 py-3" : "px-3 py-2"}`}
      >
        <div className="min-w-0 flex-1">
          <p className={`truncate font-medium ${isOpen ? "text-base" : "text-sm"}`}>{title}</p>
          <p className="text-xs text-muted">{error ? "error" : subtitle}</p>
        </div>
        <ChevronDown
          size={isOpen ? 18 : 15}
          className={`shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="max-h-96 overflow-y-auto border-t border-black/8 px-4 py-3">
          {tracks.length === 0 ? (
            <p className="text-xs text-muted">No tracks.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3">
              {tracks.map((t, i) => (
                <li key={`${t}-${i}`} className="truncate text-xs text-muted" title={t}>
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
