/**
 * Pixel effects (glitch, grain, shine, masked reveal), applied to one
 * layer's own rendered pixels. The same functions run in the editor
 * preview and in the MP4 export: the layer is drawn into a small canvas
 * (Konva's cache), these ops run on its pixels, and the result is drawn
 * in the layer's place. So:
 *
 * - transparency is kept: every op works on the layer's pixels only and
 *   never paints where the layer is fully transparent (no boxes appear
 *   around cutouts or logos);
 * - sizes are in flyer pixels and scaled by `px` (pixels per flyer pixel),
 *   so a 40 px slice offset looks the same in the small preview and the
 *   full-size export;
 * - nothing here reads the clock or Math.random: noise comes from seeds.
 *
 * The artwork itself is never changed; only the copy drawn this frame is.
 */

export type RasterOp =
  /** Horizontal bands (y as a share of the layer height) shifted sideways by dx flyer px. */
  | { kind: "slices"; bands: { y0: number; y1: number; dx: number }[] }
  /** Red and blue channels offset from green (flyer px); alpha follows the strongest channel. */
  | { kind: "rgb"; rdx: number; rdy: number; bdx: number; bdy: number }
  /** Rows between y0 and y1 bent sideways by a sine wave (tracking error / signal wobble). */
  | { kind: "rowwave"; y0: number; y1: number; amp: number; freq: number; phase: number }
  /** Dark scanlines every `spacing` flyer px, scrolled by `offset`. */
  | { kind: "scan"; alpha: number; spacing: number; offset: number }
  /** Seeded noise; mono for grain, colour for signal noise. */
  | { kind: "noise"; amount: number; seed: number; mono: boolean }
  /** Brightness multiplier (kept within ±15% by the presets: no strong flashes). */
  | { kind: "exposure"; gain: number }
  /** A bright band across the layer, only where the layer has pixels (text shine). */
  | { kind: "shine"; pos: number; width: number; angle: number; alpha: number; color: [number, number, number] }
  /** Soft wipe that reveals the layer (0 = hidden, 1 = shown), following its own cutout edges. */
  | { kind: "wipe"; amount: number; dir: "left" | "right" | "up" | "down"; soft: number };

export type Pixels = { data: Uint8ClampedArray; width: number; height: number };

/** Small, fast deterministic noise for a pixel (no state, so any order gives the same frame). */
function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** How far ops can move pixels (flyer px): the cache is padded by this so nothing is cut off. */
export function rasterPad(ops: RasterOp[]) {
  let p = 0;
  for (const o of ops) {
    if (o.kind === "slices") for (const b of o.bands) p = Math.max(p, Math.abs(b.dx));
    else if (o.kind === "rgb") p = Math.max(p, Math.abs(o.rdx), Math.abs(o.rdy), Math.abs(o.bdx), Math.abs(o.bdy));
    else if (o.kind === "rowwave") p = Math.max(p, Math.abs(o.amp));
  }
  return Math.ceil(p) + 2;
}

export function applyRaster(img: Pixels, ops: RasterOp[], px: number) {
  for (const o of ops) {
    switch (o.kind) {
      case "slices":
        slices(img, o.bands, px);
        break;
      case "rgb":
        rgb(img, o, px);
        break;
      case "rowwave":
        rowwave(img, o, px);
        break;
      case "scan":
        scan(img, o, px);
        break;
      case "noise":
        noise(img, o);
        break;
      case "exposure":
        exposure(img, o.gain);
        break;
      case "shine":
        shine(img, o);
        break;
      case "wipe":
        wipe(img, o);
        break;
    }
  }
}

/** Shifts one row by dx pixels (what slides off is dropped, what's uncovered is transparent). */
function shiftRow(d: Uint8ClampedArray, w: number, y: number, dx: number, src: Uint8ClampedArray) {
  const row = y * w * 4;
  const s = Math.round(dx);
  if (!s) return;
  for (let x = 0; x < w; x++) {
    const sx = x - s;
    const o = row + x * 4;
    if (sx < 0 || sx >= w) {
      d[o + 3] = 0;
      continue;
    }
    const i = row + sx * 4;
    d[o] = src[i];
    d[o + 1] = src[i + 1];
    d[o + 2] = src[i + 2];
    d[o + 3] = src[i + 3];
  }
}

function slices(img: Pixels, bands: { y0: number; y1: number; dx: number }[], px: number) {
  const { data, width: w, height: h } = img;
  const src = data.slice();
  for (const b of bands) {
    const a = Math.max(0, Math.floor(b.y0 * h));
    const z = Math.min(h, Math.ceil(b.y1 * h));
    for (let y = a; y < z; y++) shiftRow(data, w, y, b.dx * px, src);
  }
}

function rowwave(img: Pixels, o: { y0: number; y1: number; amp: number; freq: number; phase: number }, px: number) {
  const { data, width: w, height: h } = img;
  const src = data.slice();
  const a = Math.max(0, Math.floor(o.y0 * h));
  const z = Math.min(h, Math.ceil(o.y1 * h));
  const span = Math.max(1, z - a);
  for (let y = a; y < z; y++) {
    const k = (y - a) / span;
    // Tapers to zero at the band edges so the band has no hard seam.
    const taper = Math.sin(Math.PI * k);
    shiftRow(data, w, y, o.amp * px * taper * Math.sin(2 * Math.PI * (o.freq * k + o.phase)), src);
  }
}

function rgb(img: Pixels, o: { rdx: number; rdy: number; bdx: number; bdy: number }, px: number) {
  const { data, width: w, height: h } = img;
  const src = data.slice();
  const rx = Math.round(o.rdx * px);
  const ry = Math.round(o.rdy * px);
  const bx = Math.round(o.bdx * px);
  const by = Math.round(o.bdy * px);
  if (!rx && !ry && !bx && !by) return;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o4 = (y * w + x) * 4;
      // Each channel is read from its own offset, weighted by the alpha there.
      const xr = x - rx;
      const yr = y - ry;
      const xb = x - bx;
      const yb = y - by;
      const ir = xr >= 0 && xr < w && yr >= 0 && yr < h ? (yr * w + xr) * 4 : -1;
      const ib = xb >= 0 && xb < w && yb >= 0 && yb < h ? (yb * w + xb) * 4 : -1;
      const ar = ir >= 0 ? src[ir + 3] : 0;
      const ag = src[o4 + 3];
      const ab = ib >= 0 ? src[ib + 3] : 0;
      const a = Math.max(ar, ag, ab);
      if (!a) {
        data[o4 + 3] = 0;
        continue;
      }
      // Premultiplied per channel, then back to straight colour: clean fringes, no dark halos.
      data[o4] = ir >= 0 ? (src[ir] * ar) / a : 0;
      data[o4 + 1] = (src[o4 + 1] * ag) / a;
      data[o4 + 2] = ib >= 0 ? (src[ib + 2] * ab) / a : 0;
      data[o4 + 3] = a;
    }
  }
}

function scan(img: Pixels, o: { alpha: number; spacing: number; offset: number }, px: number) {
  const { data, width: w, height: h } = img;
  const sp = Math.max(2, o.spacing * px);
  const k = 1 - Math.min(0.6, Math.max(0, o.alpha));
  for (let y = 0; y < h; y++) {
    const p = (((y + o.offset * px) % sp) + sp) % sp;
    if (p >= sp / 2) continue;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] *= k;
      data[i + 1] *= k;
      data[i + 2] *= k;
    }
  }
}

function noise(img: Pixels, o: { amount: number; seed: number; mono: boolean }) {
  const { data, width: w, height: h } = img;
  const amt = Math.min(0.5, Math.max(0, o.amount)) * 255;
  if (!amt) return;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!data[i + 3]) continue; // never paints on transparent pixels
      const n = (hash(x, y, o.seed) - 0.5) * amt;
      if (o.mono) {
        data[i] = clamp255(data[i] + n);
        data[i + 1] = clamp255(data[i + 1] + n);
        data[i + 2] = clamp255(data[i + 2] + n);
      } else {
        data[i] = clamp255(data[i] + n);
        data[i + 1] = clamp255(data[i + 1] + (hash(x, y, o.seed + 7) - 0.5) * amt);
        data[i + 2] = clamp255(data[i + 2] + (hash(x, y, o.seed + 13) - 0.5) * amt);
      }
    }
  }
}

function exposure(img: Pixels, gain: number) {
  const g = Math.min(1.15, Math.max(0.85, gain));
  if (g === 1) return;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp255(d[i] * g);
    d[i + 1] = clamp255(d[i + 1] * g);
    d[i + 2] = clamp255(d[i + 2] * g);
  }
}

function shine(img: Pixels, o: { pos: number; width: number; angle: number; alpha: number; color: [number, number, number] }) {
  const { data, width: w, height: h } = img;
  if (o.alpha <= 0) return;
  const a = (o.angle * Math.PI) / 180;
  const cx = Math.cos(a);
  const sy = Math.sin(a);
  const span = Math.abs(w * cx) + Math.abs(h * sy);
  const centre = (o.pos - 0.5) * span;
  const half = Math.max(1, (o.width * span) / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!data[i + 3]) continue;
      const along = (x - w / 2) * cx + (y - h / 2) * sy;
      const d = Math.abs(along - centre) / half;
      if (d >= 1) continue;
      const k = o.alpha * (0.5 + 0.5 * Math.cos(Math.PI * d));
      data[i] = clamp255(data[i] + (o.color[0] - data[i]) * k);
      data[i + 1] = clamp255(data[i + 1] + (o.color[1] - data[i + 1]) * k);
      data[i + 2] = clamp255(data[i + 2] + (o.color[2] - data[i + 2]) * k);
    }
  }
}

function wipe(img: Pixels, o: { amount: number; dir: "left" | "right" | "up" | "down"; soft: number }) {
  const { data, width: w, height: h } = img;
  const amt = Math.min(1, Math.max(0, o.amount));
  if (amt >= 1) return;
  const soft = Math.max(0.01, o.soft);
  // The edge travels from −soft to 1 so amount 0 hides everything and 1 shows everything.
  const edge = -soft + amt * (1 + soft);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!data[i + 3]) continue;
      const p = o.dir === "right" ? x / w : o.dir === "left" ? 1 - x / w : o.dir === "down" ? y / h : 1 - y / h;
      const k = Math.min(1, Math.max(0, (edge + soft - p) / soft));
      data[i + 3] = data[i + 3] * k;
    }
  }
}

/* ---------------- glitch schedules ---------------- */

/**
 * Where the glitch bursts fall in the loop. Each burst gets its own slot
 * (count slots per loop) and starts at a seeded point in it, always
 * finishing inside the slot: so no burst crosses the loop point, the
 * frames either side of the seam are clean, and every repeat of the loop
 * glitches at exactly the same moments.
 */
export function burstAt(loopU: number, seed: number, count: number, lenU: number) {
  const n = Math.max(1, Math.round(count));
  const slot = 1 / n;
  const len = Math.min(lenU, slot * 0.8);
  const k = Math.min(n - 1, Math.floor(loopU / slot));
  let s = (seed * 9301 + k * 49297 + 233280) % 233280;
  const r = (s = (s * 9301 + 49297) % 233280) / 233280;
  const start = k * slot + slot * 0.1 + (slot * 0.9 - len) * r;
  const local = (loopU - start) / len;
  if (local < 0 || local >= 1) return null;
  return { k, local };
}
