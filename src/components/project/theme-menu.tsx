"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { PROJECT_THEMES, type ProjectThemeId } from "@/lib/project-themes";
import { cn } from "@/lib/utils";

/** "Theme ▾" menu for the project page. */
export function ThemeMenu({ value, defaultId, onChange }: { value: ProjectThemeId; defaultId: ProjectThemeId; onChange: (id: ProjectThemeId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card/60 px-3 py-1.5 text-xs font-medium hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        Theme <ChevronDown size={13} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-[12px] border border-border bg-card p-1 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
          {PROJECT_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={value === t.id}
              onClick={() => {
                onChange(t.id);
                setOpen(false);
              }}
              className={cn("flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left text-sm hover:bg-black/5 focus-visible:bg-black/5 focus-visible:outline-none", value === t.id && "bg-black/5")}
            >
              <span className="flex h-6 w-6 shrink-0 overflow-hidden rounded-full border border-black/10" aria-hidden>
                <span className="h-full w-1/2" style={{ background: t.swatch[0] }} />
                <span className="h-full w-1/2" style={{ background: t.swatch[1] }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t.name}</span>
                <span className="block text-[11px] text-muted">
                  {t.hint}
                  {t.id === defaultId ? " · default for this event" : ""}
                </span>
              </span>
              {value === t.id && <Check size={15} className="text-gold" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
