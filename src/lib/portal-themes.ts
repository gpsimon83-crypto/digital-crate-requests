/**
 * Client portal looks. One shared layout; each palette is a set of colour
 * tokens (globals.css, [data-portal-theme="…"]) for panels, text, borders,
 * focus rings and the primary action. Which one a client sees:
 *   1. the event's own pick (Customize Portal → Look), else
 *   2. the palette staff assigned to the event's category (Admin → Settings), else
 *   3. the built-in default for that category.
 * The blurred banner backdrop is configured separately (on/off + strength).
 */
export type PortalThemeId = "ink-brass" | "indigo-apricot" | "pine-copper" | "slate-lime" | "plum-champagne";

export const PORTAL_THEMES: { id: PortalThemeId; name: string; swatch: [string, string]; dark: boolean }[] = [
  { id: "ink-brass", name: "Ink & Brass", swatch: ["#1B1D22", "#8A5A1C"], dark: false },
  { id: "indigo-apricot", name: "Indigo & Apricot", swatch: ["#2E2580", "#F4B183"], dark: false },
  { id: "pine-copper", name: "Pine & Copper", swatch: ["#1F3A2E", "#B8693A"], dark: false },
  { id: "slate-lime", name: "Slate & Electric Lime", swatch: ["#151A21", "#C8F03C"], dark: true },
  { id: "plum-champagne", name: "Plum & Champagne", swatch: ["#5E1A3D", "#EBD3BD"], dark: false }
];

export const DEFAULT_PORTAL_THEME_BY_CATEGORY: Record<string, PortalThemeId> = {
  wedding: "ink-brass",
  corporate: "ink-brass",
  school_dance: "indigo-apricot",
  holiday: "pine-copper",
  bar_nightclub: "slate-lime",
  residency: "slate-lime",
  private_party: "plum-champagne",
  custom: "ink-brass"
};

export const isPortalTheme = (v: unknown): v is PortalThemeId => PORTAL_THEMES.some((t) => t.id === v);

export function resolvePortalTheme(category: string | null | undefined, eventPick: unknown, byCategory: Record<string, unknown> | null | undefined): PortalThemeId {
  if (isPortalTheme(eventPick)) return eventPick;
  const assigned = byCategory?.[category ?? ""];
  if (isPortalTheme(assigned)) return assigned;
  return DEFAULT_PORTAL_THEME_BY_CATEGORY[category ?? ""] ?? "ink-brass";
}

/** Blurred, desaturated banner behind the portal. Separate from the palette. */
export type PortalBackdrop = { enabled: boolean; strength: number };
export const DEFAULT_BACKDROP: PortalBackdrop = { enabled: true, strength: 40 };
export function backdropSettings(v: unknown): PortalBackdrop {
  const o = (v && typeof v === "object" ? v : {}) as Partial<PortalBackdrop>;
  const strength = Number(o.strength);
  return { enabled: o.enabled !== false, strength: Number.isFinite(strength) ? Math.min(100, Math.max(0, Math.round(strength))) : DEFAULT_BACKDROP.strength };
}
