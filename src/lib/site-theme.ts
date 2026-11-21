"use client";

import { useSyncExternalStore } from "react";
import { PROJECT_THEMES, isProjectTheme, type ProjectThemeId } from "@/lib/project-themes";
import { SITE_THEME_KEY } from "@/lib/site-theme-boot";

/**
 * The CRM's main look (admin layout: sidebar, pages, pop-ups), picked from the
 * same themes as project pages and remembered in this browser. It sits on
 * <html>; an open project page puts its own look on <body>, which wins while
 * that project is open, then the site look comes back. "classic" is the
 * original cream look (no attribute at all).
 */
export { SITE_THEME_KEY };
const EVENT = "dcdj-site-theme-change";
export const DEFAULT_SITE_THEME: ProjectThemeId = "classic";

export function readSiteTheme(): ProjectThemeId {
  try {
    const v = localStorage.getItem(SITE_THEME_KEY);
    return isProjectTheme(v) ? v : DEFAULT_SITE_THEME;
  } catch {
    return DEFAULT_SITE_THEME;
  }
}

export function applySiteTheme(t: ProjectThemeId | null) {
  const el = document.documentElement;
  if (!t || t === "classic") {
    delete el.dataset.projectTheme;
    delete el.dataset.projectThemeDark;
    return;
  }
  el.dataset.projectTheme = t;
  if (PROJECT_THEMES.find((x) => x.id === t)?.dark) el.dataset.projectThemeDark = "";
  else delete el.dataset.projectThemeDark;
}

export function setSiteTheme(t: ProjectThemeId) {
  try {
    localStorage.setItem(SITE_THEME_KEY, t);
  } catch {
    // storage blocked: the look lasts until the page reloads
  }
  applySiteTheme(t);
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

export function useSiteTheme(): ProjectThemeId {
  return useSyncExternalStore(subscribe, readSiteTheme, () => DEFAULT_SITE_THEME);
}
