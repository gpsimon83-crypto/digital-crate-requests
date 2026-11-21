/**
 * Non-destructive layer masks for pictures. The mask is a list of brush
 * strokes (hide / restore) plus an optional linear or radial fade and an
 * edge feather, all stored in the picture's own coordinates: u, v from 0 to 1
 * across the original image (before crop, zoom and flip), and sizes as a share
 * of the image's width. So the mask stays on the same pixels whatever the
 * layer's position, size, rotation, flip or crop. The photo file is never
 * changed: the mask is drawn as an alpha map and multiplied into the picture's
 * own transparency, so "restore" can only bring back pixels the file has.
 */

export type MaskStroke = {
  mode: "hide" | "restore";
  /** Brush diameter as a share of the image width. */
  size: number;
  /** 0 = very soft edge, 1 = hard edge. */
  hardness: number;
  /** 0–1: how much one stroke hides or restores. */
  opacity: number;
  /** u, v pairs (0–1 across the original image). */
  points: number[];
};

export type MaskFade = {
  type: "linear" | "radial";
  /** Linear: fully shown at `a`, fully hidden at `b`. Radial: centre `a`, edge at `b`. */
  a: [number, number];
  b: [number, number];
  /** Swap the shown and hidden sides. */
  reverse: boolean;
};

export type ImageMask = {
  v: 1;
  strokes: MaskStroke[];
  fade: MaskFade | null;
  /** Edge softening as a share of the image width (0–0.1). */
  feather: number;
};

export const MAX_MASK_STROKES = 400;
/** Total stored numbers (u and v) across a mask's strokes: keeps flyers well under the save limit. */
export const MAX_MASK_NUMBERS = 24_000;
const Q = 10_000;
const q = (v: number) => Math.round(v * Q) / Q;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fin = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : d);

export const emptyMask = (): ImageMask => ({ v: 1, strokes: [], fade: null, feather: 0 });

/** Is anything in the mask actually hiding pixels? */
export function maskOn(m: ImageMask | null | undefined): m is ImageMask {
  return !!m && (m.strokes.length > 0 || !!m.fade);
}

/** Cleans a stored mask (unknown → null). Points are quantised and clipped to sane ranges; old flyers have none. */
export function sanitizeMask(raw: unknown): ImageMask | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const strokes: MaskStroke[] = [];
  let budget = MAX_MASK_NUMBERS;
  for (const s of Array.isArray(r.strokes) ? r.strokes.slice(0, MAX_MASK_STROKES) : []) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const pts = Array.isArray(o.points) ? o.points : [];
    const out: number[] = [];
    for (let i = 0; i + 1 < pts.length && out.length < budget; i += 2) {
      const u = pts[i];
      const v = pts[i + 1];
      if (typeof u !== "number" || typeof v !== "number" || !Number.isFinite(u) || !Number.isFinite(v)) continue;
      // Strokes may start just outside the picture; keep a margin so edges can be brushed.
      out.push(q(clamp(u, -0.5, 1.5)), q(clamp(v, -0.5, 1.5)));
    }
    if (!out.length) continue;
    budget -= out.length;
    strokes.push({
      mode: o.mode === "restore" ? "restore" : "hide",
      size: q(fin(o.size, 0.0005, 2, 0.05)),
      hardness: q(fin(o.hardness, 0, 1, 0.5)),
      opacity: q(fin(o.opacity, 0.01, 1, 1)),
      points: out
    });
    if (budget <= 0) break;
  }
  let fade: MaskFade | null = null;
  if (r.fade && typeof r.fade === "object") {
    const f = r.fade as Record<string, unknown>;
    const pt = (p: unknown, d: [number, number]): [number, number] =>
      Array.isArray(p) && p.length === 2 ? [q(fin(p[0], -2, 3, d[0])), q(fin(p[1], -2, 3, d[1]))] : d;
    const a = pt(f.a, [0.5, 0.6]);
    const b = pt(f.b, [0.5, 1]);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.0005) fade = { type: f.type === "radial" ? "radial" : "linear", a, b, reverse: f.reverse === true };
  }
  const feather = q(fin(r.feather, 0, 0.1, 0));
  const m: ImageMask = { v: 1, strokes, fade, feather };
  return maskOn(m) ? m : null;
}

/** Stores a point for a stroke only once the brush has moved far enough (keeps saved flyers small). */
export function addPoint(points: number[], u: number, v: number, size: number): number[] {
  const n = points.length;
  if (n >= 2 && Math.hypot(u - points[n - 2], v - points[n - 1]) < Math.max(0.0008, size * 0.08)) return points;
  return [...points, q(u), q(v)];
}

export function countNumbers(m: ImageMask | null | undefined) {
  return m ? m.strokes.reduce((t, s) => t + s.points.length, 0) : 0;
}

/* ---------------- coordinates ---------------- */

export type Lay = { x: number; y: number; width: number; height: number };

/** A point in the layer's frame (0..width, 0..height) → the image's u, v. */
export function frameToUV(p: { x: number; y: number }, lay: Lay, flipX: boolean, flipY: boolean): [number, number] {
  let u = (p.x - lay.x) / Math.max(1e-6, lay.width);
  let v = (p.y - lay.y) / Math.max(1e-6, lay.height);
  if (flipX) u = 1 - u;
  if (flipY) v = 1 - v;
  return [u, v];
}

/** The image's u, v → a point in the layer's frame. */
export function uvToFrame(u: number, v: number, lay: Lay, flipX: boolean, flipY: boolean) {
  return { x: lay.x + (flipX ? 1 - u : u) * lay.width, y: lay.y + (flipY ? 1 - v : v) * lay.height };
}

/** Raster size for a mask: the picture's shown size × output scale, never above the file's own pixels, at most 2048 wide. */
export function maskRasterSize(natural: { width: number; height: number }, lay: Lay, scale: number) {
  const nw = Math.max(1, natural.width);
  const nh = Math.max(1, natural.height);
  const w = Math.round(clamp(Math.min(nw, lay.width * scale, 2048), 16, 2048));
  return { width: w, height: Math.max(1, Math.round((w * nh) / nw)) };
}

/* ---------------- drawing (browser only) ---------------- */

type Cache = { strokes: MaskStroke[]; canvas: HTMLCanvasElement };
/** Per layer and raster size: the strokes already drawn (by identity), so a new stroke only draws itself. */
const strokeCache = new Map<string, Cache>();

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/**
 * One stroke's coverage (0–1 alpha) at raster size. Each dab is a round soft
 * brush tip; overlapping dabs combine by "lighter of the two" (not added up),
 * so a soft brush stays soft along the whole stroke, like a real brush.
 */
function strokeCoverage(s: MaskStroke, W: number, H: number) {
  const d = Math.max(1, s.size * W);
  const r = d / 2;
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < s.points.length; i += 2) pts.push([s.points[i] * W, s.points[i + 1] * H]);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const x0 = Math.max(0, Math.floor(minX - r - 1));
  const y0 = Math.max(0, Math.floor(minY - r - 1));
  const x1 = Math.min(W, Math.ceil(maxX + r + 1));
  const y1 = Math.min(H, Math.ceil(maxY + r + 1));
  if (x1 <= x0 || y1 <= y0) return null;
  const c = canvasOf(x1 - x0, y1 - y0);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "lighten";
  const hard = clamp(s.hardness, 0, 1);
  const dab = (x: number, y: number) => {
    const g = ctx.createRadialGradient(x - x0, y - y0, 0, x - x0, y - y0, r);
    g.addColorStop(0, "#fff");
    if (hard < 1) {
      // Solid core, then an eased fall-off to the tip's edge.
      const core = hard * 0.98;
      g.addColorStop(core, "#fff");
      for (const t of [0.25, 0.5, 0.75]) {
        const e = 1 - t * t * (3 - 2 * t);
        const k = Math.round(e * 255);
        g.addColorStop(core + (1 - core) * t, `rgb(${k},${k},${k})`);
      }
    } else g.addColorStop(0.97, "#fff");
    g.addColorStop(1, "#000");
    ctx.fillStyle = g;
    ctx.fillRect(x - x0 - r, y - y0 - r, d, d);
  };
  const step = Math.max(0.75, d * 0.1);
  dab(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 1; k <= n; k++) dab(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
  }
  // Brightness → transparency: white tip = full stroke, black = none.
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const px = img.data;
  const op = clamp(s.opacity, 0, 1);
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i] * op;
    px[i] = px[i + 1] = px[i + 2] = 255;
    px[i + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, x: x0, y: y0 };
}

function drawStroke(ctx: CanvasRenderingContext2D, s: MaskStroke, W: number, H: number) {
  const cov = strokeCoverage(s, W, H);
  if (!cov) return;
  ctx.save();
  // Hide removes coverage from the mask; restore paints it back (up to the picture's own alpha later).
  ctx.globalCompositeOperation = s.mode === "hide" ? "destination-out" : "source-over";
  ctx.drawImage(cov.canvas, cov.x, cov.y);
  ctx.restore();
}

/** All strokes on a white (fully shown) map, reusing the work for strokes already drawn. */
function strokesCanvas(owner: string, strokes: MaskStroke[], W: number, H: number) {
  const key = `${owner}|${W}x${H}`;
  const hit = strokeCache.get(key);
  let k = 0;
  if (hit) while (k < hit.strokes.length && k < strokes.length && hit.strokes[k] === strokes[k]) k++;
  const reuse = hit && k === hit.strokes.length;
  const base = reuse ? hit.canvas : canvasOf(W, H);
  const bctx = base.getContext("2d")!;
  if (!reuse) {
    bctx.fillStyle = "#fff";
    bctx.fillRect(0, 0, W, H);
    k = 0;
  }
  // Every stroke but the newest is kept for next time (the newest is usually still being drawn).
  const keep = Math.max(k, strokes.length - 1);
  for (let i = k; i < keep; i++) drawStroke(bctx, strokes[i], W, H);
  strokeCache.delete(key);
  strokeCache.set(key, { strokes: strokes.slice(0, keep), canvas: base });
  // Only the most recent few rasters are kept.
  while (strokeCache.size > 12) strokeCache.delete(strokeCache.keys().next().value as string);
  const out = canvasOf(W, H);
  const octx = out.getContext("2d")!;
  octx.drawImage(base, 0, 0);
  for (let i = keep; i < strokes.length; i++) drawStroke(octx, strokes[i], W, H);
  return out;
}

const SMOOTH = [0, 0.06, 0.22, 0.5, 0.78, 0.94, 1];
const SMOOTH_T = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1];

function fadeCanvas(f: MaskFade, W: number, H: number) {
  const c = canvasOf(W, H);
  const ctx = c.getContext("2d")!;
  const ax = f.a[0] * W;
  const ay = f.a[1] * H;
  const bx = f.b[0] * W;
  const by = f.b[1] * H;
  const g = f.type === "radial" ? ctx.createRadialGradient(ax, ay, 0, ax, ay, Math.max(1, Math.hypot(bx - ax, by - ay))) : ctx.createLinearGradient(ax, ay, bx, by);
  SMOOTH_T.forEach((t, i) => {
    const shown = f.reverse ? SMOOTH[i] : 1 - SMOOTH[i];
    g.addColorStop(t, `rgba(255,255,255,${shown})`);
  });
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  return c;
}

function featherAlpha(c: HTMLCanvasElement, radius: number) {
  if (radius < 1) return;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const px = img.data;
  const n = c.width * c.height;
  // Blur at most ~512 px wide for speed, then scale back up (soft edges don't need more).
  const k = Math.max(1, Math.ceil(c.width / 512));
  const w = Math.ceil(c.width / k);
  const h = Math.ceil(c.height / k);
  let a: Float32Array = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      let cnt = 0;
      for (let yy = y * k; yy < Math.min(c.height, y * k + k); yy++)
        for (let xx = x * k; xx < Math.min(c.width, x * k + k); xx++) {
          s += px[(yy * c.width + xx) * 4 + 3];
          cnt++;
        }
      a[y * w + x] = s / Math.max(1, cnt);
    }
  a = boxBlur(a, w, h, radius / k);
  for (let i = 0; i < n; i++) {
    const x = (i % c.width) / k;
    const y = Math.floor(i / c.width) / k;
    const x0 = Math.min(w - 1, Math.max(0, Math.floor(x - 0.5)));
    const y0 = Math.min(h - 1, Math.max(0, Math.floor(y - 0.5)));
    const x1 = Math.min(w - 1, x0 + 1);
    const y1 = Math.min(h - 1, y0 + 1);
    const fx = clamp(x - 0.5 - x0, 0, 1);
    const fy = clamp(y - 0.5 - y0, 0, 1);
    const top = a[y0 * w + x0] * (1 - fx) + a[y0 * w + x1] * fx;
    const bot = a[y1 * w + x0] * (1 - fx) + a[y1 * w + x1] * fx;
    px[i * 4 + 3] = top * (1 - fy) + bot * fy;
  }
  ctx.putImageData(img, 0, 0);
}

/** Separable box blur ×3 (≈ gaussian), edges clamped. */
function boxBlur(src: Float32Array, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.round(radius / 1.7));
  if (r < 1) return src;
  const a = src;
  const b = new Float32Array(a.length);
  const div = 2 * r + 1;
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[row + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        b[row + x] = acc / div;
        acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / div;
        acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}

/**
 * The mask as an alpha map at W × H (white, alpha = how much shows). Drawn
 * over the image's full rectangle, so the same map works at any crop.
 */
export function maskCanvas(m: ImageMask, W: number, H: number, owner = ""): HTMLCanvasElement {
  const c = m.strokes.length ? strokesCanvas(owner, m.strokes, W, H) : (() => {
    const o = canvasOf(W, H);
    const x = o.getContext("2d")!;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, W, H);
    return o;
  })();
  if (m.feather > 0) featherAlpha(c, m.feather * W);
  if (m.fade) {
    const ctx = c.getContext("2d")!;
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(fadeCanvas(m.fade, W, H), 0, 0);
    ctx.restore();
  }
  return c;
}
