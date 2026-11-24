import type { FlyerNode, Role } from "../types";
import type { Direction, Easing, GlitchParams, MotionItem, MotionState, OverlayBlend } from "./types";
import { burstAt } from "./raster";

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

export type Category = "text" | "photos" | "backgrounds" | "overlays" | "fx";
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
    apply: (s, c) => {
      const g = glitchOf(c);
      const b = burstAt(c.loopU, c.item.seed ?? 48, g.bursts, g.burstLen / c.duration);
      if (!b) return;
      const env = Math.sin(Math.PI * b.local);
      // The pattern holds for 2 frames at a time (digital, not jelly).
      const steps = Math.max(2, Math.round((g.burstLen * c.fps) / 2));
      const step = Math.min(steps - 1, Math.floor(b.local * steps));
      const R = rng((c.item.seed ?? 48) * 31 + b.k * 1013 + step * 7919);
      const shift = g.maxShift * c.amount * env;
      const cuts = Array.from({ length: Math.max(1, g.slices - 1) }, () => R()).sort((x, y) => x - y);
      const edges = [0, ...cuts, 1];
      const bands: { y0: number; y1: number; dx: number }[] = [];
      for (let i = 0; i < edges.length - 1; i++) if (R() < 0.45) bands.push({ y0: edges[i], y1: edges[i + 1], dx: (R() * 2 - 1) * shift });
      s.raster.push({ kind: "slices", bands });
      const sep = g.rgb * 0.5 * c.amount * env;
      if (sep >= 0.5) s.raster.push({ kind: "rgb", rdx: sep, rdy: 0, bdx: -sep, bdy: 0 });
      if (g.noise > 0) s.raster.push({ kind: "noise", amount: g.noise * 0.35 * env, seed: b.k * 97 + step, mono: false });
      // Brief, bounded nudge of the whole layer.
      s.dx += (R() - 0.5) * shift * 0.12;
    }
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
      const b = burstAt(c.loopU, c.item.seed ?? 21, g.bursts, g.burstLen / c.duration);
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
    description: "A steady tape look (scanlines, colour bleed, a rolling tracking line, soft noise) with occasional tracking tears",
    loop: "seeded-periodic",
    params: ["strength", "seed", "glitch"],
    defaults: { strength: 0.5, cycles: 1, phase: 0, easing: "linear", seed: 7, glitch: { bursts: 2, burstLen: 0.5, slices: 3, maxShift: 50, rgb: 4, noise: 0.2 } },
    fits: anyLayer,
    distorts: true,
    apply: (s, c) => {
      const g = glitchOf(c);
      const a = c.amount;
      // Always on, and periodic over the loop: whole numbers of scanline scrolls and tracking rolls.
      s.raster.push({ kind: "rgb", rdx: 1 + g.rgb * 0.5 * a, rdy: 0, bdx: -(0.6 + g.rgb * 0.3 * a), bdy: 0 });
      const band = c.loopU * 2 - Math.floor(c.loopU * 2);
      s.raster.push({ kind: "rowwave", y0: band - 0.05, y1: band + 0.05, amp: 4 + 10 * a, freq: 1, phase: 0 });
      // Head-switching wobble along the bottom edge.
      s.raster.push({ kind: "slices", bands: [{ y0: 0.965, y1: 1, dx: (3 + 6 * a) * Math.sin(TAU * 15 * c.loopU) }] });
      const b = burstAt(c.loopU, c.item.seed ?? 7, g.bursts, g.burstLen / c.duration);
      if (b) {
        const env = Math.sin(Math.PI * b.local);
        const R = rng((c.item.seed ?? 7) * 13 + b.k * 211);
        const y = 0.15 + R() * 0.6;
        s.raster.push({ kind: "rowwave", y0: y, y1: y + 0.12 + 0.05 * g.slices / 10, amp: g.maxShift * a * env, freq: 1.5, phase: b.local * 0.5 });
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
  }
];

export const PRESET_BY_ID = new Map(MOTION_PRESETS.map((p) => [p.id, p]));

/** In the design spec, not built yet (never shown as working). */
export const PLANNED: { id: string; name: string; why: string }[] = [
  { id: "text.outline", name: "Outline Trace", why: "needs vector letter outlines (a wipe fallback comes first)" },
  { id: "photos.parallax", name: "Parallax Sway", why: "needs a subject cutout (alpha mask) for the person" },
  { id: "photos.rim", name: "Rim Light Sweep", why: "needs a subject cutout (alpha mask)" },
  { id: "photos.grade", name: "Color Grade Breathe", why: "needs the photo effects to blend per frame" },
  { id: "photos.flash", name: "Soft Flash", why: "needs an exposure pass that keeps the photo treatment" },
  { id: "photos.echo", name: "Silhouette Echo", why: "needs a subject cutout (alpha mask)" },
  { id: "photos.focus", name: "Focus Settle", why: "needs a per-frame blur pass that keeps the photo treatment" },
  { id: "backgrounds.gradient", name: "Gradient Drift", why: "needs gradient fills on backgrounds" },
  { id: "backgrounds.texture", name: "Paper Texture Drift", why: "needs a tileable paper texture asset" },
  { id: "backgrounds.bokeh", name: "Bokeh Float", why: "next increment (soft blurred particles)" },
  { id: "backgrounds.haze", name: "Ambient Haze", why: "needs a tileable haze texture" },
  { id: "backgrounds.duotone", name: "Duotone Shift", why: "needs a per-frame color pass" },
  { id: "backgrounds.orbit", name: "Ambient Light Orbit", why: "next increment" },
  { id: "overlays.smoke", name: "Smoke Drift", why: "needs loop-ready transparent smoke footage or a noise renderer" },
  { id: "overlays.scratch", name: "Film Scratches", why: "next increment" },
  { id: "overlays.prism", name: "Prism Sweep", why: "next increment" },
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
