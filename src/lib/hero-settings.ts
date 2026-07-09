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
