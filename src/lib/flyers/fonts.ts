/**
 * Flyer fonts. Self-hosted (open-licensed, from /public/flyers/fonts) so the
 * editor, the preview and every export use exactly the same files.
 * Canvas family names are prefixed so they never clash with the app's own fonts.
 */
export type FlyerFont = { key: string; label: string; weights: number[]; italic?: number[]; file: string; category: "display" | "sans" | "serif" | "script" };

export const FLYER_FONTS: FlyerFont[] = [
  { key: "anton", label: "Anton", weights: [400], file: "anton", category: "display" },
  { key: "bebas", label: "Bebas Neue", weights: [400], file: "bebas-neue", category: "display" },
  { key: "oswald", label: "Oswald", weights: [400, 600, 700], file: "oswald", category: "display" },
  { key: "archivo-black", label: "Archivo Black", weights: [400], file: "archivo-black", category: "display" },
  { key: "bungee", label: "Bungee", weights: [400], file: "bungee", category: "display" },
  { key: "righteous", label: "Righteous", weights: [400], file: "righteous", category: "display" },
  { key: "montserrat", label: "Montserrat", weights: [400, 600, 800, 900], italic: [800], file: "montserrat", category: "sans" },
  { key: "poppins", label: "Poppins", weights: [400, 600, 800], file: "poppins", category: "sans" },
  { key: "inter", label: "Inter", weights: [400, 600, 800], file: "inter", category: "sans" },
  { key: "playfair", label: "Playfair Display", weights: [400, 700, 900], italic: [700], file: "playfair-display", category: "serif" },
  { key: "permanent-marker", label: "Permanent Marker", weights: [400], file: "permanent-marker", category: "script" },
  { key: "great-vibes", label: "Great Vibes", weights: [400], file: "great-vibes", category: "script" }
];

export const DEFAULT_FONT = "montserrat";

export function fontByKey(key: string): FlyerFont {
  return FLYER_FONTS.find((f) => f.key === key) ?? FLYER_FONTS.find((f) => f.key === DEFAULT_FONT)!;
}

/** The family name registered with the browser for a font key. */
export function canvasFamily(key: string): string {
  return `DCF ${fontByKey(key).label}`;
}

/** The closest weight the font actually has (so the canvas never fakes bold). */
export function nearestWeight(key: string, weight: number): number {
  const ws = fontByKey(key).weights;
  return ws.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), ws[0]);
}

export function hasItalic(key: string, weight: number): boolean {
  return !!fontByKey(key).italic?.includes(nearestWeight(key, weight));
}

/** Every font file, for registering with the browser (FontFace). */
export function fontFaces(): { family: string; url: string; weight: number; style: "normal" | "italic"; key: string }[] {
  return FLYER_FONTS.flatMap((f) => [
    ...f.weights.map((w) => ({ family: canvasFamily(f.key), url: `/flyers/fonts/${f.file}-latin-${w}-normal.woff2`, weight: w, style: "normal" as const, key: f.key })),
    ...(f.italic ?? []).map((w) => ({ family: canvasFamily(f.key), url: `/flyers/fonts/${f.file}-latin-${w}-italic.woff2`, weight: w, style: "italic" as const, key: f.key }))
  ]);
}
