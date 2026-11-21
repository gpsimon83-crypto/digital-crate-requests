"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Palette } from "lucide-react";
import { PROJECT_THEMES } from "@/lib/project-themes";
import { applySiteTheme, setSiteTheme, useSiteTheme } from "@/lib/site-theme";
import { cn } from "@/lib/utils";

/** Keeps the admin layout in the picked look; leaving the admin area puts the page back to the original look. */
export function SiteThemeRoot() {
  const theme = useSiteTheme();
  useEffect(() => {
    applySiteTheme(theme);
  }, [theme]);
  useEffect(() => () => applySiteTheme(null), []);
  return null;
}

/** The list of looks (sidebar pop-over, mobile menu and Settings all use it). */
export function SiteThemeList({ onPick, compact }: { onPick?: () => void; compact?: boolean }) {
  const theme = useSiteTheme();
  return (
    <div role="radiogroup" aria-label="Site theme" className={cn("flex flex-col gap-0.5", !compact && "sm:grid sm:grid-cols-2 sm:gap-1.5")}>
      {PROJECT_THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={theme === t.id}
          onClick={() => {
            setSiteTheme(t.id);
            onPick?.();
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left text-sm hover:bg-black/5 focus-visible:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
            !compact && "border border-border",
            theme === t.id && "bg-black/5",
            theme === t.id && !compact && "border-gold"
          )}
        >
          <span className="flex h-6 w-6 shrink-0 overflow-hidden rounded-full border border-black/10" aria-hidden>
            <span className="h-full w-1/2" style={{ background: t.swatch[0] }} />
            <span className="h-full w-1/2" style={{ background: t.swatch[1] }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{t.name}</span>
            <span className="block text-[11px] text-muted">{t.id === "classic" ? "Original look" : t.dark ? "Dark" : "Light"}</span>
          </span>
          {theme === t.id && <Check size={15} className="shrink-0 text-gold" />}
        </button>
      ))}
    </div>
  );
}

/** "Theme" in the admin sidebar rail, above Sign Out. */
export function SiteThemeButton({ labelClass }: { labelClass?: string }) {
  // The rail scrolls (and clips), so the pop-over floats on the page beside the button.
  const [open, setOpen] = useState<{ left: number; bottom: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node) && !pop.current?.contains(e.target as Node)) setOpen(null);
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
        aria-haspopup="dialog"
        aria-expanded={!!open}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setOpen((o) => (o ? null : { left: Math.min(r.right + 8, window.innerWidth - 272), bottom: Math.max(8, window.innerHeight - r.bottom) }));
        }}
        data-tour="site-theme"
        className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted transition-colors hover:bg-black/5 hover:text-foreground"
      >
        <Palette size={18} className="shrink-0" />
        <span className={labelClass}>Theme</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            role="dialog"
            aria-label="Site theme"
            style={{ left: open.left, bottom: open.bottom }}
            className="fixed z-50 w-64 rounded-[12px] border border-border bg-card p-1.5 text-foreground shadow-[0_16px_40px_rgba(0,0,0,0.25)]"
          >
            <p className="px-2.5 pb-1 pt-1.5 text-[10px] uppercase tracking-[2px] text-muted">Site theme</p>
            <SiteThemeList compact onPick={() => setOpen(null)} />
            <p className="px-2.5 pb-1.5 pt-2 text-[11px] leading-snug text-muted">Projects open in their event type&apos;s look; this one is for everything else.</p>
          </div>,
          document.body
        )}
    </div>
  );
}
