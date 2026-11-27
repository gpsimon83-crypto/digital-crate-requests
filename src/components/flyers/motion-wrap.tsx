"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import KonvaLib from "konva";
import { Group, Shape as KShape } from "react-konva";
import type Konva from "konva";
import type { FlyerNode } from "@/lib/flyers/types";
import type { MotionState, OverlayBlend, OverlayDraw } from "@/lib/flyers/motion/types";
import { RASTER_IMAGES, applyRaster, rasterPad, type RasterOp } from "@/lib/flyers/motion/raster";
import { DOUBLE_IMAGES } from "@/lib/flyers/motion/presets";

/**
 * Applies one layer's motion around the layer exactly as it's normally
 * drawn: offsets, scale and turn about the layer's centre, opacity, a
 * crop-safe move of the picture inside its own frame, and light /
 * vignette / particles drawn over it inside its box. The layer itself
 * (photo effects, masks, text) is untouched.
 */

const OP: Record<OverlayBlend, GlobalCompositeOperation> = { normal: "source-over", screen: "screen", overlay: "overlay", "soft-light": "soft-light", multiply: "multiply" };

function rgba(hex: string, a: number) {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? "ffffff";
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

function mix(a: string, b: string, k: number) {
  const pa = parseInt(/^#?([0-9a-f]{6})$/i.exec(a)?.[1] ?? "ffffff", 16);
  const pb = parseInt(/^#?([0-9a-f]{6})$/i.exec(b)?.[1] ?? "ffffff", 16);
  const ch = (n: number, sh: number) => Math.round(((n >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return "#" + [ch(pa, 16), ch(pa, 8), ch(pa, 0)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** The layer's box corners (rotated as the layer is), for clipping in its parent's coordinates. */
function corners(n: FlyerNode): [number, number][] {
  const r = ((n.rotation ?? 0) * Math.PI) / 180;
  const centre = n.kind === "text" && n.pivot === "center";
  const [px, py] = centre ? [n.x + n.width / 2, n.y + n.height / 2] : [n.x, n.y];
  return [
    [n.x, n.y],
    [n.x + n.width, n.y],
    [n.x + n.width, n.y + n.height],
    [n.x, n.y + n.height]
  ].map(([x, y]) => [px + (x - px) * Math.cos(r) - (y - py) * Math.sin(r), py + (x - px) * Math.sin(r) + (y - py) * Math.cos(r)] as [number, number]);
}

function drawOverlay(c: CanvasRenderingContext2D, o: OverlayDraw, w: number, h: number) {
  if (o.kind === "vignette") {
    const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.55);
    g.addColorStop(0, rgba(o.color, 0));
    g.addColorStop(1, rgba(o.color, o.alpha));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  } else if (o.kind === "sweep") {
    if (o.alpha <= 0) return;
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate((o.angle * Math.PI) / 180);
    const span = Math.hypot(w, h);
    const x = (o.pos - 0.5) * span;
    const bw = o.width * span;
    const g = c.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0);
    g.addColorStop(0, rgba(o.color, 0));
    g.addColorStop(0.5, rgba(o.color, o.alpha));
    g.addColorStop(1, rgba(o.color, 0));
    c.fillStyle = g;
    c.fillRect(-span, -span, span * 2, span * 2);
    c.restore();
  } else if (o.kind === "leak") {
    if (o.alpha <= 0) return;
    const cx = o.cx * w, cy = o.cy * h, r = o.radius * Math.max(w, h);
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgba(o.color, o.alpha));
    g.addColorStop(0.5, rgba(o.color, o.alpha * 0.35));
    g.addColorStop(1, rgba(o.color, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  } else if (o.kind === "burn") {
    if (o.alpha <= 0) return;
    // The hot spot sits just outside the chosen edge / corner and blooms inward.
    const pos: Record<typeof o.origin, [number, number]> = {
      left: [-0.08, 0.5], right: [1.08, 0.5], top: [0.5, -0.08], bottom: [0.5, 1.08],
      "top-left": [-0.05, -0.05], "top-right": [1.05, -0.05], "bottom-left": [-0.05, 1.05], "bottom-right": [1.05, 1.05]
    };
    const [ux, uy] = pos[o.origin];
    const cx = ux * w + o.wobble * w * 0.02;
    const cy = uy * h - o.wobble * h * 0.015;
    const r = Math.max(1, o.spread * Math.hypot(w, h));
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    const a = Math.min(1, o.alpha);
    const ex = Math.min(1, o.exposure);
    g.addColorStop(0, `rgba(255,250,236,${a * ex})`);
    g.addColorStop(0.22, rgba(mix(o.tint, "#fff3d6", 0.45), a * (0.55 + 0.4 * ex)));
    g.addColorStop(0.5, rgba(o.tint, a * 0.6));
    g.addColorStop(0.78, rgba(mix(o.tint, "#7a0a03", 0.6), a * 0.28));
    g.addColorStop(1, rgba(o.tint, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  } else {
    for (const p of o.items) {
      if (p.a <= 0.003) continue;
      if (o.style === "dust") {
        c.fillStyle = rgba(o.color, p.a);
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fill();
      } else {
        // A soft four-point glint with a small glow.
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, rgba(o.color, p.a));
        g.addColorStop(1, rgba(o.color, 0));
        c.fillStyle = g;
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = rgba(o.color, p.a);
        for (const [sx, sy] of [[1, 0.12], [0.12, 1]]) {
          c.beginPath();
          c.ellipse(p.x, p.y, p.r * 1.6 * sx, p.r * 1.6 * sy, 0, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  }
}

/** Konva filter: this frame's pixel ops on the layer's cached pixels (see raster.ts). */
function rasterFilter(this: Konva.Node, img: ImageData) {
  const ops = this.getAttr("rasterOps") as RasterOp[] | undefined;
  if (ops?.length) applyRaster(img, ops, (this.getAttr("rasterPx") as number) || 1, (this.getAttr("rasterOrigin") as { x: number; y: number }) ?? { x: 0, y: 0 });
}

/**
 * Draws its children into a cached bitmap (at the preview's or the export's
 * resolution), runs the frame's pixel ops on it, and draws that in their
 * place. Re-cached on every frame and whenever the layer changes. While a
 * layer is being dragged or resized the cache is dropped so it follows the
 * pointer live.
 */
function RasterGroup({ ops, px, children }: { ops: RasterOp[]; px: number; children: React.ReactNode }) {
  const ref = useRef<Konva.Group>(null);
  const recache = () => {
    const g = ref.current;
    if (!g || g.getAttr("rasterHold")) return;
    try {
      g.clearCache();
      // Where the cached pixels start on the flyer (for effects tied to the layer's frame).
      const pad = rasterPad(ops);
      const r = g.getClientRect({ skipTransform: true });
      g.setAttrs({ rasterOps: ops, rasterPx: px, rasterOrigin: { x: r.x - pad, y: r.y - pad } });
      g.cache({ pixelRatio: px, offset: pad });
      g.filters([rasterFilter]);
    } catch {
      // nothing drawn yet (zero size): draw the layer plainly
      g.clearCache();
    }
    g.getLayer()?.batchDraw();
  };
  useLayoutEffect(recache);
  // Pictures and fonts that finish loading after this frame: draw them in too.
  useEffect(() => {
    const h = setTimeout(recache, 350);
    return () => clearTimeout(h);
  });
  useEffect(() => {
    const g = ref.current;
    return () => {
      g?.clearCache();
    };
  }, []);
  const hold = () => {
    const g = ref.current;
    if (!g) return;
    g.setAttr("rasterHold", true);
    g.clearCache();
  };
  const release = () => {
    ref.current?.setAttr("rasterHold", false);
    recache();
  };
  return (
    <Group ref={ref} onDragStart={hold} onTransformStart={hold} onDragEnd={release} onTransformEnd={release}>
      {children}
    </Group>
  );
}

export function MotionWrap({ node, st, px = 1, children }: { node: FlyerNode; st: MotionState; px?: number; children: React.ReactNode }) {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const inner = st.inner;
  const body = inner ? (
    <Group
      clipFunc={(kctx: Konva.Context) => {
        const pts = corners(node);
        kctx.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts.slice(1)) kctx.lineTo(p[0], p[1]);
        kctx.closePath();
      }}
    >
      <Group x={cx + inner.dx} y={cy + inner.dy} offsetX={cx} offsetY={cy} scaleX={inner.scale} scaleY={inner.scale}>
        {children}
      </Group>
    </Group>
  ) : (
    children
  );
  const centre = node.kind === "text" && node.pivot === "center";
  return (
    <Group x={cx + st.dx} y={cy + st.dy} offsetX={cx} offsetY={cy} scaleX={st.scale} scaleY={st.scale} rotation={st.rotate} opacity={st.opacity}>
      {st.raster.length ? (
        <RasterGroup ops={st.raster} px={px}>
          {body}
        </RasterGroup>
      ) : (
        body
      )}
      {st.overlays.length > 0 && (
        <Group
          x={centre ? cx : node.x}
          y={centre ? cy : node.y}
          offsetX={centre ? node.width / 2 : 0}
          offsetY={centre ? node.height / 2 : 0}
          rotation={node.rotation}
          clip={{ x: 0, y: 0, width: node.width, height: node.height }}
          opacity={node.opacity}
          listening={false}
        >
          {st.overlays.map((o, i) => (
            <KShape
              key={i}
              listening={false}
              globalCompositeOperation={OP[o.blend]}
              sceneFunc={(kctx) => {
                const c = (kctx as unknown as { _context: CanvasRenderingContext2D })._context;
                c.save();
                drawOverlay(c, o, node.width, node.height);
                c.restore();
              }}
            />
          ))}
        </Group>
      )}
    </Group>
  );
}

/* ---------------- occlusion reveal ---------------- */

/**
 * Occlusion reveal: draws the layer, then cuts it away wherever the occluding
 * layer (a DJ cutout, drawn again here exactly as it is on the flyer, with
 * its own motion) has pixels, so the layer looks like it's behind the
 * portrait whatever its place in the layer order. Cached per frame, so the
 * cut only affects this layer. `soft` blurs the cut edge (flyer px).
 */
export function OccludeGroup({ soft, px, children, occluder }: { soft: number; px: number; children: React.ReactNode; occluder: React.ReactNode }) {
  const ref = useRef<Konva.Group>(null);
  const cut = useRef<Konva.Group>(null);
  const recache = () => {
    const g = ref.current;
    const c = cut.current;
    if (!g || !c || g.getAttr("rasterHold")) return;
    try {
      g.clearCache();
      c.clearCache();
      if (soft > 0) {
        c.cache({ pixelRatio: px, offset: Math.ceil(soft * 2) });
        c.filters([KonvaLib.Filters.Blur]);
        c.blurRadius(Math.max(1, soft * px));
      }
      g.cache({ pixelRatio: px, offset: 4 });
    } catch {
      g.clearCache();
    }
    g.getLayer()?.batchDraw();
  };
  useLayoutEffect(recache);
  useEffect(() => {
    const h = setTimeout(recache, 350);
    return () => clearTimeout(h);
  });
  const hold = () => {
    ref.current?.setAttr("rasterHold", true);
    ref.current?.clearCache();
  };
  const release = () => {
    ref.current?.setAttr("rasterHold", false);
    recache();
  };
  return (
    <Group ref={ref} onDragStart={hold} onTransformStart={hold} onDragEnd={release} onTransformEnd={release}>
      {children}
      <Group ref={cut} listening={false} globalCompositeOperation="destination-out">
        {occluder}
      </Group>
    </Group>
  );
}

/* ---------------- second pictures (double exposure) ---------------- */

const ALLOWED_SECOND = new Set(DOUBLE_IMAGES.map((d) => d.value));
const loading = new Map<string, Promise<void>>();

/** Decodes an app-owned picture into pixels for double exposure (at most 1600 px on its long side). */
export function loadRasterImage(src: string): Promise<void> {
  if (!ALLOWED_SECOND.has(src)) return Promise.resolve(); // only the app's own pictures, never a URL from project data
  if (RASTER_IMAGES.has(src)) return Promise.resolve();
  const have = loading.get(src);
  if (have) return have;
  const p = new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k));
      const h = Math.max(1, Math.round(img.naturalHeight * k));
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const c = cv.getContext("2d", { willReadFrequently: true })!;
      c.drawImage(img, 0, 0, w, h);
      RASTER_IMAGES.set(src, { data: c.getImageData(0, 0, w, h).data, width: w, height: h });
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
  loading.set(src, p);
  return p;
}

/** The second pictures this frame's motion needs. */
export function rasterImagesIn(motion: Map<string, MotionState> | null | undefined) {
  const out = new Set<string>();
  for (const st of motion?.values() ?? []) for (const r of st.raster) if (r.kind === "double") out.add(r.src);
  return [...out];
}

/** Loads the second pictures in use, and redraws once they're in. */
export function useRasterImages(motion: Map<string, MotionState> | null | undefined) {
  const [, setN] = useState(0);
  const key = rasterImagesIn(motion).join("|");
  useEffect(() => {
    let live = true;
    const missing = key ? key.split("|").filter((s) => !RASTER_IMAGES.has(s)) : [];
    if (missing.length) void Promise.all(missing.map(loadRasterImage)).then(() => live && setN((x) => x + 1));
    return () => {
      live = false;
    };
  }, [key]);
}
