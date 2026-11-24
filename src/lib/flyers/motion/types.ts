import type { Role } from "../types";

/**
 * Animation settings for one flyer, stored next to the static layout
 * (flyer_designs.animation). Motion is always additive: the saved
 * positions, sizes and styling are the resting state, and turning
 * animation off gives back exactly the static flyer.
 */
export const ANIMATION_VERSION = 1 as const;

export type Easing = "easeInOut" | "linear" | "easeOut";
export type Direction = "left" | "right" | "up" | "down";
export type Intensity = "subtle" | "balanced" | "high";
export type OverlayBlend = "normal" | "screen" | "overlay" | "soft-light" | "multiply";

export type MotionItem = {
  /** Unique within the layer's stack. */
  id: string;
  /** A preset id from MOTION_PRESETS. */
  preset: string;
  /** 0–1, scaled by the overall intensity and the preset's safe maximum. */
  strength: number;
  /** Whole cycles per loop (so the loop always closes). */
  cycles: number;
  /** 0–1 start offset within a cycle. */
  phase: number;
  easing: Easing;
  direction?: Direction;
  color?: string;
  blend?: OverlayBlend;
  seed?: number;
  /** Entrance / exit share of each cycle (envelope presets); the rest is hold. */
  timing?: { in: number; out: number };
};

export type LayerMotion = {
  stack: MotionItem[];
  /** Overrides the layer's role for animation only (template metadata is untouched). */
  role?: Role;
  muted?: boolean;
  solo?: boolean;
};

export type Animation = {
  v: typeof ANIMATION_VERSION;
  enabled: boolean;
  /** Seconds: 6, 8, 10 or 15. */
  duration: number;
  fps: 30;
  intensity: Intensity;
  /** Venue, date, time and address stay visible and steady. */
  readableLock: boolean;
  recipe: string | null;
  layers: Record<string, LayerMotion>;
};

export const DURATIONS = [6, 8, 10, 15] as const;
export const MAX_STACK = 4;

export function emptyAnimation(): Animation {
  return { v: ANIMATION_VERSION, enabled: true, duration: 8, fps: 30, intensity: "balanced", readableLock: true, recipe: null, layers: {} };
}

/** What one layer looks like at one moment: offsets added to its saved state. */
export type MotionState = {
  dx: number;
  dy: number;
  scale: number;
  rotate: number;
  opacity: number;
  /** Moves the picture inside its own frame (crop-safe pan/zoom), clipped to the frame. */
  inner: { scale: number; dx: number; dy: number } | null;
  /** Letter/word reveal: 0 = none shown, 1 = all. */
  reveal: { mode: "letter" | "word"; amount: number } | null;
  /** Added letter spacing, as a share of the font size. */
  trackingEm: number;
  /** Added drop shadow offset (and a soft shadow if the layer has none). */
  shadow: { dx: number; dy: number; color: string; blur: number; opacity: number } | null;
  /** Light, vignette and particles drawn over the layer, inside its box. */
  overlays: OverlayDraw[];
};

export type OverlayDraw =
  | { kind: "vignette"; color: string; alpha: number; blend: OverlayBlend }
  | { kind: "sweep"; color: string; alpha: number; pos: number; width: number; angle: number; blend: OverlayBlend }
  | { kind: "leak"; color: string; alpha: number; cx: number; cy: number; radius: number; blend: OverlayBlend }
  | { kind: "particles"; style: "dust" | "sparkle"; color: string; blend: OverlayBlend; items: { x: number; y: number; r: number; a: number }[] };

export const IDENTITY: MotionState = { dx: 0, dy: 0, scale: 1, rotate: 0, opacity: 1, inner: null, reveal: null, trackingEm: 0, shadow: null, overlays: [] };
