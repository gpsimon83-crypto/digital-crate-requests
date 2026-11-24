"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { Group, Shape as KShape } from "react-konva";
import type Konva from "konva";
import type { FlyerNode } from "@/lib/flyers/types";
import type { MotionState, OverlayBlend, OverlayDraw } from "@/lib/flyers/motion/types";
import { applyRaster, rasterPad, type RasterOp } from "@/lib/flyers/motion/raster";

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
  if (ops?.length) applyRaster(img, ops, (this.getAttr("rasterPx") as number) || 1);
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
    g.setAttrs({ rasterOps: ops, rasterPx: px });
    try {
      g.clearCache();
      g.cache({ pixelRatio: px, offset: rasterPad(ops) });
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
