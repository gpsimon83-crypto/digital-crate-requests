"use client";

import { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { Circle, Group, Layer, Line, Rect } from "react-konva";
import { imageLayout } from "@/lib/flyers/scene";
import { addPoint, frameToUV, uvToFrame, type Lay, type MaskFade, type MaskStroke } from "@/lib/flyers/mask";
import type { ImageNode } from "@/lib/flyers/types";
import { srcFor, useImage, type SrcContext } from "./loaders";

export type MaskTool = "hide" | "restore" | "fade";
export type MaskEdit = {
  node: ImageNode;
  tool: MaskTool;
  /** Brush size in flyer pixels (so it follows the layer's size), hardness and opacity 0–1. */
  brush: { size: number; hardness: number; opacity: number };
  fadeType: "linear" | "radial";
  fade: MaskFade | null;
  /** A stroke in progress ("move"), finished ("end"), or dropped (a second finger arrived: "cancel"). */
  onStroke: (s: MaskStroke | null, phase: "move" | "end" | "cancel") => void;
  onFade: (f: MaskFade, phase: "move" | "end") => void;
};

/**
 * Mask editing on the canvas: brush and fade handles drawn in the picture
 * layer's own frame (so they turn and scale with it). Pointer input comes
 * straight from the canvas element (mouse, touch and pen alike); a second
 * finger drops the stroke so pinch zoom keeps working.
 */
export function MaskTools({ stageRef, edit, ctx, zoom }: { stageRef: React.RefObject<Konva.Stage | null>; edit: MaskEdit; ctx: SrcContext; zoom: number }) {
  const { node } = edit;
  const { img } = useImage(srcFor(node.source, ctx));
  const lay: Lay | null = img ? imageLayout(node, { width: img.naturalWidth, height: img.naturalHeight }, node.fit, node.crop) : null;
  const groupRef = useRef<Konva.Group>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number; show: boolean } | null>(null);
  // Latest props for the native listeners (bound once).
  const live = useRef({ edit, lay });
  const zoomRef = useRef(zoom);
  useEffect(() => {
    live.current = { edit, lay };
    zoomRef.current = zoom;
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const el = stage.container();
    const pointers = new Set<number>();
    let stroke: MaskStroke | null = null;
    let drag: null | { kind: "a" | "b" | "new"; start: [number, number]; moved: boolean } = null;
    let fade: MaskFade | null = null;
    let raf = 0;
    let pending: (() => void) | null = null;
    const frame = (fn: () => void) => {
      pending = fn;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          const f = pending;
          pending = null;
          f?.();
        });
    };
    const flush = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      pending = null;
    };
    const local = (e: PointerEvent) => {
      stage.setPointersPositions(e);
      const p = stage.getPointerPosition();
      const g = groupRef.current;
      if (!p || !g) return null;
      return g.getAbsoluteTransform().copy().invert().point(p);
    };
    const uv = (p: { x: number; y: number }, lay: Lay) => frameToUV(p, lay, live.current.edit.node.flipX, live.current.edit.node.flipY);

    const down = (e: PointerEvent) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1) {
        // Two fingers: pinch zoom, not painting.
        if (stroke) live.current.edit.onStroke(null, "cancel");
        stroke = null;
        drag = null;
        flush();
        return;
      }
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const { edit: ed, lay } = live.current;
      const p = local(e);
      if (!p || !lay) return;
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* not all pointers can be captured */
      }
      const [u, v] = uv(p, lay);
      if (ed.tool === "fade") {
        // Grab a handle if one is under the pointer, else draw a new fade from here.
        const hit = (pt: [number, number]) => {
          const f = uvToFrame(pt[0], pt[1], lay, ed.node.flipX, ed.node.flipY);
          return Math.hypot(f.x - p.x, f.y - p.y) <= (e.pointerType === "touch" ? 26 : 14) / zoomRef.current;
        };
        if (ed.fade && hit(ed.fade.b)) drag = { kind: "b", start: [u, v], moved: false };
        else if (ed.fade && hit(ed.fade.a)) drag = { kind: "a", start: [u, v], moved: false };
        else drag = { kind: "new", start: [u, v], moved: false };
        fade = ed.fade;
        return;
      }
      const size = ed.brush.size / Math.max(1, lay.width);
      stroke = { mode: ed.tool, size, hardness: ed.brush.hardness, opacity: ed.brush.opacity, points: [Math.round(u * 1e4) / 1e4, Math.round(v * 1e4) / 1e4] };
      setCursor({ x: p.x, y: p.y, show: true });
      const s = stroke;
      frame(() => live.current.edit.onStroke(s, "move"));
    };
    const move = (e: PointerEvent) => {
      const { edit: ed, lay } = live.current;
      const p = local(e);
      if (!p || !lay) return;
      if (e.pointerType !== "touch" || stroke) setCursor({ x: p.x, y: p.y, show: ed.tool !== "fade" });
      if (pointers.size > 1) return;
      const [u, v] = uv(p, lay);
      if (stroke) {
        e.preventDefault();
        // Every point a fast pen reported since the last event, so quick strokes stay smooth.
        const evs = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
        let pts = stroke.points;
        for (const ce of evs.length ? evs : [e]) {
          const cp = ce === e ? p : local(ce);
          if (!cp) continue;
          const [cu, cv] = uv(cp, lay);
          pts = addPoint(pts, cu, cv, stroke.size);
        }
        if (pts !== stroke.points) {
          stroke = { ...stroke, points: pts };
          const s = stroke;
          frame(() => live.current.edit.onStroke(s, "move"));
        }
      } else if (drag) {
        e.preventDefault();
        const pt: [number, number] = [Math.round(u * 1e4) / 1e4, Math.round(v * 1e4) / 1e4];
        const next: MaskFade =
          drag.kind !== "new" && fade ? (drag.kind === "a" ? { ...fade, a: pt } : { ...fade, b: pt }) : { type: ed.fadeType, a: drag.start, b: pt, reverse: fade?.reverse ?? false };
        if (Math.hypot(next.b[0] - next.a[0], next.b[1] - next.a[1]) < 0.002) return;
        fade = next;
        drag.moved = true;
        frame(() => live.current.edit.onFade(next, "move"));
      }
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (e.pointerType === "touch") setCursor(null);
      if (stroke) {
        const s = stroke;
        stroke = null;
        flush();
        live.current.edit.onStroke(s, "end");
      } else if (drag) {
        const moved = drag.moved;
        drag = null;
        flush();
        if (moved && fade) live.current.edit.onFade(fade, "end");
      }
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && !stroke) setCursor(null);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", leave);
    return () => {
      flush();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerleave", leave);
    };
  }, [stageRef]);

  const px = 1 / zoom;
  const f = edit.fade && lay ? { a: uvToFrame(edit.fade.a[0], edit.fade.a[1], lay, node.flipX, node.flipY), b: uvToFrame(edit.fade.b[0], edit.fade.b[1], lay, node.flipX, node.flipY) } : null;
  return (
    <Layer listening={false}>
      <Group ref={groupRef} x={node.x} y={node.y} rotation={node.rotation}>
        {/* The layer being masked. */}
        <Rect width={node.width} height={node.height} stroke="#e5b647" strokeWidth={1.5 * px} dash={[8 * px, 6 * px]} />
        {edit.tool !== "fade" && cursor?.show && (
          <>
            <Circle x={cursor.x} y={cursor.y} radius={Math.max(1, edit.brush.size / 2)} stroke="rgba(0,0,0,0.7)" strokeWidth={2.5 * px} />
            <Circle x={cursor.x} y={cursor.y} radius={Math.max(1, edit.brush.size / 2)} stroke={edit.tool === "hide" ? "#ff4fa3" : "#7CFFB2"} strokeWidth={1.25 * px} />
            {edit.brush.hardness < 0.95 && (
              <Circle x={cursor.x} y={cursor.y} radius={Math.max(0.5, (edit.brush.size / 2) * Math.max(0.05, edit.brush.hardness))} stroke="rgba(255,255,255,0.7)" strokeWidth={1 * px} dash={[3 * px, 3 * px]} />
            )}
          </>
        )}
        {edit.tool === "fade" && f && (
          <>
            {edit.fade?.type === "radial" ? (
              <Circle x={f.a.x} y={f.a.y} radius={Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y)} stroke="#ffffff" strokeWidth={1.5 * px} dash={[6 * px, 5 * px]} shadowColor="#000" shadowBlur={3 * px} shadowOpacity={0.6} />
            ) : null}
            <Line points={[f.a.x, f.a.y, f.b.x, f.b.y]} stroke="#ffffff" strokeWidth={2 * px} shadowColor="#000" shadowBlur={3 * px} shadowOpacity={0.6} />
            {/* a = fully shown (solid), b = fully hidden (hollow). */}
            <Circle x={f.a.x} y={f.a.y} radius={9 * px} fill="#ffffff" stroke="#1a140b" strokeWidth={2 * px} />
            <Circle x={f.b.x} y={f.b.y} radius={9 * px} fill="rgba(26,20,11,0.55)" stroke="#ffffff" strokeWidth={2 * px} />
          </>
        )}
      </Group>
    </Layer>
  );
}
