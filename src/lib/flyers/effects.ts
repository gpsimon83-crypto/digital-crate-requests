/**
 * Photo Effects for flyer photo layers. Deterministic pixel processing (no
 * AI, no network): color grading, duotone, threshold, halftone, grain,
 * scanlines, RGB separation, bloom, sharpening, and subject-mask effects
 * (edge light, drop shadow, silhouette echoes, bottom fade).
 *
 * Runs on plain RGBA pixel buffers so it works the same in a Web Worker,
 * on the main thread and in tests. The original image is never changed:
 * the layer keeps its source, and these settings are stored beside it.
 *
 * Every size (dot size, edge width, offsets, scanline spacing, grain cell)
 * is in flyer pixels and multiplied by `scale`, so a preview at half size
 * and an export at 2× look the same. Textures come from a seeded hash, so
 * grain and scratches don't change between preview, save and export.
 */

export const EFFECTS_VERSION = 1;

export type PresetId =
  | "emerald"
  | "neon_duotone"
  | "silver_noir"
  | "golden_hour"
  | "xerox"
  | "halftone"
  | "vhs"
  | "direct_flash"
  | "midnight_blue"
  | "vintage_print"
  | "red_strobe";

export type Mode = "grade" | "mono" | "duotone" | "threshold" | "halftone";

export type Params = {
  exposure: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  warmth: number; // -100..100
  lift: number; // 0..100 faded blacks
  toneMix: number; // 0..100 how strongly shadow/highlight colors are applied
  shadowColor: string;
  highlightColor: string;
  inkColor: string;
  paperColor: string;
  threshold: number; // 0..100
  dotSize: number; // px
  sharpen: number; // 0..100
  bloom: number; // 0..100
  grain: number; // 0..100
  texture: number; // 0..100 (scratches, worn ink, distress)
  rgbShift: number; // px
  scanlines: number; // 0..100
  distortion: number; // 0..100
  edgeOn: boolean;
  edgeColor: string;
  edgeWidth: number; // px
  edgeOpacity: number; // 0..100
  shadowOn: boolean; // subject drop shadow
  shadowOffset: number; // px
  shadowOpacity: number; // 0..100
  echoCount: number; // 0..4
  echoOffset: number; // px
  echoOpacity: number; // 0..100
  echoColor: string;
};

export type Mask = { fade: number; fadeAt: number }; // bottom fade: amount 0..100, starts at 0..100 % of the height

export type PhotoEffects = {
  v: typeof EFFECTS_VERSION;
  preset: PresetId;
  strength: number; // 0..1
  /** Only the values changed from the preset's defaults. */
  params: Partial<Params>;
  seed: number;
  mask: Mask;
  /** Name of the saved custom preset this came from, if any (display only). */
  custom?: string | null;
};

export type ControlKey = keyof Params | "fade";
type Preset = { id: PresetId; name: string; blurb: string; mode: Mode; defaults: Partial<Params>; controls: ControlKey[]; mask?: Partial<Mask> };

const BASE: Params = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  lift: 0,
  toneMix: 0,
  shadowColor: "#000000",
  highlightColor: "#ffffff",
  inkColor: "#111111",
  paperColor: "#f0e8d6",
  threshold: 50,
  dotSize: 10,
  sharpen: 0,
  bloom: 0,
  grain: 0,
  texture: 0,
  rgbShift: 0,
  scanlines: 0,
  distortion: 0,
  edgeOn: false,
  edgeColor: "#f4e6c8",
  edgeWidth: 10,
  edgeOpacity: 55,
  shadowOn: false,
  shadowOffset: 18,
  shadowOpacity: 40,
  echoCount: 0,
  echoOffset: 28,
  echoOpacity: 45,
  echoColor: "#ff1f2d"
};

const TONE: ControlKey[] = ["exposure", "contrast", "saturation", "warmth"];
const EDGE: ControlKey[] = ["edgeOn", "edgeColor", "edgeWidth", "edgeOpacity"];

export const PRESETS: Preset[] = [
  {
    id: "emerald",
    name: "Emerald Editorial",
    blurb: "Emerald shadows, warm highlights, cream edge light",
    mode: "grade",
    defaults: { shadowColor: "#0d5a43", highlightColor: "#f4c98d", toneMix: 72, contrast: 18, saturation: -8, warmth: 4, sharpen: 35, grain: 6, edgeOn: true, edgeColor: "#f4e6c8", edgeWidth: 10, edgeOpacity: 55 },
    controls: [...TONE, "shadowColor", "highlightColor", "toneMix", "sharpen", "grain", ...EDGE, "fade"]
  },
  {
    id: "neon_duotone",
    name: "Neon Duotone",
    blurb: "Cyan shadows, magenta highlights",
    mode: "duotone",
    defaults: { shadowColor: "#00b8d9", highlightColor: "#ff2fb3", contrast: 22, grain: 4 },
    controls: ["exposure", "contrast", "shadowColor", "highlightColor", "grain", ...EDGE, "fade"]
  },
  {
    id: "silver_noir",
    name: "Silver Noir",
    blurb: "Dramatic black and white, fine grain",
    mode: "mono",
    defaults: { contrast: 45, sharpen: 25, grain: 28, edgeColor: "#ffffff", edgeWidth: 8, edgeOpacity: 45 },
    controls: ["exposure", "contrast", "sharpen", "grain", ...EDGE, "fade"]
  },
  {
    id: "golden_hour",
    name: "Golden Hour",
    blurb: "Amber warmth, soft bloom, faded shadows",
    mode: "grade",
    defaults: { shadowColor: "#6b4836", highlightColor: "#ffc46a", toneMix: 55, warmth: 32, contrast: -8, lift: 24, bloom: 45, saturation: 6, grain: 6 },
    controls: [...TONE, "lift", "bloom", "shadowColor", "highlightColor", "toneMix", "grain", "fade"]
  },
  {
    id: "xerox",
    name: "Xerox Grit",
    blurb: "Black-and-cream photocopy",
    mode: "threshold",
    defaults: { inkColor: "#121212", paperColor: "#efe6d2", threshold: 50, texture: 55, grain: 22, contrast: 10 },
    controls: ["threshold", "contrast", "inkColor", "paperColor", "texture", "grain", "fade"]
  },
  {
    id: "halftone",
    name: "Halftone Pop",
    blurb: "Two-color screenprint dots",
    mode: "halftone",
    defaults: { inkColor: "#1f1a3a", paperColor: "#ffd84a", dotSize: 10, contrast: 25 },
    controls: ["dotSize", "contrast", "exposure", "inkColor", "paperColor", "fade"]
  },
  {
    id: "vhs",
    name: "VHS Afterhours",
    blurb: "Scanlines, RGB split, tape noise",
    mode: "grade",
    defaults: { shadowColor: "#1d2c52", highlightColor: "#ffd9e4", toneMix: 30, saturation: 14, contrast: 8, rgbShift: 4, scanlines: 45, grain: 30, distortion: 22 },
    controls: ["rgbShift", "scanlines", "distortion", "grain", "saturation", "contrast", "fade"]
  },
  {
    id: "direct_flash",
    name: "Direct Flash",
    blurb: "Bright, crisp, neutral skin, hard shadow",
    mode: "grade",
    defaults: { exposure: 18, contrast: 22, saturation: 2, sharpen: 50, shadowOn: true, shadowOffset: 18, shadowOpacity: 42 },
    controls: [...TONE, "sharpen", "shadowOn", "shadowOffset", "shadowOpacity", "fade"]
  },
  {
    id: "midnight_blue",
    name: "Midnight Blue",
    blurb: "Cobalt shadows, cool highlights",
    mode: "grade",
    defaults: { shadowColor: "#0b2a8f", highlightColor: "#d2e5ff", toneMix: 75, saturation: -12, contrast: 16, warmth: -10, edgeOn: true, edgeColor: "#39e1ff", edgeWidth: 8, edgeOpacity: 45, grain: 6 },
    controls: [...TONE, "shadowColor", "highlightColor", "toneMix", "grain", ...EDGE, "fade"]
  },
  {
    id: "vintage_print",
    name: "Vintage Print",
    blurb: "Faded color, paper tone, scratches",
    mode: "grade",
    defaults: { shadowColor: "#4a3a29", highlightColor: "#f1dfbe", toneMix: 45, saturation: -35, contrast: -14, lift: 30, warmth: 14, grain: 34, texture: 45 },
    controls: [...TONE, "lift", "grain", "texture", "fade"]
  },
  {
    id: "red_strobe",
    name: "Red Strobe",
    blurb: "Red and black, silhouette echoes",
    mode: "duotone",
    defaults: { shadowColor: "#050505", highlightColor: "#ff1f2d", contrast: 34, echoCount: 3, echoOffset: 28, echoOpacity: 45, echoColor: "#ff1f2d" },
    controls: ["exposure", "contrast", "highlightColor", "echoCount", "echoOffset", "echoOpacity", "echoColor", "grain", "fade"]
  }
];

export const presetById = (id: string | null | undefined) => PRESETS.find((p) => p.id === id) ?? null;

/** Control labels and ranges for the panel. */
export const CONTROL_INFO: Record<ControlKey, { label: string; min?: number; max?: number; step?: number; unit?: string; kind?: "color" | "bool"; group: "tone" | "color" | "texture" | "mask" }> = {
  exposure: { label: "Exposure", min: -100, max: 100, group: "tone" },
  contrast: { label: "Contrast", min: -100, max: 100, group: "tone" },
  saturation: { label: "Saturation", min: -100, max: 100, group: "tone" },
  warmth: { label: "Warmth", min: -100, max: 100, group: "tone" },
  lift: { label: "Faded shadows", min: 0, max: 100, group: "tone" },
  bloom: { label: "Highlight bloom", min: 0, max: 100, group: "tone" },
  sharpen: { label: "Detail", min: 0, max: 100, group: "tone" },
  toneMix: { label: "Color grade", min: 0, max: 100, group: "color" },
  shadowColor: { label: "Shadow color", kind: "color", group: "color" },
  highlightColor: { label: "Highlight color", kind: "color", group: "color" },
  inkColor: { label: "Ink", kind: "color", group: "color" },
  paperColor: { label: "Paper / second ink", kind: "color", group: "color" },
  threshold: { label: "Threshold", min: 0, max: 100, group: "tone" },
  dotSize: { label: "Dot size", min: 3, max: 40, unit: "px", group: "texture" },
  grain: { label: "Grain", min: 0, max: 100, group: "texture" },
  texture: { label: "Texture", min: 0, max: 100, group: "texture" },
  rgbShift: { label: "RGB separation", min: 0, max: 20, unit: "px", group: "texture" },
  scanlines: { label: "Scanlines", min: 0, max: 100, group: "texture" },
  distortion: { label: "Tape wobble", min: 0, max: 100, group: "texture" },
  edgeOn: { label: "Edge light (from the cutout)", kind: "bool", group: "mask" },
  edgeColor: { label: "Edge color", kind: "color", group: "mask" },
  edgeWidth: { label: "Edge width", min: 1, max: 40, unit: "px", group: "mask" },
  edgeOpacity: { label: "Edge opacity", min: 0, max: 100, group: "mask" },
  shadowOn: { label: "Subject shadow", kind: "bool", group: "mask" },
  shadowOffset: { label: "Shadow offset", min: 0, max: 80, unit: "px", group: "mask" },
  shadowOpacity: { label: "Shadow opacity", min: 0, max: 100, group: "mask" },
  echoCount: { label: "Echoes", min: 0, max: 4, group: "mask" },
  echoOffset: { label: "Echo offset", min: 0, max: 80, unit: "px", group: "mask" },
  echoOpacity: { label: "Echo opacity", min: 0, max: 100, group: "mask" },
  echoColor: { label: "Echo color", kind: "color", group: "mask" },
  fade: { label: "Bottom fade", min: 0, max: 100, group: "mask" }
};

/** Controls that only do something on a cut-out photo (transparent background). */
export const NEEDS_CUTOUT: ControlKey[] = ["edgeOn", "edgeColor", "edgeWidth", "edgeOpacity", "shadowOn", "shadowOffset", "shadowOpacity", "echoCount", "echoOffset", "echoOpacity", "echoColor"];

export function newEffects(preset: PresetId, seed = Math.floor(Math.random() * 2 ** 31)): PhotoEffects {
  const p = presetById(preset)!;
  return { v: EFFECTS_VERSION, preset, strength: 1, params: {}, seed, mask: { fade: 0, fadeAt: 70, ...p.mask } };
}

/** The preset's defaults with the layer's changes on top. */
export function resolveParams(fx: PhotoEffects): Params {
  const p = presetById(fx.preset);
  return { ...BASE, ...(p?.defaults ?? {}), ...fx.params };
}

export const effectsOn = (fx: PhotoEffects | null | undefined): fx is PhotoEffects => !!fx && !!presetById(fx.preset) && fx.strength > 0;

/* ---------- validation (saved scenes) ---------- */

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Cleans a saved effects config; anything unknown is dropped. Returns null for "no effects". */
export function sanitizeEffects(raw: unknown): PhotoEffects | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const preset = presetById(typeof r.preset === "string" ? r.preset : null);
  if (!preset) return null;
  const params: Partial<Params> = {};
  const src = (r.params && typeof r.params === "object" ? r.params : {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(src)) {
    if (!(k in BASE)) continue;
    const def = BASE[k as keyof Params];
    if (typeof def === "boolean" && typeof v === "boolean") (params as Record<string, unknown>)[k] = v;
    else if (typeof def === "string" && typeof v === "string" && HEX.test(v)) (params as Record<string, unknown>)[k] = v.toLowerCase();
    else if (typeof def === "number" && typeof v === "number" && Number.isFinite(v)) {
      const info = CONTROL_INFO[k as ControlKey];
      (params as Record<string, unknown>)[k] = clamp(v, info?.min ?? -100, info?.max ?? 100);
    }
  }
  const m = (r.mask && typeof r.mask === "object" ? r.mask : {}) as Record<string, unknown>;
  const num = (v: unknown, a: number, b: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, a, b) : d);
  return {
    v: EFFECTS_VERSION,
    preset: preset.id,
    strength: num(r.strength, 0, 1, 1),
    params,
    seed: Math.round(num(r.seed, 0, 2 ** 31 - 1, 1)),
    mask: { fade: num(m.fade, 0, 100, 0), fadeAt: num(m.fadeAt, 0, 100, 70) },
    custom: typeof r.custom === "string" ? r.custom.slice(0, 40) : null
  };
}

/* ---------- pixel helpers ---------- */

export type Pixels = { data: Uint8ClampedArray; width: number; height: number };

const hex = (h: string): [number, number, number] => {
  const v = HEX.test(h) ? h : "#000000";
  return [parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255];
};
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Stable hash noise in 0..1 for an integer cell and seed. */
export function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
/** Smooth value noise (for blotches and paper fibers), cell size in px. */
function vnoise(x: number, y: number, cell: number, seed: number) {
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Separable box blur (3 passes ≈ gaussian) of a single-channel float map. */
export function blur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const r = Math.max(0, Math.round(radius / 1.7));
  if (r < 1) return src.slice();
  const a = src.slice();
  const b = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    // horizontal
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[row + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        b[row + x] = acc / (2 * r + 1);
        acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    // vertical
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * r + 1);
        acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}

function shifted(map: Float32Array, w: number, h: number, dx: number, dy: number): Float32Array {
  const out = new Float32Array(map.length);
  const ix = Math.round(dx);
  const iy = Math.round(dy);
  for (let y = 0; y < h; y++) {
    const sy = y - iy;
    if (sy < 0 || sy >= h) continue;
    for (let x = 0; x < w; x++) {
      const sx = x - ix;
      if (sx >= 0 && sx < w) out[y * w + x] = map[sy * w + sx];
    }
  }
  return out;
}

/** Share of see-through pixels: a cut-out subject vs. a full rectangular photo. */
export function cutoutShare(p: Pixels) {
  let clear = 0;
  const n = p.width * p.height;
  for (let i = 3; i < p.data.length; i += 4) if (p.data[i] < 200) clear++;
  return n ? clear / n : 0;
}

/* ---------- the engine ---------- */

/**
 * Applies the effects to a picture as it sits in its frame. `scale` =
 * output pixels per flyer pixel (0.5 for a quick preview, 1 on screen, 2 for
 * a high-resolution export). Returns a new buffer; alpha (the cutout) is kept
 * except where a mask effect deliberately adds a shadow or echo behind it.
 */
export function applyEffects(src: Pixels, fx: PhotoEffects, scale = 1): Pixels {
  const { width: w, height: h } = src;
  const n = w * h;
  const out = new Uint8ClampedArray(src.data);
  if (!effectsOn(fx) || n === 0) return { data: out, width: w, height: h };
  const preset = presetById(fx.preset)!;
  const P = resolveParams(fx);
  const s = Math.max(0.05, scale);
  const seed = fx.seed | 0;

  // Float RGB + alpha.
  const R = new Float32Array(n);
  const G = new Float32Array(n);
  const B = new Float32Array(n);
  const A = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    R[i] = src.data[j] / 255;
    G[i] = src.data[j + 1] / 255;
    B[i] = src.data[j + 2] / 255;
    A[i] = src.data[j + 3] / 255;
  }
  const isCutout = cutoutShare(src) > 0.02;

  // 1. Tape wobble: restrained horizontal row offsets (moves whole pixels, alpha included).
  if (P.distortion > 0) {
    const amp = (P.distortion / 100) * 6 * s;
    const band = 90 * s;
    for (let y = 0; y < h; y++) {
      const yy = y / s;
      const off = Math.round(amp * (Math.sin(yy / 23 + seed) * 0.6 + (vnoise(0, yy, 40, seed + 7) - 0.5) * 0.8) * (vnoise(0, yy, band / s, seed + 3) > 0.62 ? 1.6 : 0.5));
      if (!off) continue;
      const row = y * w;
      const tr = R.slice(row, row + w), tg = G.slice(row, row + w), tb = B.slice(row, row + w), ta = A.slice(row, row + w);
      for (let x = 0; x < w; x++) {
        const sx = clamp(x - off, 0, w - 1);
        R[row + x] = tr[sx];
        G[row + x] = tg[sx];
        B[row + x] = tb[sx];
        A[row + x] = ta[sx];
      }
    }
  }

  // 2. Tone: exposure, contrast, saturation, warmth, lifted blacks.
  const ex = Math.pow(2, (P.exposure / 100) * 1.2);
  const ct = 1 + (P.contrast / 100) * (P.contrast > 0 ? 1 : 0.6);
  const sat = 1 + P.saturation / 100;
  const warm = P.warmth / 100;
  const lift = (P.lift / 100) * 0.22;
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let r = R[i] * ex,
      g = G[i] * ex,
      b = B[i] * ex;
    // Contrast on lightness, keeping each pixel's color ratios (per-channel contrast
    // over-saturates dark skin); near black, fall back to per-channel.
    const l0 = lum(r, g, b);
    const l1 = (l0 - 0.5) * ct + 0.5;
    if (l0 > 0.03) {
      const k = Math.max(0, l1) / l0;
      r *= k;
      g *= k;
      b *= k;
    } else {
      r = (r - 0.5) * ct + 0.5;
      g = (g - 0.5) * ct + 0.5;
      b = (b - 0.5) * ct + 0.5;
    }
    const l = lum(r, g, b);
    r = l + (r - l) * sat;
    g = l + (g - l) * sat;
    b = l + (b - l) * sat;
    r += warm * 0.08;
    b -= warm * 0.08;
    g += warm * 0.015;
    r = lift + clamp(r, 0, 1) * (1 - lift);
    g = lift + clamp(g, 0, 1) * (1 - lift);
    b = lift + clamp(b, 0, 1) * (1 - lift);
    R[i] = r;
    G[i] = g;
    B[i] = b;
    L[i] = lum(r, g, b);
  }

  // 3. Detail: unsharp mask on lightness (keeps hue, so skin stays natural).
  if (P.sharpen > 0) {
    const bl = blur(L, w, h, 2.2 * s);
    const k = (P.sharpen / 100) * 1.4;
    for (let i = 0; i < n; i++) {
      const d = (L[i] - bl[i]) * k;
      R[i] = clamp(R[i] + d, 0, 1);
      G[i] = clamp(G[i] + d, 0, 1);
      B[i] = clamp(B[i] + d, 0, 1);
      L[i] = lum(R[i], G[i], B[i]);
    }
  }

  // 4. The look. Graphic looks (black and white, duotone, photocopy, halftone)
  // first spread the subject's own range of light and dark across the full
  // scale, with its middle tone in the middle, so deep and light skin alike
  // keep more of their features instead of going solid black or white.
  if (preset.mode !== "grade") {
    const hist = new Uint32Array(256);
    let total = 0;
    for (let i = 0; i < n; i++)
      if (A[i] > 0.5) {
        hist[Math.min(255, Math.max(0, Math.round(L[i] * 255)))]++;
        total++;
      }
    if (total > 50) {
      const at = (q: number) => {
        let acc = 0;
        for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= q * total) return v / 255;
        return 1;
      };
      const lo = at(0.02);
      const hi = at(0.995);
      // A one-tone layer (white text, a flat shape) has no range to spread: leave it as it is.
      if (hi - lo > 0.15) {
        const mid = clamp((at(0.5) - lo) / (hi - lo), 0.05, 0.95);
        const gamma = clamp(Math.log(0.5) / Math.log(mid), 0.55, 1.8);
        // half way: enough to rescue very dark or very light subjects without flattening the rest
        for (let i = 0; i < n; i++) L[i] = L[i] * 0.45 + Math.pow(clamp((L[i] - lo) / (hi - lo), 0, 1), gamma) * 0.55;
      }
    }
    // Then put skin (warm, moderately saturated pixels) in the midtones, light or deep,
    // so a face keeps its features in black-and-white, photocopy and halftone looks.
    const skinHist = new Uint32Array(256);
    let skinN = 0;
    for (let i = 0; i < n; i++)
      if (A[i] > 0.5 && R[i] > G[i] && G[i] >= B[i] && R[i] - B[i] > 0.06 && R[i] - B[i] < 0.55) {
        skinHist[Math.round(clamp(L[i], 0, 1) * 255)]++;
        skinN++;
      }
    if (total > 50 && skinN > total * 0.04) {
      let acc = 0,
        med = 0.5;
      for (let v = 0; v < 256; v++)
        if ((acc += skinHist[v]) >= skinN / 2) {
          med = Math.max(0.03, v / 255);
          break;
        }
      const g = clamp(Math.log(0.55) / Math.log(med), 0.45, 2.2);
      for (let i = 0; i < n; i++) L[i] = Math.pow(clamp(L[i], 0, 1), g);
    }
  }
  const sh = hex(P.shadowColor);
  const hi = hex(P.highlightColor);
  const ink = hex(P.inkColor);
  const paper = hex(P.paperColor);
  if (preset.mode === "grade") {
    // Split toning that keeps each pixel's lightness: light and shade (faces, folds) stay where they were.
    const mix = P.toneMix / 100;
    if (mix > 0)
      for (let i = 0; i < n; i++) {
        const l = L[i];
        // Skin (warm hues, any depth) gets a lighter grade so deep skin isn't read as "shadow" and turned green or blue.
        const skin = R[i] > G[i] && G[i] >= B[i] ? 0.7 * smooth(0.03, 0.1, R[i] - B[i]) : 0;
        const ws = (1 - smooth(0.05, 0.6, l)) * mix * 0.85 * (1 - skin);
        const wh = smooth(0.45, 1, l) * mix * 0.6 * (1 - skin * 0.5);
        let r = R[i] + (sh[0] - R[i]) * ws,
          g = G[i] + (sh[1] - G[i]) * ws,
          b = B[i] + (sh[2] - B[i]) * ws;
        r += (hi[0] - r) * wh;
        g += (hi[1] - g) * wh;
        b += (hi[2] - b) * wh;
        const nl = lum(r, g, b) || 1e-4;
        const keep = l / nl;
        // pull back to the original lightness (mostly), so the grade colors without crushing
        R[i] = clamp(r * (0.25 + 0.75 * keep), 0, 1);
        G[i] = clamp(g * (0.25 + 0.75 * keep), 0, 1);
        B[i] = clamp(b * (0.25 + 0.75 * keep), 0, 1);
      }
  } else if (preset.mode === "mono") {
    for (let i = 0; i < n; i++) {
      // deep blacks, bright highlights: an S-curve on lightness
      const l = L[i];
      const c = clamp(l * l * (3 - 2 * l) * 1.04 - 0.02, 0, 1);
      R[i] = G[i] = B[i] = c;
    }
  } else if (preset.mode === "duotone") {
    // Deepest shadows go to a dark version of the shadow color, midtones to the shadow color, highlights to the highlight color.
    const deep = [sh[0] * 0.18, sh[1] * 0.18, sh[2] * 0.22];
    for (let i = 0; i < n; i++) {
      const l = L[i];
      if (l < 0.38) {
        const t = smooth(0, 0.38, l);
        R[i] = deep[0] + (sh[0] - deep[0]) * t;
        G[i] = deep[1] + (sh[1] - deep[1]) * t;
        B[i] = deep[2] + (sh[2] - deep[2]) * t;
      } else {
        const t = smooth(0.38, 0.95, l);
        R[i] = sh[0] + (hi[0] - sh[0]) * t;
        G[i] = sh[1] + (hi[1] - sh[1]) * t;
        B[i] = sh[2] + (hi[2] - sh[2]) * t;
      }
    }
  } else if (preset.mode === "threshold") {
    const th = 0.18 + (P.threshold / 100) * 0.64;
    const distress = P.texture / 100;
    for (let i = 0; i < n; i++) {
      const x = (i % w) / s,
        y = Math.floor(i / w) / s;
      // toner varies across the page; specks of paper show through the ink
      const wob = (vnoise(x, y, 18, seed) - 0.5) * 0.22 * distress + (hash(Math.floor(x / 2), Math.floor(y / 2), seed + 11) - 0.5) * 0.16 * distress;
      const t = smooth(th - 0.03, th + 0.03, L[i] + wob);
      R[i] = ink[0] + (paper[0] - ink[0]) * t;
      G[i] = ink[1] + (paper[1] - ink[1]) * t;
      B[i] = ink[2] + (paper[2] - ink[2]) * t;
    }
  } else if (preset.mode === "halftone") {
    // Round dots on a 45° screen; dot area follows darkness.
    const cell = Math.max(2, P.dotSize * s);
    const lb = blur(L, w, h, cell * 0.35);
    const c45 = Math.SQRT1_2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const u = (x * c45 + y * c45) / cell;
        const v = (-x * c45 + y * c45) / cell;
        const cu = Math.floor(u) + 0.5,
          cv = Math.floor(v) + 0.5;
        const cx = clamp(Math.round((cu * c45 - cv * c45) * cell), 0, w - 1);
        const cy = clamp(Math.round((cu * c45 + cv * c45) * cell), 0, h - 1);
        const dark = 1 - lb[cy * w + cx];
        const rad = Math.sqrt(clamp(dark, 0, 1)) * 0.72;
        const d = Math.hypot(u - cu, v - cv);
        const t = 1 - smooth(rad - 0.6 / cell, rad + 0.6 / cell, d); // 1 = ink
        R[i] = paper[0] + (ink[0] - paper[0]) * t;
        G[i] = paper[1] + (ink[1] - paper[1]) * t;
        B[i] = paper[2] + (ink[2] - paper[2]) * t;
      }
  }

  // 5. Highlight bloom: the brightest parts glow softly (screened back on).
  if (P.bloom > 0) {
    const bright = new Float32Array(n);
    for (let i = 0; i < n; i++) bright[i] = smooth(0.62, 1, lum(R[i], G[i], B[i])) * A[i];
    const glow = blur(bright, w, h, 22 * s);
    const k = (P.bloom / 100) * 0.55;
    for (let i = 0; i < n; i++) {
      const g = glow[i] * k;
      R[i] = 1 - (1 - R[i]) * (1 - g * hi[0]);
      G[i] = 1 - (1 - G[i]) * (1 - g * hi[1]);
      B[i] = 1 - (1 - B[i]) * (1 - g * hi[2]);
    }
  }

  // 6. RGB separation: red shifted left, blue right (only from inside the subject, so edges stay clean).
  if (P.rgbShift > 0) {
    const d = Math.max(1, Math.round(P.rgbShift * s));
    const r0 = R.slice(),
      b0 = B.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const ir = y * w + clamp(x + d, 0, w - 1);
        const ib = y * w + clamp(x - d, 0, w - 1);
        if (A[ir] > 0.05) R[i] = r0[ir];
        if (A[ib] > 0.05) B[i] = b0[ib];
      }
  }

  // 7. Scanlines.
  if (P.scanlines > 0) {
    const period = 3 * s;
    const k = (P.scanlines / 100) * 0.38;
    for (let y = 0; y < h; y++) {
      const ph = (y % period) / period;
      const dim = 1 - k * (0.5 + 0.5 * Math.cos(ph * Math.PI * 2));
      const row = y * w;
      for (let x = 0; x < w; x++) {
        R[row + x] *= dim;
        G[row + x] *= dim;
        B[row + x] *= dim;
      }
    }
  }

  // 8. Grain (monochrome, fixed per flyer pixel and seed).
  if (P.grain > 0) {
    const k = (P.grain / 100) * 0.22;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const g = (hash(Math.floor(x / s), Math.floor(y / s), seed) - 0.5) * k * (0.6 + 0.8 * (1 - Math.abs(L[i] - 0.5) * 2));
        R[i] += g;
        G[i] += g;
        B[i] += g;
      }
  }

  // 9. Print texture (Vintage Print): paper fibers, worn ink and fine vertical scratches.
  if (P.texture > 0 && preset.mode !== "threshold") {
    const k = P.texture / 100;
    const lines: number[] = [];
    const count = Math.round(4 + k * 10);
    for (let j = 0; j < count; j++) lines.push(hash(j, 1, seed + 21) * (w / s));
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const fx = x / s,
          fy = y / s;
        const worn = smooth(0.62, 0.82, vnoise(fx, fy, 60, seed + 5)) * 0.18 * k;
        const fiber = (vnoise(fx, fy, 3, seed + 9) - 0.5) * 0.06 * k;
        let scratch = 0;
        for (const lx of lines) {
          const dx = Math.abs(fx - lx - Math.sin(fy / 140 + lx) * 6);
          if (dx < 0.8 && vnoise(lx, fy, 120, seed + 13) > 0.45) scratch = Math.max(scratch, (1 - dx / 0.8) * 0.35 * k);
        }
        const v = worn + fiber + scratch;
        R[i] = R[i] + (paper[0] - R[i]) * clamp(v, 0, 1);
        G[i] = G[i] + (paper[1] - G[i]) * clamp(v, 0, 1);
        B[i] = B[i] + (paper[2] - B[i]) * clamp(v, 0, 1);
      }
  }

  // 10. Edge light: a rim on the subject's edge, approximated from the cutout's alpha (not real relighting).
  if (P.edgeOn && P.edgeOpacity > 0 && isCutout) {
    const wdt = Math.max(1, P.edgeWidth * s);
    // light from the upper left: compare the alpha with a copy pushed toward the light
    const blurred = blur(shifted(A, w, h, wdt * 0.55, wdt * 0.45), w, h, wdt * 0.8);
    const ec = hex(P.edgeColor);
    const k = P.edgeOpacity / 100;
    for (let i = 0; i < n; i++) {
      if (A[i] <= 0) continue;
      const rim = clamp((A[i] - blurred[i]) * 1.6, 0, 1) * k;
      if (rim <= 0) continue;
      R[i] = 1 - (1 - R[i]) * (1 - ec[0] * rim);
      G[i] = 1 - (1 - G[i]) * (1 - ec[1] * rim);
      B[i] = 1 - (1 - B[i]) * (1 - ec[2] * rim);
    }
  }

  // Effected subject, premultiplied, then the things that sit behind it.
  const pr = new Float32Array(n),
    pg = new Float32Array(n),
    pb = new Float32Array(n),
    pa = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = A[i];
    pr[i] = clamp(R[i], 0, 1) * a;
    pg[i] = clamp(G[i], 0, 1) * a;
    pb[i] = clamp(B[i], 0, 1) * a;
    pa[i] = a;
  }
  const under = (col: [number, number, number], alpha: Float32Array, op: number) => {
    for (let i = 0; i < n; i++) {
      const ua = clamp(alpha[i] * op, 0, 1) * (1 - pa[i]);
      if (ua <= 0) continue;
      pr[i] += col[0] * ua;
      pg[i] += col[1] * ua;
      pb[i] += col[2] * ua;
      pa[i] += ua;
    }
  };
  // 11. Silhouette echoes behind the subject (alternating right/left).
  if (P.echoCount > 0 && P.echoOpacity > 0 && isCutout) {
    const ec = hex(P.echoColor);
    for (let e = 1; e <= Math.round(P.echoCount); e++) {
      const side = e % 2 ? 1 : -1;
      const off = Math.ceil(e / 2) * P.echoOffset * s * side;
      under(ec, shifted(A, w, h, off, 0), (P.echoOpacity / 100) * (1 - (e - 1) / (P.echoCount + 1)));
    }
  }
  // 12. Subject shadow (direct flash): the cutout, offset down-right and softened.
  if (P.shadowOn && P.shadowOpacity > 0 && isCutout) {
    const o = P.shadowOffset * s;
    under([0, 0, 0], blur(shifted(A, w, h, o * 0.6, o), w, h, Math.max(1, o * 0.35)), P.shadowOpacity / 100);
  }

  // 13. Bottom fade.
  if (fx.mask.fade > 0) {
    const start = (fx.mask.fadeAt / 100) * h;
    const k = fx.mask.fade / 100;
    for (let y = Math.floor(start); y < h; y++) {
      const t = smooth(start, h, y) * k;
      const m = 1 - t;
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        pr[i] *= m;
        pg[i] *= m;
        pb[i] *= m;
        pa[i] *= m;
      }
    }
  }

  // 14. Overall strength: blend (premultiplied) with the untouched picture.
  const st = clamp(fx.strength, 0, 1);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const oa = src.data[j + 3] / 255;
    const a = oa + (pa[i] - oa) * st;
    if (a <= 0.0005) {
      out[j] = out[j + 1] = out[j + 2] = out[j + 3] = 0;
      continue;
    }
    const r = (src.data[j] / 255) * oa + (pr[i] - (src.data[j] / 255) * oa) * st;
    const g = (src.data[j + 1] / 255) * oa + (pg[i] - (src.data[j + 1] / 255) * oa) * st;
    const b = (src.data[j + 2] / 255) * oa + (pb[i] - (src.data[j + 2] / 255) * oa) * st;
    out[j] = Math.round((r / a) * 255);
    out[j + 1] = Math.round((g / a) * 255);
    out[j + 2] = Math.round((b / a) * 255);
    out[j + 3] = Math.round(a * 255);
  }
  return { data: out, width: w, height: h };
}
