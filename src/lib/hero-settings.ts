export interface HeroSettings {
  xPosition: number; // 0-100, horizontal focal point (% from left)
  yPosition: number; // 0-100, vertical focal point (% from top)
  zoom: number; // 100 = fit, >100 = zoomed in
  overlayDarkness: number; // 0-100, dark overlay strength
}

export const DEFAULT_HERO_SETTINGS: HeroSettings = {
  xPosition: 75,
  yPosition: 50,
  zoom: 100,
  overlayDarkness: 40,
};

export function mergeHeroSettings(partial?: Partial<HeroSettings> | null): HeroSettings {
  return { ...DEFAULT_HERO_SETTINGS, ...(partial ?? {}) };
}

/**
 * How a DJ's photo sits on their roster card (Manage DJs), saved inside
 * hero_settings as `card` and kept apart from the wide event-banner framing.
 * x/y are the focal point (% from left/top), zoom 100–180.
 */
export interface CardFraming {
  x: number;
  y: number;
  zoom: number;
}
/** Head-and-shoulders for portraits: show from near the top (faces in the team photos start 5–35% down). */
export const DEFAULT_CARD_FRAMING: CardFraming = { x: 50, y: 10, zoom: 100 };

export function cardFraming(settings: unknown): CardFraming {
  const c = (settings && typeof settings === "object" ? (settings as { card?: Partial<CardFraming> }).card : null) ?? null;
  const n = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  return { x: n(c?.x, 0, 100, DEFAULT_CARD_FRAMING.x), y: n(c?.y, 0, 100, DEFAULT_CARD_FRAMING.y), zoom: n(c?.zoom, 100, 180, DEFAULT_CARD_FRAMING.zoom) };
}

/** A save of photo framing keeps whatever it didn't send (so the banner and card settings don't erase each other). */
export function mergeSavedFraming(current: unknown, incoming: Record<string, unknown>): Record<string, unknown> {
  const base = current && typeof current === "object" ? (current as Record<string, unknown>) : {};
  return { ...base, ...incoming };
}
