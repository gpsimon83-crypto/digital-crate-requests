"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { TOURS, isConcrete, pathMatches } from "@/lib/tours";
import { UPDATES } from "@/lib/whats-new";
import { cn } from "@/lib/utils";

const KEY = "dcdj-tour";
const EVENT = "dcdj-tour-change";

type TourState = { id: string; step: number } | null;

function readState(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function writeState(s: TourState) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    // storage blocked: the tour just won't survive a page change
  }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Starts a walkthrough and goes to its first page. */
export function startTour(id: string, push: (href: string) => void) {
  const steps = TOURS[id];
  if (!steps?.length) return;
  writeState({ id, step: 0 });
  push(steps[0].path.replace(/\/\*.*$/, ""));
}

export function hasTour(id: string) {
  return !!TOURS[id]?.length;
}

type Rect = { top: number; left: number; width: number; height: number };

/**
 * Spotlight walkthrough over the real admin pages. The dimmed overlay
 * never blocks clicks, so the viewer can use the page while the tour is
 * open (e.g. click Manage to move on).
 */
export function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const raw = useSyncExternalStore(subscribe, readState, () => null);
  const state: TourState = raw ? (JSON.parse(raw) as TourState) : null;
  const steps = state ? TOURS[state.id] : undefined;
  const step = steps && state ? steps[state.step] : undefined;
  const onPage = !!step && pathMatches(step.path, pathname, new URLSearchParams(search.toString()));

  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target only exists after mount
  useEffect(() => setMounted(true), []);

  const targetSel = onPage ? step?.target : undefined;

  // Find the target (it may render after data loads), bring it into view, then track it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when the step changes
    setRect(null);
    setMissing(false);
    if (!targetSel) return;
    let raf = 0;
    let scrolled = false;
    const started = performance.now();
    const tick = () => {
      const el = document.querySelector(targetSel) as HTMLElement | null;
      if (el) {
        if (!scrolled) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          scrolled = true;
        }
        const r = el.getBoundingClientRect();
        setRect((prev) =>
          prev && Math.abs(prev.top - r.top) < 0.5 && Math.abs(prev.left - r.left) < 0.5 && prev.width === r.width && prev.height === r.height
            ? prev
            : { top: r.top, left: r.left, width: r.width, height: r.height }
        );
      } else if (performance.now() - started > 6000) {
        setMissing(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetSel, state?.step]);

  const end = useCallback(() => writeState(null), []);

  const go = useCallback(
    (to: number) => {
      if (!state || !steps) return;
      if (to >= steps.length) return end();
      if (to < 0) return;
      const cur = steps[state.step];
      const next = steps[to];
      if (to > state.step && cur.follow) {
        const link = document.querySelector(cur.follow) as HTMLAnchorElement | null;
        const href = link?.getAttribute("href");
        writeState({ id: state.id, step: to });
        if (href) router.push(href);
        return;
      }
      writeState({ id: state.id, step: to });
      const sp = new URLSearchParams(search.toString());
      if (!pathMatches(next.path, pathname, sp)) {
        if (isConcrete(next.path)) router.push(next.path);
        else if (to < state.step) router.back();
      }
    },
    [state, steps, end, router, pathname, search]
  );

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, end]);

  if (!mounted || !state || !steps || !step) return null;

  const title = UPDATES.find((u) => u.id === state.id)?.title ?? "Walkthrough";
  const last = state.step === steps.length - 1;

  // Off the step's page: offer to continue (fixed page) or say what to open.
  if (!onPage) {
    return createPortal(
      <div className="fixed inset-x-3 bottom-20 z-[70] mx-auto max-w-sm rounded-[14px] border border-gold/40 bg-card p-4 shadow-[0_12px_40px_rgba(0,0,0,0.25)] md:bottom-6 md:right-6 md:left-auto md:mx-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gold-dim">Walkthrough · {title}</p>
            <p className="mt-1 text-sm">{isConcrete(step.path) ? "Paused. Pick up where you left off?" : step.waitHint ?? "Open the next page to continue."}</p>
          </div>
          <button onClick={end} aria-label="End walkthrough" className="p-1 text-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        {isConcrete(step.path) && (
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={end} className="rounded-[10px] px-3 py-1.5 text-xs text-muted hover:text-foreground">
              End
            </button>
            <button onClick={() => router.push(step.path)} className="rounded-[10px] bg-gold px-3 py-1.5 text-xs font-medium text-[#1A140A]">
              Continue
            </button>
          </div>
        )}
      </div>,
      document.body
    );
  }

  const pad = 6;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const isPhone = vw < 768;
  const cardW = Math.min(340, vw - 24);
  let cardStyle: React.CSSProperties = {};
  if (rect && !isPhone) {
    const below = rect.top + rect.height + pad + 14;
    const fitsBelow = below + 230 < vh;
    const top = fitsBelow ? below : Math.max(12, rect.top - pad - 14 - 230);
    const left = Math.min(Math.max(12, rect.left), vw - cardW - 12);
    cardStyle = { top, left, width: cardW };
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[70]" aria-live="polite">
      {rect ? (
        <div
          className="absolute rounded-[12px] border-2 border-gold transition-all duration-200"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(12,10,6,0.55)"
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(12,10,6,0.45)]" />
      )}
      <div
        role="dialog"
        aria-label={`${title}: step ${state.step + 1} of ${steps.length}`}
        className={cn(
          "pointer-events-auto absolute rounded-[14px] border border-gold/40 bg-card p-4 shadow-[0_12px_40px_rgba(0,0,0,0.3)]",
          rect && !isPhone ? "" : isPhone ? "inset-x-3 bottom-20" : "left-1/2 top-1/2 w-[340px] -translate-x-1/2 -translate-y-1/2"
        )}
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gold-dim">
            {title} · {state.step + 1} of {steps.length}
          </p>
          <button onClick={end} aria-label="End walkthrough" className="-m-1 p-1 text-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <p className="mt-1 text-base font-semibold">{step.title}</p>
        <p className="mt-1 text-sm text-muted">{step.body}</p>
        {missing && <p className="mt-2 text-xs text-status-pending">This part isn&apos;t on the screen right now (the list may be empty). You can still continue.</p>}
        <div className="mt-3 flex items-center gap-1">
          {steps.map((_, i) => (
            <span key={i} className={cn("h-1.5 rounded-full transition-all", i === state.step ? "w-4 bg-gold" : "w-1.5 bg-black/15")} />
          ))}
          <span className="flex-1" />
          {state.step > 0 && (
            <button onClick={() => go(state.step - 1)} className="rounded-[10px] px-3 py-1.5 text-xs text-muted hover:text-foreground">
              Back
            </button>
          )}
          <button onClick={() => go(state.step + 1)} className="rounded-[10px] bg-gold px-3 py-1.5 text-xs font-medium text-[#1A140A] hover:brightness-105">
            {last ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
