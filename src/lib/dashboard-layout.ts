"use client";

import { useSyncExternalStore } from "react";
import { DASH_LAYOUT_KEY } from "@/lib/site-theme-boot";

/**
 * Which admin dashboard layout to show: Modern Studio (side rail, action hub
 * on the left, photo strip and metric cards) or Midnight Command (top
 * navigation, photo hero, metric rail). Colors always come from the site
 * theme; this only changes the arrangement. Saved in this browser, like the
 * site theme.
 */
export type DashLayout = "studio" | "command";
export const DASH_LAYOUTS: { id: DashLayout; name: string; hint: string }[] = [
  { id: "studio", name: "Modern Studio", hint: "Side menu, action hub on the left, photo strip and metric cards" },
  { id: "command", name: "Midnight Command", hint: "Top menu, photo hero with quick actions, metric rail" }
];
const EVENT = "dcdj-dashboard-layout-change";
export const isDashLayout = (v: unknown): v is DashLayout => v === "studio" || v === "command";

export function readDashLayout(): DashLayout {
  try {
    const v = localStorage.getItem(DASH_LAYOUT_KEY);
    return isDashLayout(v) ? v : "studio";
  } catch {
    return "studio";
  }
}

export function setDashLayout(v: DashLayout) {
  try {
    localStorage.setItem(DASH_LAYOUT_KEY, v);
  } catch {
    // storage blocked: lasts until reload
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** null until mounted (the server can't know), so the page can wait instead of flashing the wrong layout. */
export function useDashLayout(): DashLayout | null {
  return useSyncExternalStore(subscribe, readDashLayout, () => null);
}
