"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Focal point for each tab photo's cover crop. */
const PHOTOS: Record<string, { src: string; pos: string }> = {
  overview: { src: "/portal/tabs/overview.webp", pos: "50% 38%" },
  conversations: { src: "/portal/tabs/conversations.webp", pos: "50% 62%" },
  contracts: { src: "/portal/tabs/contracts.webp", pos: "38% 62%" },
  forms: { src: "/portal/tabs/forms.webp", pos: "50% 30%" },
  documents: { src: "/portal/tabs/documents.webp", pos: "55% 44%" },
  music: { src: "/portal/tabs/music.webp", pos: "45% 48%" },
  payments: { src: "/portal/tabs/payments.webp", pos: "42% 55%" }
};

/**
 * The portal's tab row: each tab is a shallow photo crop above its label.
 * Photos are decorative (the label carries the meaning). The active tab gets
 * a thin accent underline on the row's divider; the row scrolls sideways on
 * small screens and keeps the active tab in view.
 */
export function PortalPhotoTabs({ items, active, hrefFor, overviewPhoto }: { items: readonly { key: string; label: string }[]; active: string; hrefFor: (key: string) => string; overviewPhoto?: string | null }) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = rowRef.current;
    const tab = row?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!row || !tab || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = Math.max(0, tab.offsetLeft + tab.offsetWidth / 2 - row.clientWidth / 2);
  }, [active]);

  return (
    <div ref={rowRef} role="tablist" className="flex gap-3 overflow-x-auto overflow-y-hidden px-0.5 pt-0.5 shadow-[inset_0_-1px_0_var(--border)] [scrollbar-width:thin] sm:gap-4" data-tour="portal-tabs">
      {items.map((t) => {
        const on = active === t.key;
        const photo = t.key === "overview" && overviewPhoto ? { src: overviewPhoto, pos: "50% 50%" } : PHOTOS[t.key];
        return (
          <Link
            key={t.key}
            href={hrefFor(t.key)}
            role="tab"
            aria-selected={on}
            className={cn(
              "group flex w-[116px] shrink-0 flex-col gap-2 rounded-t-[10px] border-b-2 pb-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold sm:w-[132px]",
              on ? "border-gold" : "border-transparent"
            )}
          >
            <span className={cn("block h-[54px] overflow-hidden rounded-[10px] border transition-colors sm:h-[60px]", on ? "border-gold/60" : "border-border group-hover:border-gold/40")}>
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element -- small decorative crops; the overview may be a user upload on another host
                <img src={photo.src} alt="" aria-hidden className={cn("h-full w-full object-cover transition duration-300", on ? "" : "opacity-80 saturate-[0.85] group-hover:opacity-100 group-hover:saturate-100")} style={{ objectPosition: photo.pos }} loading="lazy" />
              )}
            </span>
            <span className={cn("px-0.5 text-center text-[14px] leading-tight", on ? "font-bold text-foreground" : "text-foreground/80 group-hover:text-foreground")}>{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
