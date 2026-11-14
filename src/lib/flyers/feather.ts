/**
 * Feathered (soft-edged) pictures. The picture is drawn into its frame, then
 * faded with a gradient mask: a soft rectangle (left/right ramp × top/bottom
 * ramp) or an oval (radial fade). Gradients only, so every browser draws it
 * the same way in the editor and in exports. The original image isn't changed.
 */
export type Sides = { top: number; right: number; bottom: number; left: number };
export type Feather = { amount: number; shape: "edges" | "oval"; sides?: Sides | null; curve?: "smooth" | "linear" };

/** Fade width for each side (soft rectangle), never more than the picture can hold. */
export function featherSides(f: Feather, w: number, h: number): Sides {
  const s = f.sides ?? { top: f.amount, right: f.amount, bottom: f.amount, left: f.amount };
  const fit = (a: number, b: number, len: number) => (a + b > len && a + b > 0 ? [(a * len) / (a + b), (b * len) / (a + b)] : [a, b]);
  const [left, right] = fit(Math.max(0, s.left), Math.max(0, s.right), w);
  const [top, bottom] = fit(Math.max(0, s.top), Math.max(0, s.bottom), h);
  return { top, right, bottom, left };
}

/** Is any fade actually on? */
export function featherOn(f: Feather | undefined): boolean {
  if (!f) return false;
  if (f.shape === "oval" || !f.sides) return f.amount > 0;
  return f.sides.top > 0 || f.sides.right > 0 || f.sides.bottom > 0 || f.sides.left > 0;
}

// Eased fade (smoothstep) so the edge doesn't show a visible band.
const SMOOTH: [number, number][] = [
  [0, 0],
  [0.15, 0.06],
  [0.3, 0.22],
  [0.5, 0.5],
  [0.7, 0.78],
  [0.85, 0.94],
  [1, 1]
];

export function featherMask(w: number, h: number, f: Feather): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d")!;
  const a = Math.max(0, Math.min(f.amount, Math.min(c.width, c.height) / 2));
  if (f.shape === "oval") {
    // Radial fade stretched to the frame: solid in the middle, clear at the oval's edge.
    const r = Math.max(c.width, c.height) / 2;
    const inner = Math.max(0, 1 - (2 * a) / Math.min(c.width, c.height));
    ctx.save();
    ctx.translate(c.width / 2, c.height / 2);
    ctx.scale(c.width / (2 * r), c.height / (2 * r));
    const g = ctx.createRadialGradient(0, 0, r * inner, 0, 0, r);
    for (const [t, v] of f.curve === "linear" ? ([[0, 0], [1, 1]] as [number, number][]) : SMOOTH) g.addColorStop(1 - t, `rgba(0,0,0,${v})`);
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.restore();
    return c;
  }
  // Soft rectangle: a left→right ramp times a top→bottom ramp, each side with its own width.
  const sides = featherSides(f, c.width, c.height);
  const curve = f.curve === "linear" ? [[0, 0] as [number, number], [1, 1] as [number, number]] : SMOOTH;
  const ramp = (horizontal: boolean) => {
    const len = horizontal ? c.width : c.height;
    const a = (horizontal ? sides.left : sides.top) / len;
    const b = (horizontal ? sides.right : sides.bottom) / len;
    const g = horizontal ? ctx.createLinearGradient(0, 0, len, 0) : ctx.createLinearGradient(0, 0, 0, len);
    if (a > 0) for (const [t, v] of curve) g.addColorStop(Math.min(1, t * a), `rgba(0,0,0,${v})`);
    else g.addColorStop(0, "rgba(0,0,0,1)");
    if (b > 0) for (const [t, v] of [...curve].reverse()) g.addColorStop(Math.max(0, Math.min(1, 1 - t * b)), `rgba(0,0,0,${v})`);
    else g.addColorStop(1, "rgba(0,0,0,1)");
    return g;
  };
  ctx.fillStyle = ramp(true);
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = ramp(false);
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

export type Recolor = { mode: "none" | "solid" | "tint"; color: string; knockoutWhite: boolean };

/** True when the picture needs drawing through processedImage (feather or recolor). */
export const needsProcessing = (f: Feather | undefined, c: Recolor | undefined) => featherOn(f) || (!!c && (c.mode !== "none" || c.knockoutWhite));

/**
 * The picture as it sits in its frame (crop, zoom, flip), with optional
 * white-background removal, recolor and feathered edges. The original
 * uploaded file is never changed.
 */
export function processedImage(
  img: HTMLImageElement,
  frame: { width: number; height: number },
  lay: { x: number; y: number; width: number; height: number },
  flipX: boolean,
  flipY: boolean,
  f: Feather,
  rc: Recolor = { mode: "none", color: "#ffffff", knockoutWhite: false }
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(frame.width));
  c.height = Math.max(1, Math.round(frame.height));
  const ctx = c.getContext("2d", { willReadFrequently: rc.knockoutWhite })!;
  ctx.save();
  ctx.translate(flipX ? lay.x + lay.width : lay.x, flipY ? lay.y + lay.height : lay.y);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(img, 0, 0, lay.width, lay.height);
  ctx.restore();

  if (rc.knockoutWhite) {
    // Near-white becomes see-through, with a soft ramp so edges stay smooth.
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      const min = Math.min(px[i], px[i + 1], px[i + 2]);
      if (min > 200) px[i + 3] = Math.round(px[i + 3] * Math.max(0, (245 - min) / 45));
    }
    ctx.putImageData(d, 0, 0);
  }
  if (rc.mode === "solid") {
    // One color, same shape: keeps transparency exactly.
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = rc.color;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "source-over";
  } else if (rc.mode === "tint") {
    // Color it, keep light and shade: grayscale, then the color multiplied in, then the original lightness back on top.
    const shape = document.createElement("canvas");
    shape.width = c.width;
    shape.height = c.height;
    shape.getContext("2d")!.drawImage(c, 0, 0);
    ctx.globalCompositeOperation = "color";
    ctx.fillStyle = rc.color;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(shape, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }
  if (featherOn(f)) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(featherMask(c.width, c.height, f), 0, 0);
  }
  return c;
}

/** Kept for existing callers. */
export const featheredImage = (img: HTMLImageElement, frame: { width: number; height: number }, lay: { x: number; y: number; width: number; height: number }, flipX: boolean, flipY: boolean, f: Feather) =>
  processedImage(img, frame, lay, flipX, flipY, f);
