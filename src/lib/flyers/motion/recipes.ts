import type { FlyerNode, Role } from "../types";
import { PRESET_BY_ID, isProtected, presetFits, roleOf } from "./presets";
import type { Animation, LayerMotion, MotionItem } from "./types";

/**
 * One-click motion styles: a small, restrained combination per layer role.
 * Protected details (venue, date, time, address) only ever get steady,
 * readable motion. Nothing is applied to a role the flyer doesn't have.
 */
export type Recipe = { id: string; name: string; blurb: string; rules: { roles: Role[]; preset: string; patch?: Partial<MotionItem>; firstOnly?: boolean }[] };

export const RECIPES: Recipe[] = [
  {
    id: "clean-promo",
    name: "Clean Promo",
    blurb: "Calm and clear: the title eases up, the background breathes, the DJ photo floats.",
    rules: [
      { roles: ["title"], preset: "text.slide", patch: { direction: "up", strength: 0.12 }, firstOnly: true },
      { roles: ["dj_name"], preset: "text.pulse", patch: { strength: 0.15, cycles: 2 } },
      { roles: ["portrait", "dj_logo"], preset: "photos.float", patch: { strength: 0.2 } },
      { roles: ["background"], preset: "backgrounds.zoom", patch: { strength: 0.2 } }
    ]
  },
  {
    id: "club-energy",
    name: "Club Energy",
    blurb: "More movement: a light sweep and glints on the background, the title pulses, the DJ name's shadow drifts.",
    rules: [
      { roles: ["background"], preset: "backgrounds.light", patch: { strength: 0.4, cycles: 2 } },
      { roles: ["background"], preset: "overlays.sparkle", patch: { strength: 0.35 } },
      { roles: ["title"], preset: "text.pulse", patch: { strength: 0.3, cycles: 4 } },
      { roles: ["dj_name"], preset: "text.shadow", patch: { strength: 0.35, cycles: 2 } },
      { roles: ["portrait"], preset: "photos.zoom", patch: { strength: 0.25, cycles: 2 } }
    ]
  },
  {
    id: "luxury-wedding",
    name: "Luxury Wedding",
    blurb: "Slow and soft: warm dust in the air, a gentle zoom, the script breathes.",
    rules: [
      { roles: ["background"], preset: "backgrounds.zoom", patch: { strength: 0.15 } },
      { roles: ["background"], preset: "overlays.dust", patch: { strength: 0.2, color: "#f3d9a4" } },
      { roles: ["title", "text"], preset: "text.tracking", patch: { strength: 0.2 } },
      { roles: ["portrait"], preset: "photos.float", patch: { strength: 0.15 } }
    ]
  },
  {
    id: "vintage-print",
    name: "Vintage Print",
    blurb: "Printed-poster feel: the edges darken and lift, a slow pan, paper dust, the tagline types on.",
    rules: [
      { roles: ["background"], preset: "backgrounds.vignette", patch: { strength: 0.35 } },
      { roles: ["background"], preset: "backgrounds.pan", patch: { strength: 0.15 } },
      { roles: ["background"], preset: "overlays.dust", patch: { strength: 0.3, color: "#efe3c8", blend: "normal" } },
      { roles: ["details"], preset: "text.word-reveal", firstOnly: true },
      { roles: ["title"], preset: "text.tracking", patch: { strength: 0.15 } }
    ]
  }
];

let n = 0;
export const newItemId = () => `m${Date.now().toString(36)}${(n++).toString(36)}`;

export function newItem(preset: string, patch: Partial<MotionItem> = {}): MotionItem {
  const p = PRESET_BY_ID.get(preset);
  // New effects start with every setting at its default (old saved ones fall back to their legacy look).
  const opts = p?.controls?.length ? Object.fromEntries(p.controls.map((c) => [c.key, c.def])) : undefined;
  return { id: newItemId(), preset, strength: 0.25, cycles: 1, phase: 0, easing: "easeInOut", ...(p?.defaults ?? {}), ...(opts ? { opts } : {}), ...patch } as MotionItem;
}

/** The layers a recipe would animate, and with what (for the preview and the "replace?" question). */
export function planRecipe(r: Recipe, nodes: FlyerNode[], anim: Animation): Record<string, MotionItem[]> {
  const plan: Record<string, MotionItem[]> = {};
  for (const rule of r.rules) {
    const p = PRESET_BY_ID.get(rule.preset);
    if (!p) continue;
    const hits = nodes.filter((nd) => nd.visible && rule.roles.includes(roleOf(nd, anim.layers[nd.id]?.role)));
    for (const nd of rule.firstOnly ? hits.slice(0, 1) : hits) {
      const role = roleOf(nd, anim.layers[nd.id]?.role);
      if (presetFits(p, nd, role, anim.readableLock) !== true) continue;
      if (anim.readableLock && p.hidesContent && isProtected(nd, role)) continue;
      (plan[nd.id] ??= []).push(newItem(rule.preset, rule.patch));
    }
  }
  return plan;
}

/** Applies a recipe: planned layers get its stack (replacing theirs); every other layer is left as it was. */
export function applyRecipe(r: Recipe, nodes: FlyerNode[], anim: Animation): Animation {
  const plan = planRecipe(r, nodes, anim);
  const layers: Record<string, LayerMotion> = { ...anim.layers };
  for (const [id, stack] of Object.entries(plan)) layers[id] = { ...(layers[id] ?? {}), stack };
  return { ...anim, recipe: r.id, layers };
}
