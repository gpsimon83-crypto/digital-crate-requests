/**
 * Echo effects for picture layers: copies of the layer drawn behind it
 * (silhouettes, tinted copies, outlines, mirrored, zoomed, orbiting,
 * sliced or smeared), with the sharp original on top by default.
 *
 * This file is the shared model: the settings, the eight presets, and
 * `echoCopies`, which turns settings (plus a moment in an animation) into
 * a list of copies to draw. The same list drives the still flyer, the
 * picker thumbnails, Animate's preview and the exported video
 * (see components/flyers/echo-paint.ts for the drawing).
 *
 * Silhouette Trail is the existing Silhouette Echo (the alpha-filled copies
 * Red Strobe draws inside its frame) grown into a full effect: the same
 * idea, but free to reach past the frame, with direction, spacing and
 * fall-off. Red Strobe's in-frame echo uses `silhouetteOffsets` from here.
 *
 * Animation: `u` is the position in the effect's cycle (0..1) and `amount`
 * how much it moves. Every moving part is periodic in `u` (or flows by
 * exactly one copy per cycle), so u = 0 and u = 1 draw the same frame and
 * loops close. A still flyer is u = 0, amount = 0.
 */

export const ECHO_VERSION = 1;

export type EchoPresetId = "silhouette_trail" | "rgb_echo" | "outline_echo" | "mirror_echo" | "zoom_echo" | "orbit_echo" | "slice_echo" | "long_exposure";

export type EchoParams = {
  count: number;
  /** Distance between copies, % of the layer's width. */
  spacing: number;
  /** Direction the echoes go, degrees (0 = right, 90 = down, 180 = left, -90 = up). */
  angle: number;
  /** Nearest copy's opacity, %. */
  opacity: number;
  /** How quickly further copies fade, %. */
  falloff: number;
  color: string;
  color2: string;
  color3: string;
  /** How strongly copies take the colour, %. */
  tint: number;
  /** Darkens the copies, %. */
  dim: number;
  /** Size change per copy, % (zoom) / copy size % (orbit). */
  scaleStep: number;
  /** Outline thickness, px. */
  width: number;
  /** Soft glow around the copies, %. */
  glow: number;
  /** Orbit radius, % of the layer's longer side. */
  radius: number;
  /** Orbit arc, degrees. */
  spread: number;
  slices: number;
  /** Uneven slice offsets, %. */
  jitter: number;
  /** Motion smear, %. */
  smear: number;
  mono: boolean;
  flip: boolean;
  ring: boolean;
  /** What the copies are made of: the photo, the photo in a colour, or a solid colour shape. */
  fill: EchoFill;
  /** Copies blend from Colour (nearest) to Second colour (furthest). */
  gradient: boolean;
  /** How the echoes mix with what's behind them ("screen"/"add" light them up on dark flyers). */
  blend: EchoBlend;
  /** Draw the sharp original on top. */
  original: boolean;
};

export type EchoFill = "photo" | "tint" | "solid";
export type EchoBlend = "normal" | "screen" | "add";

export type EchoSettings = { v: typeof ECHO_VERSION; preset: EchoPresetId; params: Partial<EchoParams>; seed: number };

export type EchoKey = keyof EchoParams;

/** What a copy is drawn from. */
export type CopyMode = "image" | "silhouette" | "outline";

export type EchoCopy = {
  mode: CopyMode;
  /** Centre offset from the layer's centre, flyer px. */
  dx: number;
  dy: number;
  scale: number;
  /** Degrees, about the copy's centre. */
  rotate: number;
  flipX: boolean;
  opacity: number;
  /** Silhouette / outline colour, or the tint for image copies. */
  color: string | null;
  tint: number;
  dim: number;
  mono: boolean;
  /** Outline thickness (flyer px). */
  width: number;
  /** Glow radius (flyer px). */
  glow: number;
  /** Soft smear (flyer px of blur). */
  blur: number;
  /** Only this horizontal band of the layer (0..1 of its height). */
  band: { y0: number; y1: number } | null;
};

export type EchoExtra = { ring: { cx: number; cy: number; r: number; color: string; glow: number; opacity: number } | null; blend: EchoBlend };

const BASE: EchoParams = {
  count: 3,
  spacing: 12,
  angle: 180,
  opacity: 70,
  falloff: 40,
  color: "#19c2a8",
  color2: "#1fd655",
  color3: "#ff2d3d",
  tint: 0,
  dim: 0,
  scaleStep: 0,
  width: 3,
  glow: 0,
  radius: 42,
  spread: 200,
  slices: 8,
  jitter: 50,
  smear: 0,
  mono: false,
  flip: false,
  ring: false,
  fill: "photo",
  gradient: false,
  blend: "normal",
  original: true
};

export const ECHO_CONTROLS: Record<EchoKey, { label: string; kind?: "color" | "bool" | "select"; options?: { value: string; label: string }[]; min?: number; max?: number; step?: number; unit?: string; hint?: string }> = {
  count: { label: "Copies", min: 1, max: 16, step: 1 },
  spacing: { label: "Spacing", min: 0, max: 60, step: 0.5, unit: "%" },
  angle: { label: "Direction", min: -180, max: 180, step: 1, unit: "°", hint: "0° = right, 180° = left, −90° = up." },
  opacity: { label: "Opacity", min: 0, max: 100, step: 1, unit: "%" },
  falloff: { label: "Fade-off", min: 0, max: 100, step: 1, unit: "%", hint: "How much fainter each further copy is." },
  color: { label: "Colour", kind: "color" },
  color2: { label: "Second colour", kind: "color" },
  color3: { label: "Third colour", kind: "color" },
  tint: { label: "Colour strength", min: 0, max: 100, step: 1, unit: "%" },
  dim: { label: "Darken copies", min: 0, max: 100, step: 1, unit: "%" },
  scaleStep: { label: "Size change", min: -60, max: 80, step: 1, unit: "%" },
  width: { label: "Line width", min: 1, max: 20, step: 0.5, unit: "px" },
  glow: { label: "Glow", min: 0, max: 100, step: 1, unit: "%" },
  radius: { label: "Orbit radius", min: 10, max: 90, step: 1, unit: "%" },
  spread: { label: "Arc", min: 40, max: 360, step: 5, unit: "°" },
  slices: { label: "Slices", min: 2, max: 24, step: 1 },
  jitter: { label: "Unevenness", min: 0, max: 100, step: 1, unit: "%" },
  smear: { label: "Smear", min: 0, max: 100, step: 1, unit: "%" },
  mono: { label: "Black and white copies", kind: "bool" },
  flip: { label: "Mirror the copies", kind: "bool" },
  ring: { label: "Glow ring", kind: "bool" },
  fill: {
    label: "Copies are",
    kind: "select",
    options: [
      { value: "photo", label: "The photo" },
      { value: "tint", label: "The photo, coloured" },
      { value: "solid", label: "Solid colour" }
    ],
    hint: "Solid colour fills each copy's shape with Colour (or the gradient)."
  },
  gradient: { label: "Colour gradient across copies", kind: "bool", hint: "Nearest copy in Colour, furthest in Second colour." },
  blend: {
    label: "Blend",
    kind: "select",
    options: [
      { value: "normal", label: "Normal" },
      { value: "screen", label: "Screen (lighten)" },
      { value: "add", label: "Add (neon glow)" }
    ],
    hint: "Screen and Add make the echoes glow on dark backgrounds."
  },
  original: { label: "Sharp original on top", kind: "bool", hint: "Off: only the echoes show." }
};

/** The colour settings every preset offers (after its own). */
const COLOR_KEYS: EchoKey[] = ["fill", "color", "gradient", "color2", "tint", "glow", "blend"];
const withColor = (own: EchoKey[], skip: EchoKey[] = []) => {
  const keys: EchoKey[] = own.filter((k) => k !== "original");
  for (const k of COLOR_KEYS) if (!keys.includes(k) && !skip.includes(k)) keys.push(k);
  return [...keys, "original" as EchoKey];
};

export type EchoPreset = {
  id: EchoPresetId;
  name: string;
  blurb: string;
  /** Uses the subject's outline (transparent background or a layer mask). */
  needsCutout: boolean;
  defaults: Partial<EchoParams>;
  controls: EchoKey[];
};

export const ECHO_PRESETS: EchoPreset[] = [
  {
    id: "silhouette_trail",
    name: "Silhouette Trail",
    blurb: "Solid-colour silhouettes trailing behind the subject",
    needsCutout: true,
    defaults: { count: 4, spacing: 13, angle: 185, opacity: 85, falloff: 60, color: "#19c2a8", color2: "#7b3cff", glow: 20, fill: "solid", tint: 80 },
    controls: withColor(["count", "spacing", "angle", "opacity", "falloff", "fill", "color", "glow", "original"])
  },
  {
    id: "rgb_echo",
    name: "RGB Echo",
    blurb: "Blue, green and red copies stepping away from the subject",
    needsCutout: false,
    defaults: { count: 3, spacing: 14, angle: 180, opacity: 92, falloff: 12, color: "#2f5bff", color2: "#1fd655", color3: "#ff2d3d", tint: 72, fill: "tint" },
    controls: withColor(["count", "spacing", "angle", "opacity", "falloff", "fill", "tint", "color", "color2", "color3", "original"], ["gradient"])
  },
  {
    id: "outline_echo",
    name: "Outline Echo",
    blurb: "Glowing outlines of the subject stepping out to one side",
    needsCutout: true,
    defaults: { count: 3, spacing: 7, angle: 0, opacity: 95, falloff: 35, color: "#ffc94a", color2: "#ff5a36", width: 3, glow: 60 },
    controls: withColor(["count", "spacing", "angle", "width", "glow", "color", "gradient", "color2", "opacity", "falloff", "original"], ["fill", "tint"])
  },
  {
    id: "mirror_echo",
    name: "Mirror Echo",
    blurb: "Mirrored, darker copies on either side",
    needsCutout: false,
    defaults: { count: 2, spacing: 30, opacity: 75, falloff: 25, dim: 45, scaleStep: -8, flip: true, color: "#ff3d8b", color2: "#3d7bff", tint: 70 },
    controls: withColor(["count", "spacing", "scaleStep", "opacity", "dim", "falloff", "flip", "original"])
  },
  {
    id: "zoom_echo",
    name: "Zoom Echo",
    blurb: "Bigger, fainter black-and-white copies rising behind",
    needsCutout: false,
    defaults: { count: 2, spacing: 12, angle: -90, opacity: 55, falloff: 40, scaleStep: 34, mono: true, dim: 20, color: "#c6f432", color2: "#19c2a8", tint: 70 },
    controls: withColor(["count", "scaleStep", "spacing", "angle", "opacity", "falloff", "dim", "mono", "original"])
  },
  {
    id: "orbit_echo",
    name: "Orbit Echo",
    blurb: "Small copies circling the subject, with a glow ring",
    needsCutout: false,
    defaults: { count: 5, radius: 44, scaleStep: 36, spread: 220, angle: -90, opacity: 90, falloff: 0, ring: true, color: "#b06cff", color2: "#3dd9ff", glow: 55, tint: 70 },
    controls: withColor(["count", "radius", "scaleStep", "spread", "angle", "opacity", "ring", "color", "glow", "original"])
  },
  {
    id: "slice_echo",
    name: "Slice Echo",
    blurb: "Strips of the portrait pulled out to both sides",
    needsCutout: false,
    defaults: { slices: 8, spacing: 42, jitter: 40, opacity: 95, dim: 8, color: "#ffc94a", color2: "#ff3d8b", tint: 70 },
    controls: withColor(["slices", "spacing", "jitter", "opacity", "dim", "original"])
  },
  {
    id: "long_exposure",
    name: "Long Exposure",
    blurb: "A warm motion streak, like a slow shutter",
    needsCutout: false,
    defaults: { count: 8, spacing: 5, angle: 0, opacity: 72, falloff: 55, color: "#ffb347", color2: "#ff3d8b", tint: 45, smear: 30, fill: "tint" },
    controls: withColor(["count", "spacing", "angle", "opacity", "falloff", "smear", "fill", "tint", "color", "original"])
  }
];

export const echoPresetById = (id: string | null | undefined) => ECHO_PRESETS.find((p) => p.id === id) ?? null;

export function newEcho(preset: EchoPresetId, seed = 7): EchoSettings {
  return { v: ECHO_VERSION, preset, params: {}, seed };
}

/** The preset's defaults with the layer's changes on top. */
export function resolveEcho(e: { preset: string; params?: Partial<EchoParams> | Record<string, unknown> }): EchoParams {
  const p = echoPresetById(e.preset);
  return { ...BASE, ...(p?.defaults ?? {}), ...((e.params ?? {}) as Partial<EchoParams>) };
}

export const echoOn = (e: EchoSettings | null | undefined): e is EchoSettings => !!e && !!echoPresetById(e.preset);

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Cleans saved settings (unknown keys dropped, numbers kept in range). */
export function sanitizeEchoParams(raw: unknown): Partial<EchoParams> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!(k in BASE)) continue;
    const def = BASE[k as EchoKey];
    const info = ECHO_CONTROLS[k as EchoKey];
    if (typeof def === "boolean" && typeof v === "boolean") out[k] = v;
    else if (typeof def === "string" && typeof v === "string" && info.kind === "select") {
      if (info.options!.some((o) => o.value === v)) out[k] = v;
    } else if (typeof def === "string" && typeof v === "string" && HEX.test(v)) out[k] = v.toLowerCase();
    else if (typeof def === "number" && typeof v === "number" && Number.isFinite(v)) out[k] = clamp(v, info.min ?? -1000, info.max ?? 1000);
  }
  return out as Partial<EchoParams>;
}

export function sanitizeEcho(raw: unknown): EchoSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const p = echoPresetById(typeof r.preset === "string" ? r.preset : null);
  if (!p) return null;
  const seed = typeof r.seed === "number" && Number.isFinite(r.seed) ? Math.round(clamp(r.seed, 0, 2 ** 31 - 1)) : 7;
  return { v: ECHO_VERSION, preset: p.id, params: sanitizeEchoParams(r.params), seed };
}

/** Red Strobe's in-frame silhouette echo: copies alternating right / left. */
export function silhouetteOffsets(count: number, offset: number) {
  const out: { dx: number; fade: number }[] = [];
  for (let e = 1; e <= Math.round(count); e++) out.push({ dx: Math.ceil(e / 2) * offset * (e % 2 ? 1 : -1), fade: 1 - (e - 1) / (count + 1) });
  return out;
}

/** Blends two #rrggbb colours (t = 0 → a, 1 → b). */
export function mixHex(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
  const A = p(a),
    B = p(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, "0")).join("");
}

/** Deterministic random numbers from a seed (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const rad = (d: number) => (d * Math.PI) / 180;
/** Opacity of copy `j` (1 = nearest), fading by `falloff`; past the last copy it fades out to 0 (for flowing loops). */
function fade(j: number, count: number, opacity: number, falloff: number) {
  const base = (opacity / 100) * clamp(1 - (falloff / 100) * ((j - 1) / Math.max(1, count)), 0, 1);
  if (j < 1) return base * clamp(j, 0, 1);
  if (j > count) return base * clamp(count + 1 - j, 0, 1);
  return base;
}

export type EchoInput = { preset: EchoPresetId | string; params?: Partial<EchoParams> | Record<string, unknown>; seed?: number };

/**
 * The copies to draw behind the layer, furthest first. `w`/`h`: the layer's
 * size in flyer px. `u`: cycle position, `amount`: how much it moves (0 = still).
 */
export function echoCopies(e: EchoInput, w: number, h: number, u = 0, amount = 0): { copies: EchoCopy[]; extra: EchoExtra; original: boolean } {
  const preset = echoPresetById(e.preset);
  const P = resolveEcho({ preset: String(e.preset), params: e.params });
  const a = clamp(amount, 0, 1);
  const moving = a > 0.001;
  const flow = moving ? ((u % 1) + 1) % 1 : 0;
  const count = Math.round(clamp(P.count, 1, 16));
  const step = (P.spacing / 100) * w;
  const ux = Math.cos(rad(P.angle)),
    uy = Math.sin(rad(P.angle));
  const copies: EchoCopy[] = [];
  const extra: EchoExtra = { ring: null, blend: P.blend };
  const base = (o: Partial<EchoCopy>): EchoCopy => ({ mode: "image", dx: 0, dy: 0, scale: 1, rotate: 0, flipX: false, opacity: 1, color: null, tint: 0, dim: 0, mono: false, width: 0, glow: 0, blur: 0, band: null, ...o });
  // Periodic in u and 0 at u = 0 (so frame 0 is the still echo).
  const wave = (ph: number) => (moving ? (Math.sin(TAU * (u + ph)) - Math.sin(TAU * ph)) * a : 0);
  switch (preset?.id) {
    case "silhouette_trail": {
      const k = 1 + 0.3 * wave(0);
      for (let j = 1; j <= count; j++) {
        const shimmer = moving ? 1 + 0.25 * a * (Math.sin(TAU * (u - j / count)) - Math.sin(-TAU * (j / count))) : 1;
        copies.push(base({ mode: "silhouette", dx: ux * step * j * k, dy: uy * step * j * k, opacity: clamp(fade(j, count, P.opacity, P.falloff) * shimmer, 0, 1), color: P.color, glow: (P.glow / 100) * 0.06 * w }));
      }
      break;
    }
    case "rgb_echo": {
      const cols = [P.color, P.color2, P.color3];
      for (let j = 1; j <= count; j++) {
        const k = 1 + 0.45 * wave(j * 0.12);
        copies.push(base({ dx: ux * step * j * k, dy: uy * step * j * k, opacity: fade(j, count, P.opacity, P.falloff), color: cols[(j - 1) % 3], tint: P.tint / 100 }));
      }
      break;
    }
    case "outline_echo": {
      // Flows outward by one copy per cycle while animating (a new outline appears at the subject as the last fades).
      for (let i = moving ? 0 : 1; i <= count; i++) {
        const j = i + flow;
        copies.push(base({ mode: "outline", dx: ux * step * j, dy: uy * step * j, opacity: fade(j, count, P.opacity, P.falloff), color: P.color, width: P.width, glow: (P.glow / 100) * 0.05 * w }));
      }
      break;
    }
    case "mirror_echo": {
      for (let j = 1; j <= count; j++) {
        const side = j % 2 ? -1 : 1;
        const ring = Math.ceil(j / 2);
        const k = 1 + 0.25 * wave(side > 0 ? 0.5 : 0);
        copies.push(base({ dx: side * step * ring * k, scale: Math.max(0.1, 1 + (P.scaleStep / 100) * ring), flipX: P.flip, opacity: fade(ring, Math.ceil(count / 2), P.opacity, P.falloff), dim: P.dim / 100 }));
      }
      break;
    }
    case "zoom_echo": {
      // Copies grow from the subject's base; while animating they keep growing and fade, one copy per cycle.
      for (let i = moving ? 0 : 1; i <= count; i++) {
        const j = i + flow;
        const s = Math.max(0.1, 1 + (P.scaleStep / 100) * j);
        copies.push(base({ dx: ux * step * j, dy: uy * step * j, scale: s, opacity: fade(j, count, P.opacity, P.falloff), mono: P.mono, dim: P.dim / 100 }));
      }
      // Anchored at the bottom centre: shift each copy up by half its extra height.
      for (const c of copies) c.dy -= ((c.scale - 1) * h) / 2;
      break;
    }
    case "orbit_echo": {
      const R = (P.radius / 100) * Math.max(w, h);
      const size = clamp(P.scaleStep, 10, 80) / 100;
      // Centred on the head (upper part of a portrait).
      const cx = 0,
        cy = -h * 0.12;
      const spin = moving ? 360 * flow : 0;
      const arc = clamp(P.spread, 40, 360);
      for (let j = 0; j < count; j++) {
        const t = count === 1 ? 0.5 : arc >= 359 ? j / count : j / (count - 1);
        const ang = P.angle - arc / 2 + arc * t + spin;
        const x = cx + Math.cos(rad(ang)) * R,
          y = cy + Math.sin(rad(ang)) * R;
        copies.push(base({ dx: x, dy: y, scale: size, rotate: Math.sin(rad(ang - P.angle)) * 35, opacity: (P.opacity / 100) * (1 - (P.falloff / 100) * (j / Math.max(1, count))), dim: 0.1 }));
      }
      if (P.ring) extra.ring = { cx, cy, r: R, color: P.color, glow: (P.glow / 100) * 0.05 * w, opacity: Math.min(1, P.opacity / 100) };
      break;
    }
    case "slice_echo": {
      const n = Math.round(clamp(P.slices, 2, 24));
      const rnd = rng(e.seed ?? 7);
      // The face and shoulders band of a portrait.
      const top = 0.1,
        bottom = 0.66;
      const bh = (bottom - top) / n;
      for (let i = 0; i < n; i++) {
        const r1 = rnd(),
          r2 = rnd(),
          r3 = rnd();
        const side = r1 < 0.5 ? -1 : 1;
        const dist = step * (0.55 + (P.jitter / 100) * 0.9 * r2) * (1 + 0.6 * wave(r3));
        const y0 = top + i * bh,
          y1 = y0 + bh * 0.82;
        copies.push(base({ dx: side * dist, opacity: (P.opacity / 100) * (0.75 + 0.25 * r3), dim: P.dim / 100, band: { y0, y1 } }));
        // A second, further strip on the other side for some slices.
        if (r3 > 0.45) copies.push(base({ dx: -side * dist * (0.7 + 0.5 * r2), opacity: (P.opacity / 100) * 0.7, dim: Math.min(1, P.dim / 100 + 0.15), band: { y0, y1 } }));
      }
      break;
    }
    case "long_exposure": {
      const k = 1 + 0.5 * wave(0);
      const blur = (P.smear / 100) * 0.03 * w;
      for (let j = 1; j <= count; j++) copies.push(base({ dx: ux * step * j * k, dy: uy * step * j * k, opacity: fade(j, count, P.opacity, P.falloff), color: P.color, tint: P.tint / 100, blur: blur * (0.5 + j / count) }));
      break;
    }
  }
  // Colour, the same for every preset: what the copies are made of, a gradient from nearest to
  // furthest, and a glow. (RGB Echo keeps its three colours unless the gradient is on.)
  const n = copies.length;
  copies.forEach((c, i) => {
    const t = n > 1 ? i / (n - 1) : 0;
    const col = P.gradient ? mixHex(P.color, P.color2, t) : preset?.id === "rgb_echo" && c.color ? c.color : P.color;
    c.glow = (P.glow / 100) * (c.mode === "outline" ? 0.05 : 0.06) * w;
    if (c.mode === "outline") {
      c.color = col;
      return;
    }
    if (P.fill === "solid") {
      c.mode = "silhouette";
      c.color = col;
      c.tint = 0;
    } else if (P.fill === "tint") {
      c.mode = "image";
      c.color = col;
      c.tint = P.tint / 100;
    } else {
      c.mode = "image";
      // A plain photo copy; its glow still takes the colour.
      c.color = P.glow > 0 ? col : null;
      c.tint = 0;
    }
  });
  // (While flowing, copy 0 is at the subject with opacity 0, so the frame at u = 1 has the same copies as u = 0.)
  // Furthest first (drawn first, so nearer copies sit over them).
  copies.reverse();
  return { copies, extra, original: P.original };
}

/** How far past the layer's box the echoes reach (flyer px), to size the drawing. */
export function echoBounds(copies: EchoCopy[], extra: EchoExtra, w: number, h: number) {
  let x0 = 0,
    y0 = 0,
    x1 = w,
    y1 = h;
  for (const c of copies) {
    const s = c.scale;
    const r = rad(c.rotate);
    const hw = (w * s) / 2,
      hh = (h * s) / 2;
    const ex = Math.abs(Math.cos(r)) * hw + Math.abs(Math.sin(r)) * hh;
    const ey = Math.abs(Math.sin(r)) * hw + Math.abs(Math.cos(r)) * hh;
    const cx = w / 2 + c.dx,
      cy = h / 2 + c.dy;
    const m = c.glow * 2 + c.width + c.blur * 2;
    x0 = Math.min(x0, cx - ex - m);
    x1 = Math.max(x1, cx + ex + m);
    y0 = Math.min(y0, cy - ey - m);
    y1 = Math.max(y1, cy + ey + m);
  }
  if (extra.ring) {
    const { cx, cy, r, glow } = extra.ring;
    x0 = Math.min(x0, w / 2 + cx - r - glow * 2 - 4);
    x1 = Math.max(x1, w / 2 + cx + r + glow * 2 + 4);
    y0 = Math.min(y0, h / 2 + cy - r - glow * 2 - 4);
    y1 = Math.max(y1, h / 2 + cy + r + glow * 2 + 4);
  }
  return { x: Math.floor(x0), y: Math.floor(y0), w: Math.ceil(x1 - Math.floor(x0)), h: Math.ceil(y1 - Math.floor(y0)) };
}
