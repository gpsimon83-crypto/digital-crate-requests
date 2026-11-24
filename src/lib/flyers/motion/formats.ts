import { FORMATS, type FormatKey, type Scene } from "../types";

/**
 * Other sizes of the same animated flyer (Story 1080×1920, Portrait
 * 1080×1350, Square 1080×1080). The artwork is never stretched: the whole
 * flyer is scaled evenly to fit inside the new size (with the flyer's
 * background colour around it) or to fill it (cropping the edges), and can
 * be moved and zoomed within it. The original layout is not changed.
 */
export type FormatFraming = { mode: "fit" | "crop"; x: number; y: number; zoom: number };
export type Framing = { width: number; height: number; scale: number; ox: number; oy: number };

/** Fit by default: nothing is cut off (Fill is one click away). */
export const DEFAULT_FRAMING: FormatFraming = { mode: "fit", x: 0, y: 0, zoom: 1 };

export function framingFor(scene: Pick<Scene, "width" | "height">, target: FormatKey, f: FormatFraming = DEFAULT_FRAMING): Framing {
  const W = FORMATS[target].width;
  const H = FORMATS[target].height;
  if (scene.width === W && scene.height === H && f.zoom === 1 && !f.x && !f.y) return { width: W, height: H, scale: 1, ox: 0, oy: 0 };
  const sx = W / scene.width;
  const sy = H / scene.height;
  const base = f.mode === "fit" ? Math.min(sx, sy) : Math.max(sx, sy);
  const scale = base * Math.min(3, Math.max(1, f.zoom || 1));
  const free = (size: number, inner: number, p: number) => ((size - inner) * (1 + Math.min(1, Math.max(-1, p)))) / 2;
  return { width: W, height: H, scale, ox: free(W, scene.width * scale, f.x), oy: free(H, scene.height * scale, f.y) };
}

/**
 * Where apps put their own buttons and captions over a video, in output
 * pixels (top, bottom, sides). Story: Instagram / TikTok's top bar and the
 * caption and reply area at the bottom. Posts: a small margin.
 */
export function safeArea(target: FormatKey) {
  if (target === "story") return { top: 250, bottom: 340, left: 64, right: 64 };
  const m = Math.round(FORMATS[target].width * 0.05);
  return { top: m, bottom: m, left: m, right: m };
}

/** Layers (by name) whose box isn't fully inside the apps' safe area in this size: shown as a warning. */
export function cutOff(scene: Pick<Scene, "width" | "height" | "nodes">, target: FormatKey, f: FormatFraming, important: (n: Scene["nodes"][number]) => boolean) {
  const fr = framingFor(scene, target, f);
  const sa = safeArea(target);
  return scene.nodes
    .filter((n) => n.visible && important(n))
    .filter((n) => {
      const x0 = fr.ox + n.x * fr.scale;
      const y0 = fr.oy + n.y * fr.scale;
      const x1 = x0 + n.width * fr.scale;
      const y1 = y0 + n.height * fr.scale;
      return x0 < sa.left - 1 || y0 < sa.top - 1 || x1 > fr.width - sa.right + 1 || y1 > fr.height - sa.bottom + 1;
    })
    .map((n) => n.name);
}
