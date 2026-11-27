/**
 * Draws Echo effects (lib/flyers/echo.ts) with the canvas: one routine for
 * the editor, the picker thumbnails, Animate's preview and every export, so
 * the same settings always look the same.
 *
 * `src` is the layer's picture as it sits in its frame (with its cutout,
 * mask, feather and photo effects), `scale` output pixels per flyer pixel.
 * The result holds the echoes only, sized to how far they reach, placed at
 * (x, y) in flyer px relative to the layer; the original is drawn by the
 * layer itself on top.
 */
import { echoBounds, echoCopies, type EchoCopy, type EchoInput } from "@/lib/flyers/echo";

export type EchoDrawing = { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number; original: boolean };

type Variant = { c: HTMLCanvasElement; pad: number };
const variants = new WeakMap<CanvasImageSource, Map<string, Variant>>();
const MAX_PIXELS = 18_000_000;

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
const sizeOf = (src: CanvasImageSource) => {
  const s = src as { width: number; height: number; naturalWidth?: number; naturalHeight?: number };
  return { w: s.naturalWidth || s.width, h: s.naturalHeight || s.height };
};

/** A soft copy: drawn small, then back up to size (works in every browser, unlike ctx.filter). */
function blurred(src: HTMLCanvasElement, radius: number) {
  if (radius < 1) return src;
  const f = Math.min(24, Math.max(1.5, radius / 2));
  const small = canvas(src.width / f, src.height / f);
  const g = small.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, small.width, small.height);
  const out = canvas(src.width, src.height);
  const o = out.getContext("2d")!;
  o.imageSmoothingQuality = "high";
  o.drawImage(small, 0, 0, out.width, out.height);
  return out;
}

/** The picture a copy is drawn from (cached per source picture, so animation frames reuse them). */
function variantOf(src: CanvasImageSource, c: EchoCopy, s: number): Variant {
  let m = variants.get(src);
  if (!m) variants.set(src, (m = new Map()));
  const key = `${c.mode}|${c.color}|${c.tint.toFixed(2)}|${c.dim.toFixed(2)}|${c.mono}|${c.width}|${Math.round(c.glow)}|${Math.round(c.blur)}|${s}`;
  const hit = m.get(key);
  if (hit) return hit;
  const { w, h } = sizeOf(src);
  let v: Variant;
  if (c.mode === "silhouette" || c.mode === "outline") {
    const sil = canvas(w, h);
    const g = sil.getContext("2d")!;
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = c.color ?? "#ffffff";
    g.fillRect(0, 0, w, h);
    if (c.mode === "silhouette") {
      if (c.glow > 0) {
        // A soft halo in the same colour around the silhouette.
        const pad = Math.ceil(c.glow * 2 * s);
        const out = canvas(w + pad * 2, h + pad * 2);
        const o = out.getContext("2d")!;
        const halo = canvas(w + pad * 2, h + pad * 2);
        halo.getContext("2d")!.drawImage(sil, pad, pad);
        o.globalAlpha = 0.85;
        o.drawImage(blurred(halo, c.glow * s), 0, 0);
        o.globalAlpha = 1;
        o.drawImage(sil, pad, pad);
        v = { c: out, pad: pad / s };
      } else v = { c: sil, pad: 0 };
    } else {
      // Outline: the silhouette grown by the line width, minus the silhouette itself.
      const lw = Math.max(1, c.width * s);
      const pad = Math.ceil(lw + c.glow * 2 * s + 2);
      const ring = canvas(w + pad * 2, h + pad * 2);
      const g2 = ring.getContext("2d")!;
      const steps = 16;
      for (let k = 0; k < steps; k++) g2.drawImage(sil, pad + Math.cos((k / steps) * Math.PI * 2) * lw, pad + Math.sin((k / steps) * Math.PI * 2) * lw);
      g2.globalCompositeOperation = "destination-out";
      g2.drawImage(src, pad, pad);
      if (c.glow > 0) {
        const out = canvas(ring.width, ring.height);
        const o = out.getContext("2d")!;
        o.drawImage(blurred(ring, c.glow * s), 0, 0);
        o.globalCompositeOperation = "lighter";
        o.drawImage(blurred(ring, c.glow * s * 0.35), 0, 0);
        o.drawImage(ring, 0, 0);
        v = { c: out, pad: pad / s };
      } else v = { c: ring, pad: pad / s };
    }
  } else {
    const img = canvas(w, h);
    const g = img.getContext("2d")!;
    g.drawImage(src, 0, 0);
    if (c.mono) {
      g.globalCompositeOperation = "saturation";
      g.fillStyle = "#808080";
      g.fillRect(0, 0, w, h);
    }
    if (c.color && c.tint > 0) {
      // The colour's hue and saturation over the copy's own light and shade (detail stays).
      g.globalCompositeOperation = "color";
      g.globalAlpha = Math.min(1, c.tint);
      g.fillStyle = c.color;
      g.fillRect(0, 0, w, h);
      g.globalAlpha = Math.min(1, c.tint) * 0.35;
      g.globalCompositeOperation = "multiply";
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 1;
    }
    if (c.dim > 0) {
      g.globalCompositeOperation = "source-atop";
      g.globalAlpha = Math.min(1, c.dim);
      g.fillStyle = "#000000";
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 1;
    }
    // Blend modes above paint the see-through parts too: keep the picture's own outline.
    g.globalCompositeOperation = "destination-in";
    g.drawImage(src, 0, 0);
    if (c.blur > 0) {
      const pad = Math.ceil(c.blur * 2 * s);
      const p = canvas(w + pad * 2, h + pad * 2);
      p.getContext("2d")!.drawImage(img, pad, pad);
      v = { c: blurred(p, c.blur * s), pad: pad / s };
    } else v = { c: img, pad: 0 };
  }
  m.set(key, v);
  if (m.size > 48) m.delete(m.keys().next().value!);
  return v;
}

/** The echoes for a layer of `w` × `h` flyer px, or null when there's nothing to draw. */
export function paintEcho(src: CanvasImageSource | null | undefined, w: number, h: number, e: EchoInput, scale: number, u = 0, amount = 0): EchoDrawing | null {
  if (!src || w <= 0 || h <= 0) return null;
  const { copies, extra, original } = echoCopies(e, w, h, u, amount);
  if (!copies.length && !extra.ring) return null;
  const b = echoBounds(copies, extra, w, h);
  let sc = scale;
  if (b.w * b.h * sc * sc > MAX_PIXELS) sc = Math.sqrt(MAX_PIXELS / (b.w * b.h));
  const out = canvas(b.w * sc, b.h * sc);
  const g = out.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  const s = sizeOf(src).w / w; // the source picture's pixels per flyer px
  if (extra.ring) {
    const r = extra.ring;
    g.save();
    g.globalAlpha = r.opacity;
    g.strokeStyle = r.color;
    g.shadowColor = r.color;
    g.shadowBlur = r.glow * sc;
    g.lineWidth = Math.max(1, 2.5 * sc);
    g.beginPath();
    g.arc((w / 2 + r.cx - b.x) * sc, (h / 2 + r.cy - b.y) * sc, r.r * sc, 0, Math.PI * 2);
    g.stroke();
    g.stroke();
    g.restore();
  }
  for (const c of copies) {
    if (c.opacity <= 0.003) continue;
    const v = variantOf(src, c, s);
    const W = w + v.pad * 2,
      H = h + v.pad * 2;
    g.save();
    g.globalAlpha = Math.min(1, c.opacity);
    g.translate((w / 2 + c.dx - b.x) * sc, (h / 2 + c.dy - b.y) * sc);
    if (c.rotate) g.rotate((c.rotate * Math.PI) / 180);
    g.scale(c.scale * (c.flipX ? -1 : 1) * sc, c.scale * sc);
    if (c.band) {
      // One strip of the layer, from the same place in the picture.
      const vy = (v.pad + c.band.y0 * h) * s,
        vh = (c.band.y1 - c.band.y0) * h * s;
      g.drawImage(v.c, 0, vy, v.c.width, vh, -W / 2, -H / 2 + v.pad + c.band.y0 * h, W, (c.band.y1 - c.band.y0) * h);
    } else g.drawImage(v.c, -W / 2, -H / 2, W, H);
    g.restore();
  }
  return { canvas: out, x: b.x, y: b.y, w: b.w, h: b.h, original };
}
