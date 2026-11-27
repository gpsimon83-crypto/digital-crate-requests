import type { Role } from "../types";
import type { RasterOp } from "./raster";

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
export type BurnOrigin = "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

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
  /** Glitch presets: burst schedule and limits. */
  glitch?: GlitchParams;
  /** Repeat: each cycle plays forward. Ping-pong: forward then backward, so any effect closes the loop smoothly. */
  loop?: "repeat" | "pingpong";
  /** Settings particular to one effect (see the preset's `controls`), e.g. refraction angle or the double-exposure image. */
  opts?: EffectOpts;
  /** Play on beat markers / the BPM grid instead of looping on its own: each trigger plays one cycle. */
  trigger?: Trigger;
};

export type EffectOpts = Record<string, number | string | boolean>;

export type Trigger = {
  /** Fire on the timeline's markers, or on the beat grid every `every` beats. */
  on: "markers" | "beats";
  every: number;
  /** Seconds after each marker / beat (may be negative, to land just before it). */
  offset: number;
  /** Seconds each trigger plays for. */
  length: number;
};

export type Marker = { id: string; t: number; label?: string };

export type GlitchParams = {
  /** Bursts per loop (whole number, so every repeat glitches at the same moments). */
  bursts: number;
  /** Seconds each burst lasts. */
  burstLen: number;
  /** How many horizontal slices the layer is cut into. */
  slices: number;
  /** Largest sideways move of a slice or row, in flyer px. */
  maxShift: number;
  /** Red / blue separation, in flyer px. */
  rgb: number;
  /** Noise amount, 0–1. */
  noise: number;
};

/**
 * A keyframe: offsets from the layer's saved place at one moment. Between
 * keyframes the values are interpolated; after the last one they run on
 * to the first (at its time + the loop length), so keyframed motion always
 * closes the loop. `fx` scales the strength of the layer's effects.
 */
export type Keyframe = {
  id: string;
  /** Seconds from the start of the loop (0 ≤ t < duration), on a frame. */
  t: number;
  dx: number;
  dy: number;
  /** 1 = saved size. */
  scale: number;
  rotate: number;
  /** 0–1, multiplies the layer's opacity. */
  opacity: number;
  /** 0–1, multiplies the strength of the layer's effects. */
  fx: number;
  /** How it travels to the next keyframe. */
  easing: "linear" | "easeInOut";
};

export type LayerMotion = {
  stack: MotionItem[];
  /** Keyframed transform / opacity / effect strength, on top of the effects. */
  keys?: Keyframe[];
  /** When the layer is on screen (seconds); outside it the layer is hidden. Omitted = the whole loop. */
  window?: { start: number; end: number };
  /** Hidden in the video (the design keeps the layer). */
  hidden?: boolean;
  /** Locked in Animate: its motion and position can't be changed here. */
  locked?: boolean;
  /** Overrides the layer's role for animation only (template metadata is untouched). */
  role?: Role;
  muted?: boolean;
  solo?: boolean;
  /**
   * Speed ramp for this layer's motion: points (seconds, speed 0–4; 0 = freeze)
   * joined by straight lines, wrapping around the loop. The layer's own clock is
   * rescaled so one loop still takes exactly one loop (so it always closes).
   */
  speed?: SpeedPoint[];
  /** Motion blur, 0–1 (how long the virtual shutter stays open). Based on how far the layer moves each frame. */
  blur?: number;
};

export type SpeedPoint = { t: number; speed: number };
export const MAX_SPEED_POINTS = 12;

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
  /** Beat markers on the timeline (work without any sound). */
  markers?: Marker[];
  /** Beat grid: BPM is adjusted so a whole number of beats fills the loop (shown as `beats`). */
  bpm?: { bpm: number; offset: number; show: boolean };
  /** Other sizes for export: how the flyer sits in each (never stretched). */
  formats?: Partial<Record<"story" | "portrait" | "square", { mode: "fit" | "crop"; x: number; y: number; zoom: number }>>;
};

export const DURATIONS = [6, 8, 10, 15] as const;
export const MAX_STACK = 4;
export const MAX_KEYS = 24;

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
  /** Pixel effects on the layer's own pixels, in order (glitch, grain, shine, masked reveal). */
  raster: RasterOp[];
  /** Occlusion reveal: hide this layer wherever another layer (a cutout) covers it, edge softened by `soft` px. */
  occlude?: { nodeId: string; soft: number } | null;
};

export type OverlayDraw =
  | { kind: "vignette"; color: string; alpha: number; blend: OverlayBlend }
  | { kind: "sweep"; color: string; alpha: number; pos: number; width: number; angle: number; blend: OverlayBlend }
  | { kind: "leak"; color: string; alpha: number; cx: number; cy: number; radius: number; blend: OverlayBlend }
  /** Film burn: a hot exposure bloom coming in from an edge, white core with a warm fringe. */
  | { kind: "burn"; origin: BurnOrigin; spread: number; exposure: number; tint: string; alpha: number; wobble: number; blend: OverlayBlend }
  | { kind: "particles"; style: "dust" | "sparkle"; color: string; blend: OverlayBlend; items: { x: number; y: number; r: number; a: number }[] };

export const IDENTITY: MotionState = { dx: 0, dy: 0, scale: 1, rotate: 0, opacity: 1, inner: null, reveal: null, trackingEm: 0, shadow: null, overlays: [], raster: [] };
