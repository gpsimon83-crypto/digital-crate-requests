import { PROJECT_THEMES } from "@/lib/project-themes";

/** localStorage key for the admin site theme (see site-theme.ts). */
export const SITE_THEME_KEY = "dcdj-site-theme";

/** Runs before the page paints (inline in the admin layout), so a dark look doesn't flash cream first. */
export const SITE_THEME_BOOT = `try{var t=localStorage.getItem(${JSON.stringify(SITE_THEME_KEY)}),d=${JSON.stringify(
  PROJECT_THEMES.filter((t) => t.dark).map((t) => t.id)
)},ok=${JSON.stringify(PROJECT_THEMES.map((t) => t.id))};if(t&&t!=="classic"&&ok.indexOf(t)>-1){var e=document.documentElement;e.dataset.projectTheme=t;if(d.indexOf(t)>-1)e.dataset.projectThemeDark=""}}catch(_){}`;

/** localStorage key for the admin dashboard layout (see dashboard-layout.ts). */
export const DASH_LAYOUT_KEY = "dcdj-dashboard-layout";

/**
 * Before first paint on the admin home: Midnight Command uses its own top
 * navigation, so the side rail is hidden from the start (no jump on load).
 */
export const DASH_LAYOUT_BOOT = `try{if(location.pathname==="/admin"&&localStorage.getItem(${JSON.stringify(DASH_LAYOUT_KEY)})==="command")document.documentElement.dataset.dashLayout="command"}catch(_){}`;
