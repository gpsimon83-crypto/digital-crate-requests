"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActionMenuItem = { label: string; icon?: LucideIcon; onSelect: () => void; danger?: boolean } | "separator";

/**
 * A ⋯ button with a small menu (row and card actions). Arrow keys move,
 * Escape closes and returns focus, clicks outside close. Clicks don't reach
 * the row underneath, so a table row with onRowClick doesn't open.
 */
export function ActionMenu({ label, items, align = "right", className }: { label: string; items: ActionMenuItem[]; align?: "right" | "left"; className?: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    menu.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const els = [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    }
  };

  return (
    <div className={cn("relative inline-block", className)} onClick={(e) => e.stopPropagation()}>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-transparent text-muted transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <MoreHorizontal size={17} aria-hidden />
      </button>
      {open && (
        <div ref={menu} role="menu" aria-label={label} onKeyDown={onMenuKey} className={cn("absolute top-full z-40 mt-1 w-52 rounded-[12px] border border-border bg-panel p-1.5 text-left shadow-xl", align === "right" ? "right-0" : "left-0")}>
          {items.map((it, i) =>
            it === "separator" ? (
              <div key={`sep-${i}`} role="separator" className="my-1 h-px bg-border" />
            ) : (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-left text-sm hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] focus-visible:outline-none",
                  it.danger ? "text-status-declined" : "text-foreground"
                )}
              >
                {it.icon && <it.icon size={15} aria-hidden className="shrink-0" />}
                {it.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
