"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import KonvaLib from "konva";
import type Konva from "konva";
import { Group, Image as KImage, Layer, Line, Rect, Stage, Text as KText, Transformer } from "react-konva";
import { imageLayout } from "@/lib/flyers/scene";
import { boundsOf, snapBox, type Guide } from "@/lib/flyers/snap";
import { needsProcessing, processedImage } from "@/lib/flyers/feather";
import { shownByData } from "@/lib/flyers/links";
import type { FlyerNode, ImageNode, Scene, TextNode } from "@/lib/flyers/types";
import { fontString, loadSceneFonts, loadSceneImages, slotDjId, srcFor, useImage, type SrcContext } from "./loaders";

export type NodePatch = { id: string; patch: Partial<FlyerNode> };

type Interact = {
  interactive: boolean;
  canMove: (n: FlyerNode) => boolean;
  onSelect: (id: string, additive: boolean) => void;
  onEditText?: (id: string) => void;
};

/** Canvas name for a blend mode ("normal" is the canvas default, source-over). */
const blendOp = (b: string | undefined): GlobalCompositeOperation => (!b || b === "normal" ? "source-over" : (b as GlobalCompositeOperation));

function roundedClip(w: number, h: number, r: number) {
  return (ctx: Konva.Context) => {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(rr, 0);
    ctx.lineTo(w - rr, 0);
    ctx.arcTo(w, 0, w, rr, rr);
    ctx.lineTo(w, h - rr);
    ctx.arcTo(w, h, w - rr, h, rr);
    ctx.lineTo(rr, h);
    ctx.arcTo(0, h, 0, h - rr, rr);
    ctx.lineTo(0, rr);
    ctx.arcTo(0, 0, rr, 0, rr);
    ctx.closePath();
  };
}

const shadowProps = (s: { enabled: boolean; color: string; blur: number; offsetX: number; offsetY: number; opacity: number }) =>
  s.enabled ? { shadowEnabled: true, shadowColor: s.color, shadowBlur: s.blur, shadowOffsetX: s.offsetX, shadowOffsetY: s.offsetY, shadowOpacity: s.opacity } : { shadowEnabled: false };

function ImageLayer({ node, ctx, exporting, act, onStatus }: { node: ImageNode; ctx: SrcContext; exporting: boolean; act: Interact | null; onStatus?: (id: string, done: boolean) => void }) {
  const url = srcFor(node.source, ctx);
  const { img, status } = useImage(url);
  useEffect(() => {
    onStatus?.(node.id, status !== "loading");
  }, [node.id, status, onStatus]);
  const lay = img ? imageLayout(node, { width: img.naturalWidth, height: img.naturalHeight }, node.fit, node.crop) : null;
  const r = Math.min(node.frame.radius, node.width / 2, node.height / 2);
  const feather = node.feather ?? { amount: 0, shape: "edges" as const };
  const recolor = node.recolor ?? { mode: "none" as const, color: "#ffffff", knockoutWhite: false };
  const soft = useMemo(
    () => (img && lay && needsProcessing(feather, recolor) ? processedImage(img, node, lay, node.flipX, node.flipY, feather, recolor) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [img, lay?.x, lay?.y, lay?.width, lay?.height, node.width, node.height, node.flipX, node.flipY, feather.amount, feather.shape, feather.curve, feather.sides?.top, feather.sides?.right, feather.sides?.bottom, feather.sides?.left, recolor.mode, recolor.color, recolor.knockoutWhite]
  );
  const movable = !!act && act.interactive && !node.locked && act.canMove(node);
  const label = node.source.type === "dj_photo" ? "DJ photo" : node.source.type === "dj_logo" ? "DJ name logo" : node.source.type === "venue_logo" ? "Venue logo" : "Image";
  return (
    <Group
      id={node.id}
      name="flyer-node"
      x={node.x}
      y={node.y}
      rotation={node.rotation}
      opacity={node.opacity}
      globalCompositeOperation={blendOp(node.blend)}
      draggable={movable}
      listening={!!act?.interactive && !node.locked}
      onMouseDown={(e) => act?.onSelect(node.id, e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey)}
      onTap={() => act?.onSelect(node.id, false)}
    >
      {/* Full-size hit area so empty or transparent frames are still easy to grab. */}
      <Rect width={node.width} height={node.height} fill="rgba(0,0,0,0)" />
      <Group clipFunc={roundedClip(node.width, node.height, r)} listening={false}>
        {soft ? (
          <KImage image={soft} x={0} y={0} width={node.width} height={node.height} {...(node.frame.enabled && node.frame.width > 0 ? { shadowEnabled: false } : shadowProps(node.shadow))} />
        ) : img && lay && (
          <KImage
            image={img}
            x={node.flipX ? lay.x + lay.width : lay.x}
            y={node.flipY ? lay.y + lay.height : lay.y}
            width={lay.width}
            height={lay.height}
            scaleX={node.flipX ? -1 : 1}
            scaleY={node.flipY ? -1 : 1}
            {...(node.frame.enabled && node.frame.width > 0 ? { shadowEnabled: false } : shadowProps(node.shadow))}
          />
        )}
      </Group>
      {!img && status !== "loading" && node.source.type === "dj_logo" && slotDjId(node.source, ctx) && (
        // No name logo uploaded/approved: the DJ's display name as styled text (this is real content, so it exports).
        <NameFallback node={node} name={ctx.djNames?.[slotDjId(node.source, ctx)!] ?? "DJ NAME"} />
      )}
      {!img && !exporting && !(node.source.type === "dj_logo" && status !== "loading" && slotDjId(node.source, ctx)) && (
        <>
          <Rect width={node.width} height={node.height} cornerRadius={r} fill="rgba(255,255,255,0.06)" stroke="rgba(229,182,71,0.85)" strokeWidth={3} dash={[14, 10]} listening={false} />
          <KText
            width={node.width}
            height={node.height}
            align="center"
            verticalAlign="middle"
            text={
              status === "loading"
                ? "Loading…"
                : node.source.type === "dj_photo"
                  ? node.source.djId || ctx.previewDjId
                    ? "⚠ No photo for this DJ"
                    : `DJ ${node.source.slot ?? 1} photo — no DJ assigned`
                  : node.source.type === "dj_logo"
                    ? `DJ ${node.source.slot ?? 1} name logo — no DJ assigned`
                    : node.source.type === "venue_logo"
                      ? node.source.venueId
                        ? "This venue has no logo"
                        : "Venue logo (no venue linked)"
                      : `${label} missing`
            }
            fontSize={Math.max(18, Math.min(40, node.width / 10))}
            fontFamily="DCF Montserrat, sans-serif"
            fontStyle="600"
            fill="rgba(255,255,255,0.75)"
            listening={false}
          />
        </>
      )}
      {/* The frame casts the shadow when there is one, so see-through (PNG) portraits stay see-through. */}
      {node.frame.enabled && node.frame.width > 0 && (
        <Rect width={node.width} height={node.height} cornerRadius={r} stroke={node.frame.color} strokeWidth={node.frame.width} {...shadowProps(node.shadow)} listening={false} />
      )}
    </Group>
  );
}

const probeText = (o: { text: string; family: string; style: string; size: number; spacing: number; width?: number; lineHeight?: number }) => {
  const p = new KonvaLib.Text({ text: o.text, fontFamily: `${o.family}, sans-serif`, fontStyle: o.style, fontSize: o.size, letterSpacing: o.spacing, lineHeight: o.lineHeight ?? 1, ...(o.width ? { width: o.width, wrap: "word" } : { wrap: "none" }) });
  const r = { width: p.getTextWidth(), height: p.height() };
  p.destroy();
  return r;
};

/**
 * How a text layer is drawn: its font size after shrinking (one-line shrink,
 * or shrink-to-fit-the-box with a minimum size), its drawn height, and
 * whether it still doesn't fit (flagged before export). Measured exactly as
 * Konva will draw it.
 */
export function textLayout(node: TextNode, fontsReady = true): { size: number; height: number; overflow: boolean } {
  const text = node.uppercase ? node.text.toUpperCase() : node.text;
  const f = fontString(node);
  const lines = Math.max(1, text.split("\n").length);
  if (typeof document === "undefined" || !fontsReady) return { size: node.fontSize, height: node.fontSize * node.lineHeight * lines, overflow: false };
  const base = { text, family: f.family, style: f.style, spacing: node.letterSpacing, lineHeight: node.lineHeight };
  if (node.fitBox) {
    const min = Math.max(6, Math.min(node.minFontSize ?? 12, node.fontSize));
    const fits = (size: number) => probeText({ ...base, size, width: node.width }).height <= node.height + 0.5;
    if (fits(node.fontSize)) return { size: node.fontSize, height: probeText({ ...base, size: node.fontSize, width: node.width }).height, overflow: false };
    let lo = min;
    let hi = node.fontSize;
    for (let i = 0; i < 14 && hi - lo > 0.25; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    const size = Math.floor(lo * 100) / 100;
    return { size, height: probeText({ ...base, size, width: node.width }).height, overflow: !fits(size) };
  }
  if (node.shrink) {
    const widest = probeText({ ...base, size: node.fontSize }).width;
    let size = node.fontSize;
    if (widest > node.width) {
      // Shrinking isn't perfectly linear (kerning, rounding): step down until it fits.
      size = Math.floor(((node.fontSize * node.width) / widest) * 100) / 100;
      for (let i = 0; i < 6 && probeText({ ...base, size }).width > node.width - 0.5; i++) size = Math.max(6, size * 0.985);
    }
    return { size, height: node.fontSize * node.lineHeight * lines, overflow: false };
  }
  return { size: node.fontSize, height: probeText({ ...base, size: node.fontSize, width: node.width }).height, overflow: false };
}

function TextLayer({ node, act, fontsKey }: { node: TextNode; act: Interact | null; fontsKey: number }) {
  const f = fontString(node);
  const movable = !!act && act.interactive && !node.locked && act.canMove(node);
  const shown = node.uppercase ? node.text.toUpperCase() : node.text;
  // fontsKey changes once the font file has loaded, so the measurement is redone with the real letters.
  const lay = useMemo(() => textLayout(node, fontsKey > 0), [node, fontsKey]);
  const lines = shown.split("\n").length;
  const panel = node.panel?.enabled ? node.panel : null;
  return (
    <>
      {panel && (
        // Background panel behind the text; moves with it (see FlyerStage drag handling).
        <Rect
          id={`${node.id}__panel`}
          x={node.x}
          y={node.y}
          offsetX={panel.padding}
          offsetY={panel.padding}
          rotation={node.rotation}
          width={node.width + panel.padding * 2}
          height={(node.fitBox ? node.height : lay.height) + panel.padding * 2}
          cornerRadius={panel.radius}
          fill={panel.color}
          opacity={panel.opacity * node.opacity}
          globalCompositeOperation={blendOp(node.blend)}
          listening={false}
        />
      )}
      <KText
        key={fontsKey}
        id={node.id}
        name="flyer-node"
        x={node.x}
        y={node.y}
        width={node.width}
        rotation={node.rotation}
        opacity={node.opacity}
        text={shown}
        globalCompositeOperation={blendOp(node.blend)}
        fontFamily={`${f.family}, sans-serif`}
        fontStyle={f.style}
        fontSize={lay.size}
        // Shrunk text stays on one line, centred on where the full-size line was.
        {...(node.shrink && !node.fitBox ? { wrap: "none", height: node.fontSize * node.lineHeight * lines, verticalAlign: "middle" } : {})}
        lineHeight={node.lineHeight}
        letterSpacing={node.letterSpacing}
        align={node.align}
        fill={node.fill}
        stroke={node.stroke.enabled && node.stroke.width > 0 ? node.stroke.color : undefined}
        strokeWidth={node.stroke.enabled ? node.stroke.width : 0}
        fillAfterStrokeEnabled
        lineJoin="round"
        {...shadowProps(node.shadow)}
        draggable={movable}
        listening={!!act?.interactive && !node.locked}
        onMouseDown={(e) => act?.onSelect(node.id, e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey)}
        onTap={() => act?.onSelect(node.id, false)}
        onDblClick={() => act?.onEditText?.(node.id)}
        onDblTap={() => act?.onEditText?.(node.id)}
      />
    </>
  );
}

/** A DJ name-logo slot without a logo: the DJ's display name, fitted on one line in the frame. */
function NameFallback({ node, name }: { node: ImageNode; name: string }) {
  const fb = node.fallback ?? { font: "bebas", weight: 400, fill: "#ffffff", uppercase: true };
  const text = fb.uppercase ? name.toUpperCase() : name;
  const f = fontString({ font: fb.font, weight: fb.weight, italic: false });
  const size = useMemo(() => {
    const start = node.height * 0.8;
    if (typeof document === "undefined") return start;
    const w = probeText({ text, family: f.family, style: f.style, size: start, spacing: 2 }).width;
    return w > node.width * 0.96 ? (start * node.width * 0.96) / w : start;
  }, [text, f.family, f.style, node.width, node.height]);
  return <KText width={node.width} height={node.height} align="center" verticalAlign="middle" text={text} fontFamily={`${f.family}, sans-serif`} fontStyle={f.style} fontSize={size} letterSpacing={2} fill={fb.fill} wrap="none" listening={false} />;
}

/** The layers themselves, drawn the same way in the editor, the preview and every export. */
export function SceneNodes({ scene, ctx, exporting, act, fontsKey, onStatus }: { scene: Scene; ctx: SrcContext; exporting: boolean; act: Interact | null; fontsKey: number; onStatus?: (id: string, done: boolean) => void }) {
  return (
    <>
      <Rect width={scene.width} height={scene.height} fill={scene.background} listening={false} />
      {scene.nodes.map((n) =>
        // Hidden by the user, or by its data ("only show when…", empty "hide when empty" text).
        !shownByData(n, ctx.values) ? null : n.kind === "image" ? (
          <ImageLayer key={n.id} node={n} ctx={ctx} exporting={exporting} act={act} onStatus={onStatus} />
        ) : (
          <TextLayer key={n.id} node={n} act={act} fontsKey={fontsKey} />
        )
      )}
    </>
  );
}

/* ---------------- editor stage ---------------- */

export type StageApi = { stage: Konva.Stage | null };

export function FlyerStage({
  scene,
  zoom,
  selected,
  ctx,
  fontsKey,
  showGuides,
  canMove,
  onSelect,
  onClear,
  onChange,
  onEditText,
  coarse
}: {
  scene: Scene;
  zoom: number;
  selected: string[];
  ctx: SrcContext;
  fontsKey: number;
  showGuides: boolean;
  canMove: (n: FlyerNode) => boolean;
  onSelect: (id: string, additive: boolean) => void;
  onClear: () => void;
  onChange: (patches: NodePatch[], key: string) => void;
  onEditText: (id: string) => void;
  coarse: boolean;
}) {
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [guides, setGuides] = useState<Guide[]>([]);

  const byId = useMemo(() => new Map(scene.nodes.map((n) => [n.id, n])), [scene.nodes]);
  const selNodes = selected.map((id) => byId.get(id)).filter((n): n is FlyerNode => !!n && n.visible);
  const allMovable = selNodes.length > 0 && selNodes.every((n) => !n.locked && canMove(n));
  const single = selNodes.length === 1 ? selNodes[0] : null;

  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const nodes = selNodes.map((n) => stage.findOne(`#${n.id}`)).filter((n): n is Konva.Node => !!n);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  });

  const act: Interact = { interactive: true, canMove, onSelect, onEditText };

  function readPatches(): NodePatch[] {
    const stage = stageRef.current;
    if (!stage) return [];
    return selNodes.flatMap((n) => {
      const k = stage.findOne(`#${n.id}`);
      if (!k) return [];
      const sx = k.scaleX();
      const sy = k.scaleY();
      const patch: Partial<FlyerNode> = { x: Math.round(k.x() * 10) / 10, y: Math.round(k.y() * 10) / 10, rotation: Math.round(k.rotation() * 10) / 10 };
      if (n.kind === "image") {
        patch.width = Math.max(8, Math.round(n.width * sx));
        patch.height = Math.max(8, Math.round(n.height * sy));
      } else {
        patch.width = Math.max(20, Math.round((k as Konva.Text).width() * sx));
        if (Math.abs(sy - 1) > 0.001) (patch as Partial<TextNode>).fontSize = Math.max(6, Math.round(n.fontSize * sy * 10) / 10);
      }
      k.scaleX(1);
      k.scaleY(1);
      return [{ id: n.id, patch }];
    });
  }

  // Text background panels follow their text while it's dragged.
  function syncPanels() {
    const stage = stageRef.current;
    if (!stage) return;
    for (const n of selNodes) {
      const k = stage.findOne(`#${n.id}`);
      const p = stage.findOne(`#${n.id}__panel`);
      if (k && p) p.setAttrs({ x: k.x(), y: k.y(), rotation: k.rotation() });
    }
  }

  function onDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    syncPanels();
    if (!showGuides || selNodes.length !== 1) return;
    const k = e.target;
    const layer = k.getLayer();
    if (!layer) return;
    const box = k.getClientRect({ relativeTo: layer, skipShadow: true, skipStroke: true });
    const others = scene.nodes.filter((n) => n.visible && n.id !== single?.id && n.role !== "background").map(boundsOf);
    const { dx, dy, guides: g } = snapBox(box, others, scene, 8 / zoom);
    if (dx || dy) {
      k.x(k.x() + dx);
      k.y(k.y() + dy);
    }
    setGuides(g);
    syncPanels();
  }

  // Two fingers = pinch zoom (handled by the editor); stop any layer drag the first finger started.
  function onTouchMove(e: Konva.KonvaEventObject<TouchEvent>) {
    if (e.evt.touches.length !== 2) return;
    stageRef.current?.find(".flyer-node").forEach((n) => n.isDragging() && n.stopDrag());
  }

  const anchorSize = coarse ? 22 : 10;
  const anchors = !allMovable
    ? []
    : single?.kind === "text"
      ? ["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right"]
      : single
        ? ["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"]
        : ["top-left", "top-right", "bottom-left", "bottom-right"];

  return (
    <Stage
      ref={stageRef}
      width={Math.round(scene.width * zoom)}
      height={Math.round(scene.height * zoom)}
      scaleX={zoom}
      scaleY={zoom}
      onMouseDown={(e) => e.target === e.target.getStage() && onClear()}
      onTouchStart={(e) => {
        if (e.evt.touches.length === 1 && e.target === e.target.getStage()) onClear();
      }}
      onTouchMove={onTouchMove}
      style={{ touchAction: "none" }}
    >
      <Layer
        onDragMove={onDragMove}
        onDragEnd={() => {
          setGuides([]);
          const p = readPatches();
          if (p.length) onChange(p, `drag:${selected.join(",")}`);
        }}
      >
        <SceneNodes scene={scene} ctx={ctx} exporting={false} act={act} fontsKey={fontsKey} />
        <Transformer
          ref={trRef}
          rotateEnabled={allMovable}
          resizeEnabled={allMovable}
          enabledAnchors={anchors}
          keepRatio={single?.kind !== "image"}
          anchorSize={anchorSize}
          anchorCornerRadius={anchorSize / 2}
          anchorStroke="#c99428"
          anchorFill="#fff8e6"
          borderStroke={allMovable ? "#e5b647" : "#8a8274"}
          borderDash={allMovable ? undefined : [6, 4]}
          borderStrokeWidth={1.5}
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          rotationSnapTolerance={4}
          ignoreStroke
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10 ? oldBox : newBox)}
          onTransform={() => {
            syncPanels();
            // Side handles on text change the box width, not the letter shapes.
            const k = trRef.current?.nodes()[0];
            const anchor = trRef.current?.getActiveAnchor();
            if (single?.kind === "text" && k && (anchor === "middle-left" || anchor === "middle-right")) {
              k.width(Math.max(20, k.width() * k.scaleX()));
              k.scaleX(1);
            }
          }}
          onTransformEnd={() => {
            const p = readPatches();
            if (p.length) onChange(p, `transform:${selected.join(",")}`);
          }}
        />
      </Layer>
      <Layer listening={false}>
        {showGuides && scene.safeMargin > 0 && (
          <Rect
            x={scene.safeMargin}
            y={scene.safeMargin}
            width={scene.width - scene.safeMargin * 2}
            height={scene.height - scene.safeMargin * 2}
            stroke="rgba(124,200,255,0.55)"
            strokeWidth={1.5 / zoom}
            dash={[8 / zoom, 6 / zoom]}
          />
        )}
        {guides.map((g, i) =>
          g.orient === "v" ? (
            <Line key={i} points={[g.pos, 0, g.pos, scene.height]} stroke="#ff4fa3" strokeWidth={1.5 / zoom} />
          ) : (
            <Line key={i} points={[0, g.pos, scene.width, g.pos]} stroke="#ff4fa3" strokeWidth={1.5 / zoom} />
          )
        )}
      </Layer>
    </Stage>
  );
}

/* ---------------- export ---------------- */

/**
 * Draws the flyer off screen at its real size (1080 wide) once every font
 * and image has loaded, then hands back the PNG/JPEG. Uses the same layer
 * drawing as the editor, so the export matches what's on screen.
 */
export function ExportStage({ scene, ctx, mime, quality, onDone }: { scene: Scene; ctx: SrcContext; mime: "image/png" | "image/jpeg"; quality: number; onDone: (blob: Blob | null, error?: string) => void }) {
  const stageRef = useRef<Konva.Stage>(null);
  const [ready, setReady] = useState(false);
  const pending = useRef(new Map<string, boolean>());
  const [settledTick, setSettledTick] = useState(0);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    let live = true;
    Promise.all([loadSceneFonts([scene]), loadSceneImages(scene, ctx), document.fonts.ready]).then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [scene, ctx]);

  const imageIds = useMemo(() => scene.nodes.filter((n) => n.kind === "image" && n.visible).map((n) => n.id), [scene.nodes]);
  const onStatus = useMemo(
    () => (id: string, done: boolean) => {
      pending.current.set(id, done);
      setSettledTick((t) => t + 1);
    },
    []
  );

  useEffect(() => {
    if (!ready) return;
    if (!imageIds.every((id) => pending.current.get(id))) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const stage = stageRef.current;
        if (!stage) return doneRef.current(null, "The flyer couldn't be drawn.");
        try {
          stage.draw();
          const canvas = stage.toCanvas({ pixelRatio: 1, x: 0, y: 0, width: scene.width, height: scene.height });
          if (canvas.width !== scene.width || canvas.height !== scene.height) return doneRef.current(null, "The export came out the wrong size.");
          if (mime === "image/jpeg") {
            // JPEG has no transparency: put the flyer on its background colour.
            const flat = document.createElement("canvas");
            flat.width = canvas.width;
            flat.height = canvas.height;
            const c = flat.getContext("2d")!;
            c.fillStyle = scene.background;
            c.fillRect(0, 0, flat.width, flat.height);
            c.drawImage(canvas, 0, 0);
            flat.toBlob((b) => doneRef.current(b, b ? undefined : "Export failed."), mime, quality);
          } else canvas.toBlob((b) => doneRef.current(b, b ? undefined : "Export failed."), mime);
        } catch {
          doneRef.current(null, "An image on this flyer can't be exported. Replace it and try again.");
        }
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [ready, settledTick, imageIds, mime, quality, scene.width, scene.height, scene.background]);

  if (!ready) return null;
  return (
    <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, width: scene.width, height: scene.height, pointerEvents: "none", opacity: 0 }}>
      <Stage ref={stageRef} width={scene.width} height={scene.height}>
        <Layer>
          <SceneNodes scene={scene} ctx={ctx} exporting act={null} fontsKey={1} onStatus={onStatus} />
        </Layer>
      </Stage>
    </div>
  );
}

/* ---------------- thumbnail ---------------- */

/** A small, read-only rendering of a scene (template browser, flyer list). */
export function ScenePreview({ scene, width, ctx }: { scene: Scene; width: number; ctx?: SrcContext }) {
  const [fontsKey, setFontsKey] = useState(0);
  useEffect(() => {
    let live = true;
    loadSceneFonts([scene]).then(() => live && setFontsKey((k) => k + 1));
    return () => {
      live = false;
    };
  }, [scene]);
  const z = width / scene.width;
  return (
    <Stage width={Math.round(scene.width * z)} height={Math.round(scene.height * z)} scaleX={z} scaleY={z} listening={false}>
      <Layer listening={false}>
        <SceneNodes scene={scene} ctx={ctx ?? {}} exporting={false} act={null} fontsKey={fontsKey} />
      </Layer>
    </Stage>
  );
}
