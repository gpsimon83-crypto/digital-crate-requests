"use client";

import { useSyncExternalStore } from "react";
import { LAST_SEEN_KEY, UPDATES, unseenCount } from "./whats-new";

const EVENT = "dcdj-whats-new-seen";

function read(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** Unseen update count for the menu badge (0 during server render). */
export function useWhatsNewCount(): number {
  return useSyncExternalStore(subscribe, () => unseenCount(read()), () => 0);
}

/** Last-seen id at the moment the page opened, then marks everything seen. */
export function markWhatsNewSeen(): string | null {
  const before = read();
  try {
    if (UPDATES[0]) localStorage.setItem(LAST_SEEN_KEY, UPDATES[0].id);
  } catch {
    // private mode etc.: the badge just keeps showing
  }
  window.dispatchEvent(new Event(EVENT));
  return before;
}
