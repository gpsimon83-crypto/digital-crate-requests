import type { FlyerNode, Role } from "../types";
import type { BurnOrigin, Direction, EffectOpts, Easing, GlitchParams, MotionItem, MotionState, OverlayBlend } from "./types";
import { burstAt } from "./raster";
import { ECHO_CONTROLS, ECHO_PRESETS, resolveEcho, type EchoKey } from "../echo";

/**
 * The motion library. Every preset here is implemented and loop-safe:
 * it is a function of u, the position within its cycle (0 ≤ u < 1), built
 * only from periodic curves, ping-pong curves or an envelope that starts
 * and ends at the same value, with whole cycles per loop. So frame N−1
 * flows into frame 0 with matching position, opacity, scale and
 * particle positions (and matching velocity for the periodic ones).
 *
 * Presets from the design spec that aren't built yet are listed in
 * PLANNED with the reason, and are never shown as working buttons.
 */

export type Category = "text" | "photos" | "echo" | "backgrounds" | "overlays" | "fx";
export type LoopStrategy = "periodic" | "ping-pong" | "wrapped-envelope" | "wrapped-pass" | "seeded-periodic";
export type ParamKey = "strength" | "cycles" | "phase" | "easing" | "direction" | "color" | "blend" | "seed" | "timing" | "glitch";

export type EvalCtx = {
  /** Cycle position 0..1 (already offset by phase, wrapped). */
  u: number;
  /** Loop position 0..1 (t / duration), for particles with their own whole-number frequencies. */
  loopU: number;
  cycles: number;
  /** strength × intensity, 0..1 (before the preset's own maximum). */
  amount: number;
  item: MotionItem;
  node: FlyerNode;
  /** The layer is protected by "Keep event details readable". */
  locked: boolean;
  scene: { width: number; height: number; safeMargin: number };
  /** Reduced-motion preview: no particles. */
  reduced: boolean;
  duration: number;
  fps: number;
  role: Role;
  /**
   * Played by a trigger (beat marker / beat grid): which trigger and how far
   * through it (0..1). Glitches use it as their burst; `undefined` = their own
   * seeded schedule.
   */
  burst?: { k: number; local: number } | null;
  /** This effect's own settings, with defaults filled in (see `controls`). */
  opts: EffectOpts;
};

/**
 * A setting particular to one effect, shown in Effect Controls. `def` is what a
 * newly added effect starts with; `legacy` is used for effects saved before the
 * setting existed, so old flyers look exactly as they did.
 */
export type Control = {
  key: string;
  label: string;
  kind: "range" | "select" | "color" | "layer" | "image" | "toggle";
  def: number | string | boolean;
  legacy?: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string }[];
  hint?: string;
};

export type Preset = {
  id: string;
  name: string;
  category: Category;
  description: string;
  loop: LoopStrategy;
  params: ParamKey[];
  defaults: Partial<MotionItem>;
  /** Hidden (or explained) when it doesn't suit the layer. */
  fits: (n: FlyerNode, role: Role) => true | string;
  /** Not allowed on protected layers while "Keep event details readable" is on. */
  hidesContent?: boolean;
  /** Breaks up the layer (glitch): also kept off protected layers while the lock is on. */
  distorts?: boolean;
  /** Also listed under these library tabs (whole-layer effects that suit several layer types). */
  also?: Category[];
  /** Settings particular to this effect. */
  controls?: Control[];
  /** What the layer needs for this effect to look right (shown as a prerequisite in the picker). */
  needs?: "cutout" | "occluder";
  apply: (s: MotionState, c: EvalCtx) => void;
};

const TAU = Math.PI * 2;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** 0 → 1 → 0 over a cycle, smooth at both ends (zero velocity at the seam). */
const wave = (u: number) => 0.5 - 0.5 * Math.cos(TAU * u);

export function ease(x: number, e: Easing) {
  const v = clamp(x, 0, 1);
  return e === "linear" ? v : e === "easeOut" ? 1 - (1 - v) * (1 - v) : 0.5 - 0.5 * Math.cos(Math.PI * v);
}
/** Ping-pong: out and back once per cycle. */
export function pingPong(u: number, e: Easing) {
  return e === "easeInOut" ? wave(u) : ease(1 - Math.abs(2 * u - 1), e);
}
/** Entrance → hold → exit: 0 at the start and end of every cycle, 1 while holding. */
export function envelope(u: number, e: Easing, timing?: { in: number; out: number }) {
  const a = clamp(timing?.in ?? 0.18, 0.02, 0.48);
  const b = clamp(timing?.out ?? 0.18, 0.02, 0.48);
  if (u < a) return ease(u / a, e);
  if (u > 1 - b) return ease((1 - u) / b, e);
  return 1;
}
const DIR: Record<Direction, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

/** Deterministic random numbers from a seed (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isText = (n: FlyerNode) => (n.kind === "text" ? true : "Text effects need a live text layer.");
const isPhoto = (n: FlyerNode, r: Role) => (n.kind === "image" && r !== "background" && r !== "overlay" ? true : n.kind !== "image" ? "Photo effects need a picture layer." : "Use the Backgrounds or Overlays effects for this layer.");
const isBackground = (_n: FlyerNode, r: Role) => (r === "background" ? true : "Background effects are for the background layer.");
/** Whole-layer moves: any layer except the background (text, photos, cutouts, logos, shapes). */
const isLayer = (_n: FlyerNode, r: Role) => (r !== "background" ? true : "Use the Backgrounds effects for the background.");
const anyLayer = () => true as const;
const isPicture = (n: FlyerNode, r: Role) => (n.kind === "image" && r !== "background" ? true : n.kind !== "image" ? "Needs a picture layer (photo, cutout or logo)." : "Use the Backgrounds effects for this layer.");
const isOverlayHost = (_n: FlyerNode, r: Role) => (r === "background" || r === "overlay" ? true : "Overlay effects draw over the background or a decorative overlay layer.");

/** How far a text box may travel in a direction and stay inside the safe area. */
function room(c: EvalCtx, d: Direction) {
  const n = c.node;
  const m = c.scene.safeMargin;
  const h = n.kind === "text" ? n.height : n.height;
  if (d === "left") return Math.max(0, n.x - m);
  if (d === "right") return Math.max(0, c.scene.width - m - (n.x + n.width));
  if (d === "up") return Math.max(0, n.y - m);
  return Math.max(0, c.scene.height - m - (n.y + h));
}

const blendOf = (i: MotionItem, d: OverlayBlend): OverlayBlend => i.blend ?? d;

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(/^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? "ffffff", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const GLITCH_LIMITS = { bursts: [1, 6], burstLen: [0.1, 1.2], slices: [2, 30], maxShift: [0, 160], rgb: [0, 40], noise: [0, 1] } as const;

/** The item's glitch settings, within limits; faces (DJ photos) get a smaller maximum move. */
function glitchOf(c: EvalCtx): GlitchParams {
  const d = (PRESET_BY_ID.get(c.item.preset)?.defaults.glitch ?? { bursts: 3, burstLen: 0.3, slices: 12, maxShift: 60, rgb: 8, noise: 0.1 }) as GlitchParams;
  const g = { ...d, ...(c.item.glitch ?? {}) };
  const lim = (k: keyof typeof GLITCH_LIMITS, v: number) => clamp(v, GLITCH_LIMITS[k][0], GLITCH_LIMITS[k][1]);
  const face = c.role === "portrait";
  return {
    bursts: Math.round(lim("bursts", g.bursts)),
    burstLen: lim("burstLen", g.burstLen),
    slices: Math.round(lim("slices", g.slices)),
    maxShift: Math.min(lim("maxShift", g.maxShift), face ? c.node.width * 0.03 : Infinity),
    rgb: Math.min(lim("rgb", g.rgb), face ? 6 : Infinity),
    noise: lim("noise", g.noise)
  };
}

/** The burst to draw now: a trigger's, or the effect's own seeded schedule. */
function burstOf(c: EvalCtx, g: GlitchParams, seed: number) {
  return c.burst !== undefined ? c.burst : burstAt(c.loopU, seed, g.bursts, g.burstLen / c.duration);
}

/** Hard horizontal slices jumping sideways, colour split and a bounded nudge (Digital Slice, RGB Slice Glitch). */
function sliceGlitch(s: MotionState, c: EvalCtx, seedDef: number, rgbK: number) {
  const g = glitchOf(c);
  const seed = c.item.seed ?? seedDef;
  const b = burstOf(c, g, seed);
  if (!b) return;
  const env = Math.sin(Math.PI * b.local);
  // The pattern holds for 2 frames at a time (digital, not jelly).
  const steps = Math.max(2, Math.round((g.burstLen * c.fps) / 2));
  const step = Math.min(steps - 1, Math.floor(b.local * steps));
  const R = rng(seed * 31 + b.k * 1013 + step * 7919);
  const shift = g.maxShift * c.amount * env;
  const cuts = Array.from({ length: Math.max(1, g.slices - 1) }, () => R()).sort((x, y) => x - y);
  const edges = [0, ...cuts, 1];
  const bands: { y0: number; y1: number; dx: number }[] = [];
  for (let i = 0; i < edges.length - 1; i++) if (R() < 0.45) bands.push({ y0: edges[i], y1: edges[i + 1], dx: (R() * 2 - 1) * shift });
  s.raster.push({ kind: "slices", bands });
  const sep = g.rgb * rgbK * c.amount * env;
  if (sep >= 0.5) s.raster.push({ kind: "rgb", rdx: sep, rdy: 0, bdx: -sep, bdy: 0 });
  if (g.noise > 0) s.raster.push({ kind: "noise", amount: g.noise * 0.35 * env, seed: b.k * 97 + step, mono: false });
  // Brief, bounded nudge of the whole layer.
  s.dx += (R() - 0.5) * shift * 0.12;
}

const num = (c: EvalCtx, k: string, d: number) => (typeof c.opts[k] === "number" ? (c.opts[k] as number) : d);
const str = (c: EvalCtx, k: string, d: string) => (typeof c.opts[k] === "string" ? (c.opts[k] as string) : d);

/** App-owned pictures offered as the second image of a double exposure. */
export const DOUBLE_IMAGES = [
  { value: "/flyers/dj-night/concert-photo.jpg", label: "Crowd and stage lights" },
  { value: "/project/covers/event-02.jpg", label: "Dance floor, purple" },
  { value: "/project/covers/cover-04.jpg", label: "Disco ball dance floor" },
  { value: "/project/covers/event-04.jpg", label: "DJ decks, gold lights" },
  { value: "/project/covers/cover-02.jpg", label: "Red stage" },
  { value: "/project/covers/venue-03.jpg", label: "Venue: waterfront lounge" },
  { value: "/project/covers/venue-01.jpg", label: "Venue: chandelier ballroom" },
  { value: "/flyers/sample/club-night-portrait.jpg", label: "Club light beams" },
  { value: "/flyers/sample/backgrounds/violet-nightclub.png", label: "Violet nightclub" },
  { value: "/flyers/sample/backgrounds/gold-ballroom.png", label: "Gold ballroom" },
  { value: "/flyers/sample/backgrounds/tropical-patio.png", label: "Tropical patio" },
  { value: "/flyers/sample/backgrounds/charcoal-studio.png", label: "Charcoal studio" }
];

const ORIGINS: { value: BurnOrigin; label: string }[] = [
  { value: "left", label: "Left edge" },
  { value: "right", label: "Right edge" },
  { value: "top", label: "Top edge" },
  { value: "bottom", label: "Bottom edge" },
  { value: "top-left", label: "Top-left corner" },
  { value: "top-right", label: "Top-right corner" },
  { value: "bottom-left", label: "Bottom-left corner" },
  { value: "bottom-right", label: "Bottom-right corner" }
];

export const MOTION_PRESETS: Preset[] = [
  // ---------------- text ----------------
  {
    id: "text.fade",
    name: "Soft Fade",
    category: "text",
    description: "Fades down and back up (text, photos, logos)",
    loop: "wrapped-envelope",
    params: ["strength", "cycles", "phase", "easing", "timing"],
    defaults: { strength: 0.25, cycles: 1, phase: 0, easing: "easeInOut", timing: { in: 0.2, out: 0.2 } },
    also: ["photos"],
    fits: isLayer,
    // Protected details only dip 15% (they never disappear).
    apply: (s, c) => {
      const dip = clamp(c.amount, 0, 1) * (c.locked ? 0.15 : 0.9);
      s.opacity *= 1 - dip * (1 - envelope(c.u, c.item.easing, c.item.timing));
    }
  },
  {
    id: "text.slide",
    name: "Slide & Return",
    category: "text",
    description: "A short move in one direction and back, inside the safe area",
    loop: "ping-pong",
    params: ["strength", "direction", "cycles", "phase", "easing"],
    defaults: { strength: 0.25, cycles: 1, phase: 0, easing: "easeInOut", direction: "up" },
    also: ["photos"],
    fits: isLayer,
    apply: (s, c) => {
      const d = c.item.direction ?? "up";
      // Never past the safe area; protected details move at most 16 px.
      const amp = Math.min(c.amount * 200, room(c, d), c.locked ? 16 : Infinity);
      const p = pingPong(c.u, c.item.easing);
      s.dx += DIR[d][0] * amp * p;
      s.dy += DIR[d][1] * amp * p;
    }
  },
  {
    id: "text.letter-reveal",
    name: "Letter Reveal",
    category: "text",
    description: "Letters appear one by one, hold, then leave in reverse",
    loop: "wrapped-envelope",
    params: ["cycles", "phase", "easing", "timing"],
    defaults: { strength: 1, cycles: 1, phase: 0, easing: "linear", timing: { in: 0.25, out: 0.15 } },
    fits: isText,
    hidesContent: true,
    apply: (s, c) => {
      const a = envelope(c.u, c.item.easing, c.item.timing);
      s.reveal = { mode: "letter", amount: Math.min(s.reveal?.amount ?? 1, a) };
    }
  },
  {
    id: "text.word-reveal",
    name: "Word Reveal",
    category: "text",
    description: "Words appear in reading order, hold, then leave in reverse",
    loop: "wrapped-envelope",
    params: ["cycles", "phase", "easing", "timing"],
    defaults: { strength: 1, cycles: 1, phase: 0, easing: "linear", timing: { in: 0.25, out: 0.15 } },
    fits: isText,
    hidesContent: true,
    apply: (s, c) => {
      const a = envelope(c.u, c.item.easing, c.item.timing);
      s.reveal = { mode: "word", amount: Math.min(s.reveal?.amount ?? 1, a) };
    }
  },
  {
    id: "text.pulse",
    name: "Scale Pulse",
    category: "text",
    description: "A small grow-and-settle, like a beat",
    loop: "periodic",
    params: ["strength", "cycles", "phase"],
    defaults: { strength: 0.25, cycles: 2, phase: 0, easing: "easeInOut" },
    also: ["photos"],
    fits: isLayer,
    apply: (s, c) => {
      const w = wave(c.u);
      s.scale *= 1 + Math.min(c.amount * 0.12, c.locked ? 0.03 : 0.12) * w;
      s.opacity *= 1 - Math.min(c.amount * 0.15, c.locked ? 0.05 : 0.15) * w;
    }
  },
  {
    id: "text.shadow",
    name: "Shadow Drift",
    category: "text",
    description: "The drop shadow circles slowly under the words",
    loop: "periodic",
    params: ["strength", "cycles", "phase", "color"],
    defaults: { strength: 0.25, cycles: 1, phase: 0, easing: "easeInOut", color: "#000000" },
    fits: isText,
    apply: (s, c) => {
      const r = c.amount * 40;
      const a = TAU * c.u;
      s.shadow = { dx: (s.shadow?.dx ?? 0) + r * Math.cos(a), dy: (s.shadow?.dy ?? 0) + r * Math.sin(a), color: c.item.color ?? "#000000", blur: 10 + r * 0.5, opacity: 0.55 };
    }
  },
  {
    id: "text.tracking",
    name: "Tracking Breathe",
    category: "text",
    description: "Letter spacing opens up a little and returns",
    loop: "periodic",
    params: ["strength", "cycles", "phase"],
    defaults: { strength: 0.25, cycles: 1, phase: 0, easing: "easeInOut" },
    fits: isText,
    apply: (s, c) => {
      s.trackingEm += Math.min(c.amount * 0.16, c.locked ? 0.03 : 0.16) * wave(c.u);
    }
  },
  // ---------------- photos ----------------
  {
    id: "photos.float",
    name: "Gentle Float",
    category: "photos",
    description: "A slow up-and-down drift; the layer itself never changes",
    loop: "periodic",
    params: ["strength", "cycles", "phase"],
    defaults: { strength: 0.25, cycles: 1, phase: 0, easing: "easeInOut" },
    also: ["text"],
    fits: isLayer,
    apply: (s, c) => {
      s.dy -= c.amount * 60 * Math.sin(TAU * c.u);
    }
  },
  {
    id: "photos.zoom",
    name: "Slow Push & Return",
    category: "photos",
    description: "Eases in from the saved framing and back, inside the frame",
    loop: "ping-pong",
    params: ["strength", "cycles", "phase", "easing"],
    defaults: { strength: 0.25, cycles: 1, phase: 0, easing: "easeInOut" },
    fits: isPhoto,
    apply: (s, c) => {
      const z = 1 + c.amount * 0.4 * pingPong(c.u, c.item.easing);
      s.inner = { scale: (s.inner?.scale ?? 1) * z, dx: s.inner?.dx ?? 0, dy: s.inner?.dy ?? 0 };
    }
  },
  // ---------------- backgrounds ----------------
  {
    id: "backgrounds.pan",
    name: "Slow Pan & Return",
    category: "backgrounds",
    description: "Drifts sideways and back without showing an edge",
    loop: "ping-pong",
    params: ["strength", "direction", "cycles", "phase", "easing"],
    defaults: { strength: 0.25, cycles: 1, phase: 0, easing: "easeInOut", direction: "right" },
    fits: isBackground,
    apply: (s, c) => {
      const a = clamp(c.amount, 0, 1) * 0.2;
      const p = 2 * pingPong(c.u, c.item.easing) - 1; // −1 … 1
      const d = c.item.direction ?? "right";
      const horiz = d === "left" || d === "right";
      const sign = d === "left" || d === "up" ? -1 : 1;
      // Scaled up by 1 + 2a so a travel of a·size each way stays covered.
      const base = s.inner ?? { scale: 1, dx: 0, dy: 0 };
      s.inner = {
        scale: base.scale * (1 + 2 * a),
        dx: base.dx + (horiz ? sign * a * c.node.width * p : 0),
        dy: base.dy + (horiz ? 0 : sign * a * c.node.height * p)
      };
    }
  },
  {
    id: "backgrounds.zoom",
    name: "Background Breathing",
    category: "backgrounds",
    description: "A slow, gentle zoom in and out",
    loop: "periodic",
    params: ["strength", "cycles", "phase"],
    defaults: { strength: 0.25, cycles: 1, phase: 0, easing: "easeInOut" },
    fits: isBackground,
    apply: (s, c) => {
      const base = s.inner ?? { scale: 1, dx: 0, dy: 0 };
      s.inner = { ...base, scale: base.scale * (1 + c.amount * 0.3 * wave(c.u)) };
    }
  },
  {
    id: "backgrounds.light",
    name: "Light Sweep",
    category: "backgrounds",
    description: "A soft band of light passes across once per cycle",
    loop: "wrapped-pass",
    params: ["strength", "cycles", "phase", "color", "blend"],
    defaults: { strength: 0.35, cycles: 1, phase: 0, easing: "easeInOut", color: "#fff4d6", blend: "screen" },
    fits: isBackground,
    apply: (s, c) => {
      // Starts and ends fully off the layer, so the wrap is invisible.
      s.overlays.push({ kind: "sweep", color: c.item.color ?? "#fff4d6", alpha: Math.min(0.7, c.amount * 0.8), pos: -0.35 + 1.7 * ease(c.u, c.item.easing), width: 0.28, angle: 20, blend: blendOf(c.item, "screen") });
    }
  },
  {
    id: "backgrounds.vignette",
    name: "Vignette Breathe",
    category: "backgrounds",
    description: "The edges darken a little and lift again",
    loop: "periodic",
    params: ["strength", "cycles", "phase", "color"],
    defaults: { strength: 0.35, cycles: 1, phase: 0, easing: "easeInOut", color: "#000000" },
    fits: isBackground,
    apply: (s, c) => {
      s.overlays.push({ kind: "vignette", color: c.item.color ?? "#000000", alpha: Math.min(0.85, c.amount * (0.45 + 0.45 * wave(c.u))), blend: blendOf(c.item, "normal") });
    }
  },
  // ---------------- overlays ----------------
  {
    id: "overlays.dust",
    name: "Dust Float",
    category: "overlays",
    description: "Seeded specks drifting on closed paths",
    loop: "seeded-periodic",
    params: ["strength", "color", "blend", "seed"],
    defaults: { strength: 0.3, cycles: 1, phase: 0, easing: "easeInOut", color: "#f6ead2", blend: "screen", seed: 48 },
    fits: isOverlayHost,
    apply: (s, c) => {
      if (c.reduced) return;
      const R = rng(c.item.seed ?? 48);
      const n = Math.round(clamp(8 + c.amount * 90, 0, 80));
      const items: { x: number; y: number; r: number; a: number }[] = [];
      for (let i = 0; i < n; i++) {
        const x0 = R(), y0 = R(), r = 1.2 + R() * 3.2, ax = 10 + R() * 40, ay = 18 + R() * 60;
        // Whole-number frequencies per loop: every speck is back where it started at the seam.
        const fx = 1 + Math.floor(R() * 2), fy = 1 + Math.floor(R() * 2), fa = 1 + Math.floor(R() * 3);
        const px = R(), py = R(), pa = R(), base = 0.25 + R() * 0.55;
        items.push({
          x: x0 * c.node.width + ax * Math.sin(TAU * (fx * c.loopU + px)),
          y: y0 * c.node.height + ay * Math.sin(TAU * (fy * c.loopU + py)),
          r,
          a: base * (0.55 + 0.45 * Math.sin(TAU * (fa * c.loopU + pa)))
        });
      }
      s.overlays.push({ kind: "particles", style: "dust", color: c.item.color ?? "#f6ead2", blend: blendOf(c.item, "screen"), items });
    }
  },
  {
    id: "overlays.sparkle",
    name: "Sparse Sparkles",
    category: "overlays",
    description: "A few seeded glints that twinkle and fade",
    loop: "seeded-periodic",
    params: ["strength", "color", "blend", "seed"],
    defaults: { strength: 0.3, cycles: 1, phase: 0, easing: "easeInOut", color: "#ffffff", blend: "screen", seed: 48 },
    fits: isOverlayHost,
    apply: (s, c) => {
      if (c.reduced) return;
      const R = rng((c.item.seed ?? 48) + 7);
      const n = Math.round(clamp(4 + c.amount * 30, 0, 30));
      const items: { x: number; y: number; r: number; a: number }[] = [];
      for (let i = 0; i < n; i++) {
        const x = R() * c.node.width, y = R() * c.node.height, r = 6 + R() * 14, f = 1 + Math.floor(R() * 3), p = R();
        // Brief, soft glints (never a full-frame flash).
        const b = Math.pow(Math.max(0, Math.sin(TAU * (f * c.loopU + p))), 6);
        items.push({ x, y, r, a: Math.min(0.9, b * (0.5 + c.amount)) });
      }
      s.overlays.push({ kind: "particles", style: "sparkle", color: c.item.color ?? "#ffffff", blend: blendOf(c.item, "screen"), items });
    }
  },
  {
    id: "overlays.leak",
    name: "Light Leak",
    category: "overlays",
    description: "A soft warm glow blooms at one edge and fades",
    loop: "wrapped-envelope",
    params: ["strength", "direction", "cycles", "phase", "color", "blend", "timing"],
    defaults: { strength: 0.35, cycles: 1, phase: 0, easing: "easeInOut", color: "#ff7a2e", blend: "screen", direction: "right", timing: { in: 0.35, out: 0.35 } },
    fits: isOverlayHost,
    apply: (s, c) => {
      const d = c.item.direction ?? "right";
      const [cx, cy] = d === "left" ? [0, 0.3] : d === "right" ? [1, 0.25] : d === "up" ? [0.7, 0] : [0.3, 1];
      s.overlays.push({ kind: "leak", color: c.item.color ?? "#ff7a2e", alpha: Math.min(0.6, c.amount * 0.9) * envelope(c.u, c.item.easing, c.item.timing), cx, cy, radius: 0.75, blend: blendOf(c.item, "screen") });
    }
  },
  // ---------------- whole-layer + pixel effects ----------------
  {
    id: "text.zoom",
    name: "Slow Zoom & Return",
    category: "text",
    description: "The whole layer grows a little and settles back",
    loop: "ping-pong",
    params: ["strength", "cycles", "phase", "easing"],
    defaults: { strength: 0.3, cycles: 1, phase: 0, easing: "easeInOut" },
    also: ["photos"],
    fits: isLayer,
    apply: (s, c) => {
      s.scale *= 1 + Math.min(c.amount * 0.12, c.locked ? 0.03 : 0.12) * pingPong(c.u, c.item.easing);
    }
  },
  {
    id: "text.shine",
    name: "Text Shine Sweep",
    category: "text",
    description: "A bright band glides across the letters only (never the box)",
    loop: "wrapped-pass",
    params: ["strength", "cycles", "phase", "easing", "color"],
    defaults: { strength: 0.6, cycles: 1, phase: 0, easing: "easeInOut", color: "#ffffff" },
    also: ["photos"],
    fits: (n, r) => (r !== "background" ? true : "Use Light Sweep on the background."),
    apply: (s, c) => {
      // Crosses in the first 45% of each cycle, fully off the layer before and after: an invisible wrap.
      const k = c.u / 0.45;
      if (k >= 1) return;
      s.raster.push({ kind: "shine", pos: -0.3 + 1.6 * ease(k, c.item.easing), width: 0.22, angle: 18, alpha: Math.min(0.85, c.amount * 0.9), color: hexRgb(c.item.color ?? "#ffffff") });
    }
  },
  {
    id: "photos.reveal",
    name: "Masked Reveal",
    category: "photos",
    description: "A soft-edged wipe reveals the picture, following its cutout edges, then hides it again",
    loop: "wrapped-envelope",
    params: ["direction", "cycles", "phase", "easing", "timing"],
    defaults: { strength: 1, cycles: 1, phase: 0, easing: "easeInOut", direction: "right", timing: { in: 0.2, out: 0.15 } },
    fits: isPicture,
    hidesContent: true,
    apply: (s, c) => {
      s.raster.push({ kind: "wipe", amount: envelope(c.u, c.item.easing, c.item.timing), dir: c.item.direction ?? "right", soft: 0.12 });
    }
  },
  {
    id: "fx.digital-slice",
    name: "Digital Slice",
    category: "fx",
    description: "Short bursts: hard horizontal slices jump sideways, a hint of colour split, then a clean recovery",
    loop: "seeded-periodic",
    params: ["strength", "seed", "glitch"],
    defaults: { strength: 0.6, cycles: 1, phase: 0, easing: "linear", seed: 48, glitch: { bursts: 3, burstLen: 0.3, slices: 14, maxShift: 70, rgb: 6, noise: 0.1 } },
    fits: anyLayer,
    distorts: true,
    apply: (s, c) => sliceGlitch(s, c, 48, 0.5)
  },
  {
    id: "fx.rgb-signal",
    name: "RGB Signal",
    category: "fx",
    description: "Short bursts: the red and blue channels pull apart and the picture bends like a weak signal",
    loop: "seeded-periodic",
    params: ["strength", "seed", "glitch"],
    defaults: { strength: 0.6, cycles: 1, phase: 0, easing: "linear", seed: 21, glitch: { bursts: 2, burstLen: 0.6, slices: 4, maxShift: 40, rgb: 16, noise: 0.05 } },
    fits: anyLayer,
    distorts: true,
    apply: (s, c) => {
      const g = glitchOf(c);
      const b = burstOf(c, g, c.item.seed ?? 21);
      if (!b) return;
      const env = Math.sin(Math.PI * b.local);
      // Smooth within the burst: the channels swing apart and back (analog feel, no blocks).
      const R = rng((c.item.seed ?? 21) * 17 + b.k * 389);
      const dir = R() < 0.5 ? -1 : 1;
      const sep = g.rgb * c.amount * env;
      s.raster.push({ kind: "rowwave", y0: 0, y1: 1, amp: g.maxShift * 0.35 * c.amount * env, freq: Math.max(1, Math.round(g.slices / 2)), phase: b.local * 1.5 + R() });
      s.raster.push({ kind: "rgb", rdx: dir * sep, rdy: sep * 0.2, bdx: -dir * sep, bdy: -sep * 0.2 });
      s.raster.push({ kind: "exposure", gain: 1 + 0.08 * env * Math.sin(Math.PI * 6 * b.local) });
      if (g.noise > 0) s.raster.push({ kind: "noise", amount: g.noise * 0.25 * env, seed: b.k * 53 + Math.floor(b.local * 8), mono: false });
    }
  },
  {
    id: "fx.vhs",
    name: "Analog VHS",
    category: "fx",
    description: "A tape look: scanlines, colour bleed, rolling tracking lines, a little line jitter and brief signal tears",
    loop: "seeded-periodic",
    params: ["strength", "seed", "glitch"],
    defaults: { strength: 0.5, cycles: 1, phase: 0, easing: "linear", seed: 7, glitch: { bursts: 2, burstLen: 0.5, slices: 3, maxShift: 50, rgb: 4, noise: 0.2 } },
    also: ["overlays"],
    // Tracking: added later. Older saved VHS effects keep exactly their look (the `legacy` values).
    controls: [
      { key: "rolls", label: "Tracking rolls", kind: "range", def: 2, legacy: 2, min: 1, max: 6, step: 1, unit: "per loop", hint: "Tracking lines rolling down the picture (whole numbers, so the loop closes)." },
      { key: "jitter", label: "Line jitter", kind: "range", def: 0.15, legacy: 0, min: 0, max: 1, step: 0.05, hint: "Small sideways wobble of thin lines." },
      { key: "tear", label: "Signal tears", kind: "range", def: 0.5, legacy: 1, min: 0, max: 1, step: 0.05, hint: "How far the picture tears during each burst." }
    ],
    fits: anyLayer,
    distorts: true,
    apply: (s, c) => {
      const g = glitchOf(c);
      const a = c.amount;
      const seed = c.item.seed ?? 7;
      const rolls = Math.max(1, Math.round(num(c, "rolls", 2)));
      const jitter = clamp(num(c, "jitter", 0), 0, 1);
      const tear = clamp(num(c, "tear", 1), 0, 1);
      // Always on, and periodic over the loop: whole numbers of scanline scrolls and tracking rolls.
      s.raster.push({ kind: "rgb", rdx: 1 + g.rgb * 0.5 * a, rdy: 0, bdx: -(0.6 + g.rgb * 0.3 * a), bdy: 0 });
      const band = c.loopU * rolls - Math.floor(c.loopU * rolls);
      s.raster.push({ kind: "rowwave", y0: band - 0.05, y1: band + 0.05, amp: 4 + 10 * a, freq: 1, phase: 0 });
      // Head-switching wobble along the bottom edge.
      s.raster.push({ kind: "slices", bands: [{ y0: 0.965, y1: 1, dx: (3 + 6 * a) * Math.sin(TAU * 15 * c.loopU) }] });
      if (jitter > 0) {
        // Thin lines nudged sideways, a new pattern 15 times a second (repeats identically every loop).
        const R = rng(seed * 7 + Math.floor(c.loopU * c.duration * 15) * 131);
        const bands: { y0: number; y1: number; dx: number }[] = [];
        for (let y = 0; y < 1; y += 1 / 60) if (R() < 0.35) bands.push({ y0: y, y1: y + 1 / 120, dx: (R() * 2 - 1) * 5 * jitter * (0.5 + a) });
        s.raster.push({ kind: "slices", bands });
      }
      const b = burstOf(c, g, seed);
      if (b && tear > 0) {
        const env = Math.sin(Math.PI * b.local);
        const R = rng(seed * 13 + b.k * 211);
        const y = 0.15 + R() * 0.6;
        s.raster.push({ kind: "rowwave", y0: y, y1: y + 0.12 + 0.05 * g.slices / 10, amp: g.maxShift * a * env * tear, freq: 1.5, phase: b.local * 0.5 });
      }
      s.raster.push({ kind: "scan", alpha: 0.1 + 0.15 * a, spacing: 4, offset: c.loopU * 4 * 30 });
      s.raster.push({ kind: "noise", amount: g.noise * 0.3 * a, seed: Math.floor(c.loopU * c.duration * 15), mono: false });
      s.raster.push({ kind: "exposure", gain: 1 + 0.03 * a * Math.sin(TAU * 7 * c.loopU) });
    }
  },
  {
    id: "fx.grain",
    name: "Film Grain",
    category: "fx",
    description: "Fine moving film grain on the layer's own pixels (transparent areas stay clear)",
    loop: "seeded-periodic",
    params: ["strength"],
    defaults: { strength: 0.35, cycles: 1, phase: 0, easing: "linear" },
    also: ["photos", "backgrounds"],
    fits: anyLayer,
    apply: (s, c) => {
      // A new grain pattern 12 times a second, from the frame's place in the loop (identical every repeat).
      s.raster.push({ kind: "noise", amount: Math.min(c.locked ? 0.06 : 0.25, 0.03 + c.amount * 0.2), seed: 1000 + Math.floor(c.loopU * c.duration * 12), mono: true });
    }
  },
  {
    id: "photos.rgb-slice",
    name: "RGB Slice Glitch",
    category: "photos",
    description: "One short burst: the photo splits into red / blue and slides in slices, then settles back into a clean portrait",
    loop: "seeded-periodic",
    params: ["strength", "seed", "glitch"],
    defaults: { strength: 0.65, cycles: 1, phase: 0, easing: "linear", seed: 5, glitch: { bursts: 1, burstLen: 0.45, slices: 16, maxShift: 56, rgb: 14, noise: 0.06 } },
    also: ["fx"],
    fits: isLayer,
    distorts: true,
    apply: (s, c) => sliceGlitch(s, c, 5, 1)
  },
  {
    id: "photos.refraction",
    name: "Refraction",
    category: "photos",
    description: "The picture seen through angled glass bands that slowly slide across it, with a little colour dispersion",
    loop: "periodic",
    params: ["strength"],
    defaults: { strength: 0.6, cycles: 1, phase: 0, easing: "linear" },
    also: ["backgrounds", "fx"],
    controls: [
      { key: "angle", label: "Angle", kind: "range", def: 24, min: -90, max: 90, step: 1, unit: "°" },
      { key: "band", label: "Band width", kind: "range", def: 90, min: 12, max: 320, step: 2, unit: "px" },
      { key: "disp", label: "Displacement", kind: "range", def: 20, min: 0, max: 60, step: 1, unit: "px" },
      { key: "disperse", label: "Dispersion", kind: "range", def: 4, min: 0, max: 20, step: 0.5, unit: "px", hint: "Red and blue bend a little differently: rainbow edges." },
      { key: "sweeps", label: "Sweep speed", kind: "range", def: 1, min: 0, max: 6, step: 1, unit: "bands per loop", hint: "Whole bands per loop, so the loop closes. 0 = still glass." }
    ],
    fits: anyLayer,
    distorts: true,
    apply: (s, c) => {
      const band = clamp(num(c, "band", 90), 12, 320);
      const k = c.locked ? 0.3 : 1;
      s.raster.push({ kind: "refract", angle: num(c, "angle", 24), band, disp: clamp(num(c, "disp", 20), 0, 60) * c.amount * k, disperse: clamp(num(c, "disperse", 4), 0, 20) * c.amount * k, pos: c.loopU * Math.round(num(c, "sweeps", 1)) * band });
    }
  },
  {
    id: "overlays.prism",
    name: "Prism Sweep",
    category: "overlays",
    description: "A band of prism glass passes over the layer, bending it with rainbow edges, then it's clear again",
    loop: "wrapped-pass",
    params: ["strength", "cycles", "phase", "easing"],
    defaults: { strength: 0.7, cycles: 1, phase: 0, easing: "easeInOut" },
    also: ["photos", "fx"],
    controls: [
      { key: "angle", label: "Angle", kind: "range", def: 70, min: -90, max: 90, step: 1, unit: "°" },
      { key: "width", label: "Sweep width", kind: "range", def: 0.35, min: 0.1, max: 0.8, step: 0.05 },
      { key: "band", label: "Band width", kind: "range", def: 48, min: 12, max: 200, step: 2, unit: "px" },
      { key: "disp", label: "Displacement", kind: "range", def: 16, min: 0, max: 50, step: 1, unit: "px" },
      { key: "disperse", label: "Dispersion", kind: "range", def: 10, min: 0, max: 24, step: 0.5, unit: "px" }
    ],
    fits: anyLayer,
    distorts: true,
    apply: (s, c) => {
      // Crosses in the first 60% of each cycle, off the layer before and after: an invisible wrap.
      const k = c.u / 0.6;
      if (k >= 1) return;
      const w = clamp(num(c, "width", 0.35), 0.1, 0.8);
      const lk = c.locked ? 0.3 : 1;
      s.raster.push({ kind: "refract", angle: num(c, "angle", 70), band: clamp(num(c, "band", 48), 12, 200), disp: num(c, "disp", 16) * c.amount * lk, disperse: num(c, "disperse", 10) * c.amount * lk, pos: k * 120, window: { centre: -w / 2 + (1 + w) * ease(k, c.item.easing), width: w } });
    }
  },
  {
    id: "overlays.burn",
    name: "Film Burn",
    category: "overlays",
    description: "A hot exposure blooms in from an edge with a warm fringe, then fades. On the background it stays behind all text",
    loop: "wrapped-envelope",
    params: ["strength", "cycles", "phase"],
    defaults: { strength: 0.8, cycles: 1, phase: 0.1, easing: "easeOut" },
    also: ["photos", "backgrounds"],
    controls: [
      { key: "origin", label: "Origin", kind: "select", def: "right", options: ORIGINS },
      { key: "spread", label: "Spread", kind: "range", def: 0.75, min: 0.2, max: 1.6, step: 0.05 },
      { key: "exposure", label: "Exposure", kind: "range", def: 0.75, min: 0, max: 1, step: 0.05, hint: "How white-hot the centre gets." },
      { key: "tint", label: "Tint", kind: "color", def: "#ff6a1a" },
      { key: "length", label: "Duration", kind: "range", def: 1.8, min: 0.4, max: 6, step: 0.1, unit: "s" },
      { key: "curve", label: "Reveal curve", kind: "select", def: "fast", options: [{ value: "fast", label: "Flash in, slow fade" }, { value: "smooth", label: "Smooth swell" }, { value: "slow", label: "Slow burn" }] }
    ],
    fits: (n, r) => (n.kind === "image" || r === "background" || r === "overlay" ? true : "Film Burn goes on a picture or the background (so text stays readable on top)."),
    apply: (s, c) => {
      const cycleLen = c.duration / c.cycles;
      const active = clamp(num(c, "length", 1.8) / cycleLen, 0.05, 0.95);
      const k = c.u / active;
      if (k >= 1) return;
      const curve = str(c, "curve", "fast");
      const env = curve === "fast" ? (k < 0.12 ? ease(k / 0.12, "easeOut") : 1 - ease((k - 0.12) / 0.88, "easeInOut")) : curve === "slow" ? (k < 0.6 ? ease(k / 0.6, "easeInOut") : 1 - ease((k - 0.6) / 0.4, "easeInOut")) : Math.sin(Math.PI * k);
      s.overlays.push({ kind: "burn", origin: str(c, "origin", "right") as BurnOrigin, spread: clamp(num(c, "spread", 0.75), 0.2, 1.6) * (0.75 + 0.25 * env), exposure: clamp(num(c, "exposure", 0.75), 0, 1), tint: str(c, "tint", "#ff6a1a"), alpha: Math.min(1, c.amount * 1.1) * env, wobble: Math.sin(TAU * 2.5 * k), blend: blendOf(c.item, "screen") });
    }
  },
  {
    id: "photos.double",
    name: "Double Exposure",
    category: "photos",
    description: "A second picture (a crowd, a venue) blended inside the DJ's silhouette, faded around the face so it stays readable",
    loop: "ping-pong",
    params: ["strength"],
    defaults: { strength: 0.85, cycles: 1, phase: 0, easing: "easeInOut" },
    needs: "cutout",
    controls: [
      { key: "image", label: "Second image", kind: "image", def: DOUBLE_IMAGES[0].value, options: DOUBLE_IMAGES },
      { key: "blend", label: "Blend", kind: "select", def: "screen", options: [{ value: "screen", label: "Screen (light)" }, { value: "lighten", label: "Lighten" }, { value: "overlay", label: "Overlay" }, { value: "soft-light", label: "Soft light" }, { value: "multiply", label: "Multiply (dark)" }, { value: "normal", label: "Normal" }] },
      { key: "opacity", label: "Opacity", kind: "range", def: 0.8, min: 0, max: 1, step: 0.05 },
      { key: "scale", label: "Image size", kind: "range", def: 1.15, min: 0.5, max: 3, step: 0.05 },
      { key: "x", label: "Image across", kind: "range", def: 0, min: -1, max: 1, step: 0.02 },
      { key: "y", label: "Image up/down", kind: "range", def: 0, min: -1, max: 1, step: 0.02 },
      { key: "feather", label: "Edge feather", kind: "range", def: 16, min: 0, max: 80, step: 1, unit: "px" },
      { key: "faceFade", label: "Face fade", kind: "range", def: 0.85, min: 0, max: 1, step: 0.05, hint: "Keeps the face clear of the second image." },
      { key: "faceX", label: "Face across", kind: "range", def: 0.5, min: 0, max: 1, step: 0.01 },
      { key: "faceY", label: "Face up/down", kind: "range", def: 0.26, min: 0, max: 1, step: 0.01 },
      { key: "faceSize", label: "Face size", kind: "range", def: 0.28, min: 0.08, max: 0.8, step: 0.01 },
      { key: "drift", label: "Image drift", kind: "range", def: 0.25, min: 0, max: 1, step: 0.05, hint: "Slow drift of the second image (back and forth, so the loop closes)." }
    ],
    fits: isPicture,
    apply: (s, c) => {
      const n = c.node;
      const drift = clamp(num(c, "drift", 0.25), 0, 1) * pingPong(c.u, "easeInOut");
      s.raster.push({
        kind: "double",
        src: str(c, "image", DOUBLE_IMAGES[0].value),
        box: { x: n.x, y: n.y, w: n.width, h: n.height },
        blend: str(c, "blend", "screen") as "screen",
        opacity: clamp(num(c, "opacity", 0.8), 0, 1) * Math.min(1, c.amount / 0.85),
        scale: clamp(num(c, "scale", 1.15), 0.5, 3) * (1 + 0.06 * drift),
        ox: clamp(num(c, "x", 0), -1, 1),
        oy: clamp(num(c, "y", 0), -1, 1) - 0.08 * drift,
        feather: clamp(num(c, "feather", 16), 0, 80),
        face: { x: num(c, "faceX", 0.5), y: num(c, "faceY", 0.26), size: num(c, "faceSize", 0.28), amount: clamp(num(c, "faceFade", 0.85), 0, 1) }
      });
    }
  },
  {
    id: "text.occlude",
    name: "Occlusion Reveal",
    category: "text",
    description: "The text (or a logo) slides out from behind the DJ cutout, hidden wherever the portrait covers it",
    loop: "wrapped-envelope",
    params: ["direction", "cycles", "phase", "easing", "timing"],
    defaults: { strength: 1, cycles: 1, phase: 0, easing: "easeInOut", direction: "right", timing: { in: 0.22, out: 0.18 } },
    also: ["photos"],
    needs: "occluder",
    controls: [
      { key: "occluder", label: "Behind", kind: "layer", def: "", hint: "The cutout it hides behind (a photo with a transparent background, or with a mask)." },
      { key: "travel", label: "Travel", kind: "range", def: 320, min: 20, max: 1200, step: 10, unit: "px" },
      { key: "soft", label: "Edge softness", kind: "range", def: 6, min: 0, max: 40, step: 1, unit: "px" }
    ],
    fits: (n, r) => (r === "background" ? "Pick the text or logo that should come out from behind the portrait." : n.kind === "text" || n.kind === "image" ? true : "Needs a text or logo layer."),
    hidesContent: true,
    apply: (s, c) => {
      const env = envelope(c.u, c.item.easing, c.item.timing);
      const [dx, dy] = DIR[c.item.direction ?? "right"];
      const travel = clamp(num(c, "travel", 320), 0, 1200);
      // At rest when fully out; `travel` px back behind the portrait before / after.
      s.dx -= dx * travel * (1 - env);
      s.dy -= dy * travel * (1 - env);
      const occ = str(c, "occluder", "");
      if (occ && occ !== c.node.id) s.occlude = { nodeId: occ, soft: clamp(num(c, "soft", 6), 0, 40) };
    }
  }
];

/**
 * Echo: copies of a picture layer behind it (Effects → Echo on the still
 * flyer). Here they move: trails breathe, outlines and zoom copies flow
 * outward one copy per cycle, orbits turn once per cycle, slices slide. The
 * drawing is the same as the still flyer's (lib/flyers/echo.ts); Strength
 * is how much they move (0 = the still echo).
 */
const ECHO_MOTION_NOTE: Record<string, string> = {
  silhouette_trail: "the trail stretches and shimmers",
  rgb_echo: "the colour copies spread and gather",
  outline_echo: "outlines keep rippling outward",
  mirror_echo: "the mirrored copies sway in and out",
  zoom_echo: "copies keep growing out of the subject and fading",
  orbit_echo: "the copies circle the subject",
  slice_echo: "the strips slide in and out",
  long_exposure: "the streak stretches and settles"
};
const echoControl = (k: EchoKey, def: number | string | boolean): Control => {
  const c = ECHO_CONTROLS[k];
  return { key: k, label: c.label, kind: c.kind === "color" ? "color" : c.kind === "bool" ? "toggle" : "range", def, min: c.min, max: c.max, step: c.step, unit: c.unit, hint: c.hint };
};
export const ECHO_MOTION: Preset[] = ECHO_PRESETS.map((e) => {
  const d = resolveEcho({ preset: e.id });
  return {
    id: `echo.${e.id.replace(/_/g, "-")}`,
    name: e.name,
    category: "echo" as const,
    description: `${e.blurb}; ${ECHO_MOTION_NOTE[e.id]}. Strength is how much it moves`,
    loop: "periodic" as const,
    params: ["strength", "cycles", "phase"] as ParamKey[],
    defaults: { strength: 0.6, cycles: 1, phase: 0, easing: "linear" as const, seed: 7 },
    needs: e.needsCutout ? ("cutout" as const) : undefined,
    controls: e.controls.map((k) => echoControl(k, d[k])),
    fits: isPicture,
    apply: (s: MotionState, c: EvalCtx) => {
      s.echo = { preset: e.id, params: c.opts, seed: c.item.seed ?? 7, u: c.u, amount: c.amount };
    }
  };
});
MOTION_PRESETS.push(...ECHO_MOTION);

/** Reference IDs from the design library that are the same effect as one built under another name. */
export const PRESET_ALIASES: Record<string, string> = {
  "text.glitch": "fx.digital-slice",
  "photos.grain": "fx.grain",
  "overlays.vhs": "fx.vhs",
  "photos.echo": "echo.silhouette-trail"
};

export const PRESET_BY_ID = new Map<string, Preset>([...MOTION_PRESETS.map((p) => [p.id, p] as [string, Preset]), ...Object.entries(PRESET_ALIASES).map(([a, id]) => [a, MOTION_PRESETS.find((p) => p.id === id)!] as [string, Preset])]);

/** This effect's settings: saved values, else (for settings added later) the legacy value, else the default. */
export function optsFor(p: Preset, item: MotionItem): EffectOpts {
  const out: EffectOpts = {};
  for (const k of p.controls ?? []) {
    const v = item.opts?.[k.key];
    out[k.key] = v !== undefined && typeof v === typeof k.def ? v : (k.legacy ?? k.def);
  }
  return out;
}

/** In the design spec, not built yet (never shown as working). */
export const PLANNED: { id: string; name: string; why: string }[] = [
  { id: "text.outline", name: "Outline Trace", why: "needs vector letter outlines (a wipe fallback comes first)" },
  { id: "photos.parallax", name: "Parallax Sway", why: "needs a subject cutout (alpha mask) for the person" },
  { id: "photos.rim", name: "Rim Light Sweep", why: "needs a subject cutout (alpha mask)" },
  { id: "photos.grade", name: "Color Grade Breathe", why: "needs the photo effects to blend per frame" },
  { id: "photos.flash", name: "Soft Flash", why: "needs an exposure pass that keeps the photo treatment" },
  { id: "photos.focus", name: "Focus Settle", why: "needs a per-frame blur pass that keeps the photo treatment" },
  { id: "backgrounds.gradient", name: "Gradient Drift", why: "needs gradient fills on backgrounds" },
  { id: "backgrounds.texture", name: "Paper Texture Drift", why: "needs a tileable paper texture asset" },
  { id: "backgrounds.bokeh", name: "Bokeh Float", why: "next increment (soft blurred particles)" },
  { id: "backgrounds.haze", name: "Ambient Haze", why: "needs a tileable haze texture" },
  { id: "backgrounds.duotone", name: "Duotone Shift", why: "needs a per-frame color pass" },
  { id: "backgrounds.orbit", name: "Ambient Light Orbit", why: "next increment" },
  { id: "overlays.smoke", name: "Smoke Drift", why: "needs loop-ready transparent smoke footage or a noise renderer" },
  { id: "overlays.scratch", name: "Film Scratches", why: "next increment" },
  { id: "overlays.paper", name: "Paper Flicker", why: "needs a paper texture asset" },
  { id: "overlays.scribble", name: "Scribble Draw", why: "needs vector paths or a masked wipe" },
  { id: "overlays.confetti", name: "Confetti Drift", why: "next increment" }
];

/** Roles whose details stay readable while the lock is on. */
export const PROTECTED_ROLES: Role[] = ["venue", "date", "time", "address"];

export function isProtected(n: FlyerNode, role: Role) {
  if (PROTECTED_ROLES.includes(role)) return true;
  // Linked venue / date / time / address text, whatever its role says.
  const src = n.kind === "text" ? (n.source ?? n.text) : "";
  return /\{\{\s*(venue\.(name|street|cityLine)|venue_name|venue_address|event\.(date|startTime|endTime|timeRange|dayNumber|monthShort|weekday|weekdayShort|year)|event_date|start_time|end_time)/.test(src);
}

export const roleOf = (n: FlyerNode, override?: Role): Role => override ?? n.role;

/** Is this preset offered for the layer? (true, or why not) */
export function presetFits(p: Preset, n: FlyerNode, role: Role, lock: boolean): true | string {
  const f = p.fits(n, role);
  if (f !== true) return f;
  if (lock && p.hidesContent && isProtected(n, role)) return "Keeps event details readable: turn off the lock to let this layer disappear.";
  if (lock && p.distorts && isProtected(n, role)) return "Keeps event details readable: turn off the lock to glitch this layer.";
  return true;
}

/** Every second picture (double exposure) this animation uses, so an export can load them first. */
export function imagesUsed(layers: Record<string, { stack: MotionItem[] }>) {
  const out = new Set<string>();
  for (const l of Object.values(layers))
    for (const it of l.stack) {
      const p = PRESET_BY_ID.get(it.preset);
      for (const c of p?.controls ?? []) if (c.kind === "image") out.add(String(it.opts?.[c.key] ?? c.def));
    }
  return [...out];
}
