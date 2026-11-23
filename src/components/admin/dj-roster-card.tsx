"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, Eye, Link2, MoreHorizontal, PenLine, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardFraming, type CardFraming, type HeroSettings } from "@/lib/hero-settings";
import { ACCESS_HELP, ACCESS_LABEL, type PortalAccess } from "@/lib/dj/portal-access";

export type RosterDj = {
  id: string;
  display_name: string;
  auth_user_id: string | null;
  photo_url: string | null;
  hero_settings: Partial<HeroSettings> | null;
  access: PortalAccess;
};

const RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card,var(--background))]";

/** Portal-access chip: a small dot plus words, so colour is never the only cue. */
export function AccessChip({ access, className }: { access: PortalAccess; className?: string }) {
  const tone = access === "active" ? "ok" : access === "none" ? "off" : access === "disabled" || access === "missing" ? "bad" : "wait";
  return (
    <span
      title={ACCESS_HELP[access]}
      className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium leading-none", className)}
      style={{ color: `var(--chip-${tone}-fg)`, background: `var(--chip-${tone}-bg)`, borderColor: `var(--chip-${tone}-bd)` }}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={tone === "off" ? { boxShadow: "inset 0 0 0 1.5px var(--chip-off-dot)" } : { background: `var(--chip-${tone}-dot)` }}
      />
      {ACCESS_LABEL[access]}
    </span>
  );
}

function initials(name: string) {
  return (
    name
      .replace(/^DJ\s+/i, "")
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "DJ"
  );
}

/**
 * The portrait: the saved photo in a 4:3 frame, positioned by the DJ's card
 * framing (hero_settings.card; head-and-shoulders by default, kept apart from
 * the wide event-banner framing), served at card size via next/image so the
 * original upload is never downloaded in full or changed.
 */
export function Portrait({ dj, framing, sizes }: { dj: Pick<RosterDj, "display_name" | "photo_url" | "hero_settings">; /** Override (the live preview while adjusting). */ framing?: CardFraming; sizes?: string }) {
  const [state, setState] = useState<"loading" | "ok" | "broken">(dj.photo_url ? "loading" : "broken");
  const f = framing ?? cardFraming(dj.hero_settings);
  const x = f.x;
  const y = f.y;
  const zoom = f.zoom / 100;
  const showPhoto = dj.photo_url && state !== "broken";
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]">
      {showPhoto ? (
        <>
          {state === "loading" && <div className="absolute inset-0 animate-pulse bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]" aria-hidden />}
          <Image
            src={dj.photo_url!}
            alt={`Photo of ${dj.display_name}`}
            fill
            sizes={sizes ?? "(min-width: 1536px) 360px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"}
            className={cn("object-cover transition-opacity duration-300", state === "ok" ? "opacity-100" : "opacity-0")}
            style={{ objectPosition: `${x}% ${y}%`, transform: zoom > 1 ? `scale(${zoom})` : undefined, transformOrigin: `${x}% ${y}%` }}
            onLoad={() => setState("ok")}
            onError={() => setState("broken")}
          />
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--gold)_28%,transparent),transparent_60%),linear-gradient(135deg,color-mix(in_srgb,var(--gold)_14%,var(--card,var(--background))),var(--card,var(--background)))]">
          <span aria-hidden className="font-display text-5xl font-light tracking-wide text-gold">
            {initials(dj.display_name)}
          </span>
          <span className="text-[11px] text-muted">{dj.photo_url ? "Photo couldn't load" : "No photo yet"}</span>
        </div>
      )}
    </div>
  );
}

/** One DJ on the roster: photo, name, portal access, Manage profile, edit photo, and a menu for the rest. */
export function DjRosterCard({
  dj,
  onEditPhoto,
  onQuickEdit,
  onViewAs,
  onSetupLink,
  onRemove
}: {
  dj: RosterDj;
  onEditPhoto: () => void;
  onQuickEdit: () => void;
  onViewAs: () => void;
  /** Only offered while the DJ has no login. */
  onSetupLink?: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuId = `dj-menu-${dj.id}`;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    }
  };
  const item = (label: string, Icon: typeof Eye, run: () => void, danger = false) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        run();
      }}
      className={cn("flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-left text-sm hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] focus-visible:outline-none", danger ? "text-status-declined" : "text-foreground")}
    >
      <Icon size={15} aria-hidden className="shrink-0" />
      {label}
    </button>
  );

  return (
    <article aria-labelledby={`dj-${dj.id}-name`} className="glass-card relative flex w-full min-w-0 flex-col overflow-visible !p-0 transition-colors hover:border-[color-mix(in_srgb,var(--gold)_45%,var(--border))]" data-dj-card={dj.id}>
      <div className="relative overflow-hidden rounded-t-[inherit]">
        <Portrait dj={dj} />
        <button
          type="button"
          onClick={onEditPhoto}
          aria-label={`Edit photo for ${dj.display_name}`}
          className={cn("absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-[10px] border border-white/30 bg-black/70 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-black/85", RING)}
        >
          <Camera size={16} aria-hidden />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 id={`dj-${dj.id}-name`} className="break-words text-lg font-semibold leading-snug">
            {dj.display_name}
          </h3>
          <AccessChip access={dj.access} className="mt-1.5" />
        </div>
        <div className="mt-auto flex items-center gap-2">
          <Link href={`/admin/djs/${dj.id}`} className={cn("inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-gold px-3 text-sm font-semibold transition-colors hover:bg-gold/10", RING)}>
            Manage profile
          </Link>
          <div className="relative">
            <button
              ref={btnRef}
              type="button"
              aria-label={`More actions for ${dj.display_name}`}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={open ? menuId : undefined}
              onClick={() => setOpen((v) => !v)}
              className={cn("flex h-10 w-10 items-center justify-center rounded-[10px] border border-border transition-colors hover:border-gold", RING)}
            >
              <MoreHorizontal size={17} aria-hidden />
            </button>
            {open && (
              <div ref={menuRef} id={menuId} role="menu" aria-label={`Actions for ${dj.display_name}`} onKeyDown={onMenuKey} className="absolute bottom-full right-0 z-30 mb-2 w-56 rounded-[12px] border border-border bg-panel p-1.5 shadow-xl">
                {item("Quick edit", PenLine, onQuickEdit)}
                {item(`View as ${dj.display_name}`, Eye, onViewAs)}
                {onSetupLink && item("Copy setup link", Link2, onSetupLink)}
                <div className="my-1 h-px bg-border" role="separator" />
                {item("Remove from roster…", Trash2, onRemove, true)}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
