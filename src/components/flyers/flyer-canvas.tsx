"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import KonvaLib from "konva";
import type Konva from "konva";
import { Ellipse, Group, Image as KImage, Layer, Line, Rect, Stage, Text as KText, Shape as KShape, Transformer } from "react-konva";
import { arcGeometry, placeOnArc } from "@/lib/flyers/arc";
import { MotionWrap, OccludeGroup, useRasterImages } from "./motion-wrap";
import type { MotionState } from "@/lib/flyers/motion/types";
import { graphemes, revealCount } from "@/lib/flyers/motion/graphemes";
import { imageLayout } from "@/lib/flyers/scene";
import { boundsOf, snapBox, type Guide } from "@/lib/flyers/snap";
import { applyFeather, hiddenOverlay, needsProcessing, processedImage } from "@/lib/flyers/feather";
import { maskOn } from "@/lib/flyers/mask";
import { MaskTools, type MaskEdit } from "./mask-tools";
import { applyEffects, effectsOn, resolveParams, type PhotoEffects } from "@/lib/flyers/effects";
import { runEffects, keyFor } from "./fx-runner";
import { setFxStatus } from "./fx-status";
import { paintEcho } from "./echo-paint";
import { echoOn, type EchoInput } from "@/lib/flyers/echo";
import { shownByData } from "@/lib/flyers/links";
import type { FlyerNode, ImageNode, Scene, ShapeNode, TextNode } from "@/lib/flyers/types";
import { fontString, loadSceneFonts, loadSceneImages, slotDjId, srcFor, useImage, type SrcContext } from "./loaders";

export type NodePatch = { id: string; patch: Partial<FlyerNode> };

type Interact = {
  interactive: boolean;
  canMove: (n: FlyerNode) => boolean;
  /** "down" on press, "click" on release without dragging, "tap" on touch. */
  onSelect: (id: string, additive: boolean, phase?: "down" | "click" | "tap") => void;
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

/** Room around a layer for effects that reach past its edges (echoes, shadow, edge light, wobble). */
function fxPad(fx: PhotoEffects) {
  const P = resolveParams(fx);
  return Math.ceil(Math.max(P.echoCount > 0 ? Math.ceil(P.echoCount / 2) * P.echoOffset : 0, P.shadowOn ? P.shadowOffset * 1.6 : 0, P.edgeOn ? P.edgeWidth : 0, P.distortion > 0 ? 10 : 0, P.rgbShift)) + 2;
}

/**
 * Effects on text and shape layers: the layer is cached as a bitmap (at the
 * preview or export resolution) and the same effects engine runs on it as
 * a Konva filter. Photos use the worker path in ImageLayer instead.
 */
function useLayerEffects(ref: React.RefObject<Konva.Node | null>, node: FlyerNode, scale: number, exporting: boolean, extraKey: string | number) {
  const fx = effectsOn(node.effects) ? node.effects : null;
  // Moving the layer doesn't change its pixels, so position isn't part of the key.
  const { x: _x, y: _y, ...look } = node;
  void _x;
  void _y;
  const key = fx ? `${JSON.stringify(look)}|${scale}|${extraKey}` : "";
  useEffect(() => {
    const n = ref.current;
    if (!n) return;
    if (!fx) {
      if (n.isCached()) {
        n.clearCache();
        n.filters([]);
        n.getLayer()?.batchDraw();
      }
      return;
    }
    const run = () => {
      try {
        n.clearCache();
        n.filters([]);
        n.cache({ pixelRatio: scale, offset: fxPad(fx) });
        n.filters([
          (img: ImageData) => {
            const out = applyEffects({ data: img.data, width: img.width, height: img.height }, fx, scale);
            img.data.set(out.data);
          }
        ]);
        n.getLayer()?.batchDraw();
      } catch {
        // an empty layer can't be cached; draw it as it is
        n.clearCache();
      }
    };
    if (exporting) {
      run();
      return;
    }
    const t = setTimeout(run, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, exporting]);
}

function cloneCanvas(c: HTMLCanvasElement) {
  const o = document.createElement("canvas");
  o.width = c.width;
  o.height = c.height;
  o.getContext("2d")!.drawImage(c, 0, 0);
  return o;
}

const shadowProps = (s: { enabled: boolean; color: string; blur: number; offsetX: number; offsetY: number; opacity: number }) =>
  s.enabled ? { shadowEnabled: true, shadowColor: s.color, shadowBlur: s.blur, shadowOffsetX: s.offsetX, shadowOffsetY: s.offsetY, shadowOpacity: s.opacity } : { shadowEnabled: false };

/** Echo to draw on a picture layer: Animate's moment of it, else the layer's own (still) echo. */
export type EchoAt = EchoInput & { u: number; amount: number };

function ImageLayer({ node, ctx, exporting, act, onStatus, echoAt }: { node: ImageNode; ctx: SrcContext; exporting: boolean; act: Interact | null; onStatus?: (id: string, done: boolean) => void; echoAt?: EchoAt | null }) {
  const url = srcFor(node.source, ctx);
  const { img, status } = useImage(url);
  const lay = img ? imageLayout(node, { width: img.naturalWidth, height: img.naturalHeight }, node.fit, node.crop) : null;
  const r = Math.min(node.frame.radius, node.width / 2, node.height / 2);
  const feather = node.feather ?? { amount: 0, shape: "edges" as const };
  const recolor = node.recolor ?? { mode: "none" as const, color: "#ffffff", knockoutWhite: false };
  // Photo Effects: run on the framed picture (before the soft-edge fade), at preview or export resolution.
  const fx = effectsOn(node.effects) ? node.effects : null;
  const fxOn = !!fx;
  const fxScale = Math.min(3, Math.max(0.1, ctx.fxScale ?? 1));
  const featherKey = `${feather.amount}|${feather.shape}|${feather.curve}|${feather.sides?.top}|${feather.sides?.right}|${feather.sides?.bottom}|${feather.sides?.left}`;
  // Layer mask (editor: "hold to see original" leaves it off while held).
  const mv = !exporting && ctx.maskView?.id === node.id ? ctx.maskView : null;
  const mask = mv?.hold ? null : maskOn(node.mask) ? node.mask : null;
  const natural = img ? { width: img.naturalWidth, height: img.naturalHeight } : null;
  // Echo: Animate's moment of it, else the layer's own still echo (u = 0, not moving).
  const echo: EchoAt | null = echoAt ?? (echoOn(node.echo) ? { ...node.echo, u: 0, amount: 0 } : null);
  const echoWanted = !!echo;
  const soft = useMemo(
    () =>
      img && lay && natural && (fx || echoWanted || needsProcessing(feather, recolor, mask))
        ? processedImage(img, node, lay, node.flipX, node.flipY, feather, recolor, { scale: fxScale, withFeather: !fx, mask: { mask, natural, owner: node.id } })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [img, lay?.x, lay?.y, lay?.width, lay?.height, node.width, node.height, node.flipX, node.flipY, featherKey, recolor.mode, recolor.color, recolor.knockoutWhite, fxOn, fxScale, mask, echoWanted]
  );
  // Mask editing: what's hidden, tinted, so it's easy to see (editor only).
  const overlay = useMemo(
    () => (mv?.overlay && !mv.hold && mask && img && lay && natural ? hiddenOverlay(img, node, lay, node.flipX, node.flipY, mask, natural, `${node.id}~o`, mv.color, fxScale) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mv?.overlay, mv?.hold, mv?.color, mask, img, lay?.x, lay?.y, lay?.width, lay?.height, node.width, node.height, node.flipX, node.flipY, fxScale]
  );
  const fxKey = fx && soft ? `${keyFor(soft)}|${JSON.stringify(fx)}|${featherKey}|${fxScale}` : null;
  const [fxOut, setFxOut] = useState<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  const [fxFailed, setFxFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!fx || !soft || !fxKey) {
      setFxStatus(node.id, null);
      return;
    }
    let live = true;
    setFxStatus(node.id, "working");
    // Quick slider moves wait a moment; exports run straight away.
    const t = setTimeout(
      () => {
        runEffects(soft, fx, fxScale)
          .then((c) => {
            if (!live) return;
            setFxOut({ key: fxKey, canvas: applyFeather(c, feather, fxScale) });
            setFxFailed(null);
            setFxStatus(node.id, "ready");
          })
          .catch(() => {
            if (!live) return;
            setFxFailed(fxKey);
            setFxStatus(node.id, "error");
          });
      },
      exporting ? 0 : 70
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxKey, exporting]);
  // Without a finished effects image yet, show the photo as it was (never a blank frame).
  const fxPending = !!fx && fxOut?.key !== fxKey && fxFailed !== fxKey;
  const plainSoft = useMemo(() => (fx && soft ? applyFeather(cloneCanvas(soft), feather, fxScale) : null), [soft, fxOn]); // eslint-disable-line react-hooks/exhaustive-deps
  // While a mask is being brushed, the picture follows the brush straight away (effects catch up when it stops).
  const shown = fx ? (fxOut?.key === fxKey ? fxOut.canvas : mv ? plainSoft : (fxOut?.canvas ?? plainSoft)) : soft;
  // Echoes are copies of the picture as shown (cutout, mask, feather and photo effects included), drawn behind it.
  const echoPic = echo ? (shown ?? null) : null;
  const echoKey = echo ? `${echo.preset}|${JSON.stringify(echo.params ?? {})}|${echo.seed ?? 7}|${echo.u.toFixed(4)}|${echo.amount.toFixed(3)}` : "";
  const echoDraw = useMemo(() => (echo && echoPic ? paintEcho(echoPic, node.width, node.height, echo, fxScale, echo.u, echo.amount) : null), [echoPic, echoKey, node.width, node.height, fxScale]); // eslint-disable-line react-hooks/exhaustive-deps
  const hideOriginal = !!echoDraw && !echoDraw.original;
  // An export waits until the effects at full resolution are done.
  useEffect(() => {
    onStatus?.(node.id, status !== "loading" && !fxPending);
  }, [node.id, status, onStatus, fxPending]);
  const movable = !!act && act.interactive && !node.locked && act.canMove(node);
  const label = node.source.type === "dj_photo" ? "DJ photo" : node.source.type === "dj_logo" ? "DJ name logo" : node.source.type === "venue_logo" ? "Venue logo" : "Image";
  // The echoes sit in their own group behind the layer (same place, turn and opacity), so the
  // selection box and hit area stay the layer's own frame.
  const echoGroup = echoDraw ? (
    <Group x={node.x} y={node.y} rotation={node.rotation} opacity={node.opacity} globalCompositeOperation={blendOp(node.blend)} listening={false}>
      <KImage image={echoDraw.canvas} x={echoDraw.x} y={echoDraw.y} width={echoDraw.w} height={echoDraw.h} listening={false} />
    </Group>
  ) : null;
  return (
    <>
    {echoGroup}
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
      onMouseDown={(e) => act?.onSelect(node.id, e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey, "down")}
      onClick={(e) => act?.onSelect(node.id, e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey, "click")}
      onTap={() => act?.onSelect(node.id, false, "tap")}
    >
      {/* Full-size hit area so empty or transparent frames are still easy to grab. */}
      <Rect width={node.width} height={node.height} fill="rgba(0,0,0,0)" />
      <Group clipFunc={roundedClip(node.width, node.height, r)} listening={false} visible={!hideOriginal}>
        {shown ? (
          <KImage image={shown} x={0} y={0} width={node.width} height={node.height} {...(node.frame.enabled && node.frame.width > 0 ? { shadowEnabled: false } : shadowProps(node.shadow))} />
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
        {overlay && <KImage image={overlay} x={0} y={0} width={node.width} height={node.height} opacity={0.5} listening={false} />}
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
    </>
  );
}

const probeText = (o: { text: string; family: string; style: string; size: number; spacing: number; width?: number; lineHeight?: number }) => {
  const p = new KonvaLib.Text({ text: o.text, fontFamily: `${o.family}, sans-serif`, fontStyle: o.style, fontSize: o.size, letterSpacing: o.spacing, lineHeight: o.lineHeight ?? 1, ...(o.width ? { width: o.width, wrap: "word" } : { wrap: "none" }) });
  const r = { width: p.getTextWidth(), height: p.height() };
  p.destroy();
  return r;
};

/**
 * How a text layer is drawn: its font size after auto-fit (one-line shrink,
 * shrink-to-fit-the-box, or one line fitted to the box), the height of the
 * text block, the letter spacing at that size, the box's height, and
 * whether it still doesn't fit at the smallest size (flagged in the editor
 * and before export). Measured exactly as Konva will draw it, for the
 * editor, the preview and the export alike.
 */
export type TextLay = { size: number; height: number; overflow: boolean; spacing: number; boxHeight: number; oneLine: boolean; lineWidth?: number };
export function textLayout(node: TextNode, fontsReady = true): TextLay {
  const text = node.uppercase ? node.text.toUpperCase() : node.text;
  const f = fontString(node);
  const lines = Math.max(1, text.split("\n").length);
  const pad = node.padding ?? 0;
  // Stretched letters take `stretch` times their width: measure against the box at that ratio.
  const stretch = node.stretch ?? 1;
  const innerW = Math.max(4, node.width - pad * 2) / stretch;
  const innerH = Math.max(4, node.height - pad * 2);
  // Tracking in em follows the fitted size, so shrunk text keeps its look.
  const sp = (size: number) => (node.trackingEm != null ? node.trackingEm * size : node.letterSpacing);
  const oneLine = !!node.shrink;
  const min = Math.max(6, Math.min(node.minFontSize ?? 12, node.fontSize));
  const box = (size: number, height: number, overflow = false): TextLay => ({ size, height, overflow, spacing: sp(size), boxHeight: node.fitBox ? node.height : (oneLine ? node.fontSize * node.lineHeight * lines : height) + pad * 2, oneLine });
  if (node.arc) {
    // Curved: one line along the arch, shrunk (not below the smallest size) when the words outgrow the curve.
    const flat = text.replace(/\n+/g, " ");
    let size = node.fontSize;
    let overflow = false;
    if (typeof document !== "undefined" && fontsReady) {
      const widthAt = (z: number) => probeText({ text: flat, family: f.family, style: f.style, size: z, spacing: sp(z) }).width;
      // Stretched letters take `stretch` times their width along the arch.
      const st = node.stretch ?? 1;
      const room = arcGeometry(node.width, node.fontSize, node.arc, pad).length;
      const w = widthAt(size) * st;
      if (w > room) size = Math.max(min, Math.floor(((size * room) / w) * 0.99 * 100) / 100);
      overflow = widthAt(size) * st > room + 0.5;
    }
    const g = arcGeometry(node.width, node.fontSize, node.arc, pad);
    return { size, height: g.boxHeight - pad * 2, overflow, spacing: sp(size), boxHeight: g.boxHeight, oneLine: true };
  }
  if (typeof document === "undefined" || !fontsReady) return box(node.fontSize, node.fontSize * node.lineHeight * lines);
  const base = { text, family: f.family, style: f.style, lineHeight: node.lineHeight };

  if (node.fitBox && oneLine) {
    // One line, as large as fits both the box's width and its height.
    const widthAt = (size: number) => probeText({ ...base, size, spacing: sp(size) }).width;
    let size = Math.min(node.fontSize, innerH / (node.lineHeight * lines));
    const w = widthAt(size);
    if (w > innerW) {
      size = Math.floor(((size * innerW) / w) * 100) / 100;
      for (let i = 0; i < 8 && widthAt(size) > innerW - 0.5; i++) size *= 0.985;
    }
    const overflow = size < min - 0.01;
    size = Math.max(size, min);
    const lineWidth = widthAt(size);
    return { ...box(size, probeText({ ...base, size, spacing: sp(size) }).height, overflow || lineWidth > innerW + 0.5), lineWidth: lineWidth * stretch };
  }
  if (node.fitBox) {
    const fits = (size: number) => probeText({ ...base, size, spacing: sp(size), width: innerW }).height <= innerH + 0.5;
    if (fits(node.fontSize)) return box(node.fontSize, probeText({ ...base, size: node.fontSize, spacing: sp(node.fontSize), width: innerW }).height);
    let lo = min;
    let hi = node.fontSize;
    for (let i = 0; i < 14 && hi - lo > 0.25; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    const size = Math.floor(lo * 100) / 100;
    return box(size, probeText({ ...base, size, spacing: sp(size), width: innerW }).height, !fits(size));
  }
  if (oneLine) {
    const widest = probeText({ ...base, size: node.fontSize, spacing: sp(node.fontSize) }).width;
    let size = node.fontSize;
    if (widest > innerW) {
      // Shrinking isn't perfectly linear (kerning, rounding): step down until it fits.
      size = Math.floor(((node.fontSize * innerW) / widest) * 100) / 100;
      for (let i = 0; i < 6 && probeText({ ...base, size, spacing: sp(size) }).width > innerW - 0.5; i++) size = Math.max(6, size * 0.985);
    }
    return box(size, node.fontSize * node.lineHeight * lines);
  }
  return box(node.fontSize, probeText({ ...base, size: node.fontSize, spacing: sp(node.fontSize), width: innerW }).height);
}

/**
 * Where a text layer's box sits and how it turns. The box is node.x/y/width
 * and its height (the fit box, or the laid-out text). Rotation is clockwise
 * around the pivot: the box centre for `pivot: "center"` (date badges), else
 * the top-left corner (older layers, unchanged). The text block sits inside
 * the padding, vertically aligned in the box.
 */
export function textGeometry(node: TextNode, lay: TextLay) {
  const pad = node.padding ?? 0;
  const bw = node.width;
  const bh = lay.boxHeight;
  const va = node.fitBox ? (node.valign ?? "top") : "top";
  const free = bh - pad * 2 - lay.height;
  const dy = va === "middle" ? free / 2 : va === "bottom" ? free : 0;
  const px = node.pivot === "center" ? bw / 2 : 0;
  const py = node.pivot === "center" ? bh / 2 : 0;
  return { pad, bw, bh, px, py, x: node.x + px, y: node.y + py, offsetX: px - pad, offsetY: py - pad - dy };
}

function TextLayer({ node, act, fontsKey, ctx, exporting, reveal = null }: { node: TextNode; act: Interact | null; fontsKey: number; ctx: SrcContext; exporting: boolean; reveal?: MotionState["reveal"] }) {
  const f = fontString(node);
  const textRef = useRef<Konva.Text>(null);
  const movable = !!act && act.interactive && !node.locked && act.canMove(node);
  const shown = node.uppercase ? node.text.toUpperCase() : node.text;
  // fontsKey changes once the font file has loaded, so the measurement is redone with the real letters.
  const lay = useMemo(() => textLayout(node, fontsKey > 0), [node, fontsKey]);
  const g = textGeometry(node, lay);
  const lines = shown.split("\n").length;
  // One-line text that can't fit even at its smallest size is drawn whole (never cut off) and flagged.
  const inner = Math.max(1, g.bw - g.pad * 2);
  const extra = lay.oneLine && lay.lineWidth && lay.lineWidth > inner ? Math.ceil(lay.lineWidth - inner) + 2 : 0;
  const shiftX = node.align === "center" ? extra / 2 : node.align === "right" ? extra : 0;
  const panel = node.panel?.enabled ? node.panel : null;
  const stretch = node.stretch ?? 1;
  useLayerEffects(textRef, node, Math.min(3, Math.max(0.1, ctx.fxScale ?? 1)), exporting, fontsKey);
  if (node.arc) return <ArcTextLayer node={node} act={act} lay={lay} fontsKey={fontsKey} text={shown.replace(/\n+/g, " ")} reveal={reveal} />;
  return (
    <>
      {panel && (
        // Background panel behind the text box; moves and turns with it (see FlyerStage drag handling).
        <Rect
          id={`${node.id}__panel`}
          x={g.x}
          y={g.y}
          offsetX={g.px + panel.padding}
          offsetY={g.py + panel.padding}
          rotation={node.rotation}
          width={g.bw + panel.padding * 2}
          height={g.bh + panel.padding * 2}
          cornerRadius={panel.radius}
          fill={panel.color}
          opacity={panel.opacity * node.opacity}
          globalCompositeOperation={blendOp(node.blend)}
          listening={false}
        />
      )}
      {/* Editor only: text that can't fit its box even at the smallest size is outlined in red (never exported). */}
      {act?.interactive && lay.overflow && (
        <Rect x={g.x} y={g.y} offsetX={g.px} offsetY={g.py} rotation={node.rotation} width={g.bw} height={g.bh} stroke="#e5484d" strokeWidth={3} dash={[10, 6]} listening={false} />
      )}
      <RevealClip textRef={textRef} reveal={reveal}>
      <KText
        key={fontsKey}
        ref={textRef}
        id={node.id}
        name="flyer-node"
        x={g.x}
        y={g.y}
        offsetX={(g.offsetX + shiftX) / stretch}
        offsetY={g.offsetY}
        scaleX={stretch}
        width={(inner + extra) / stretch}
        rotation={node.rotation}
        opacity={node.opacity}
        text={shown}
        globalCompositeOperation={blendOp(node.blend)}
        fontFamily={`${f.family}, sans-serif`}
        fontStyle={f.style}
        fontSize={lay.size}
        // One-line text never wraps. Shrunk text (without a fit box) stays centred on where the full-size line was.
        {...(node.shrink && !node.fitBox ? { wrap: "none", height: node.fontSize * node.lineHeight * lines, verticalAlign: "middle" } : node.shrink ? { wrap: "none" } : {})}
        lineHeight={node.lineHeight}
        letterSpacing={lay.spacing}
        align={node.align}
        fill={node.fill}
        stroke={node.stroke.enabled && node.stroke.width > 0 ? node.stroke.color : undefined}
        strokeWidth={node.stroke.enabled ? node.stroke.width : 0}
        fillAfterStrokeEnabled
        lineJoin="round"
        {...shadowProps(node.shadow)}
        draggable={movable}
        listening={!!act?.interactive && !node.locked}
        onMouseDown={(e) => act?.onSelect(node.id, e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey, "down")}
      onClick={(e) => act?.onSelect(node.id, e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey, "click")}
        onTap={() => act?.onSelect(node.id, false, "tap")}
        onDblClick={() => act?.onEditText?.(node.id)}
        onDblTap={() => act?.onEditText?.(node.id)}
      />
      </RevealClip>
    </>
  );
}

/**
 * Letter / word reveal (Animate): shows the first whole graphemes of each
 * line, measured on the line as drawn, so kerning, line breaks and
 * stretched letters are exactly as in the static text.
 */
let revealMeasure: CanvasRenderingContext2D | null = null;

function RevealClip({ textRef, reveal, children }: { textRef: React.RefObject<Konva.Text | null>; reveal: MotionState["reveal"]; children: React.ReactNode }) {
  if (!reveal || reveal.amount >= 1) return <>{children}</>;
  return (
    <Group
      clipFunc={(kctx: Konva.Context) => {
        const t = textRef.current;
        if (!t) return;
        const c = (kctx as unknown as { _context: CanvasRenderingContext2D })._context;
        const lines = (t as unknown as { textArr: { text: string; width: number }[] }).textArr ?? [];
        const joined = lines.map((l) => l.text).join("\n");
        let left = revealCount(joined, reveal.mode, reveal.amount);
        const lh = t.fontSize() * t.lineHeight();
        const total = lh * lines.length;
        const boxH = t.height();
        const y0 = t.verticalAlign() === "middle" ? (boxH - total) / 2 : t.verticalAlign() === "bottom" ? boxH - total : 0;
        const w = t.width();
        // Measured with the text's own font, then scaled to the line as Konva laid it out (exact at both ends).
        const mc = (revealMeasure ??= document.createElement("canvas").getContext("2d")!);
        mc.font = (t as unknown as { _getContextFont: () => string })._getContextFont();
        (mc as unknown as { letterSpacing: string }).letterSpacing = `${t.letterSpacing()}px`;
        const measure = (s: string, line: { text: string; width: number }) => {
          const full = mc.measureText(line.text).width;
          return full > 0 ? (mc.measureText(s).width / full) * line.width : 0;
        };
        c.save();
        const m = t.getTransform().getMatrix();
        c.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        const pad = t.fontSize();
        lines.forEach((l, i) => {
          const g = graphemes(l.text);
          const k = Math.max(0, Math.min(g.length, left));
          left -= g.length + (i < lines.length - 1 ? 1 : 0);
          if (k <= 0) return;
          const lx = t.align() === "center" ? (w - l.width) / 2 : t.align() === "right" ? w - l.width : 0;
          const shownW = k >= g.length ? l.width + pad : measure(g.slice(0, k).join(""), l);
          const top = y0 + i * lh - (i === 0 ? pad : 0);
          const bottom = y0 + (i + 1) * lh + (i === lines.length - 1 ? pad : 0);
          kctx.rect(lx - pad, top, shownW + pad, bottom - top);
        });
        c.restore();
      }}
    >
      {children}
    </Group>
  );
}

/**
 * Curved text: a group (the layer's box, turning around its centre) holding
 * the words on the arch. The box catches clicks and drags; double-click
 * edits the words in the panel like any text layer.
 */
function ArcTextLayer({ node, act, lay, fontsKey, text, reveal = null }: { node: TextNode; act: Interact | null; lay: TextLay; fontsKey: number; text: string; reveal?: MotionState["reveal"] }) {
  const f = fontString(node);
  const movable = !!act && act.interactive && !node.locked && act.canMove(node);
  const pad = node.padding ?? 0;
  // The arch stays put; smaller (shrunk) letters sit on the same baseline.
  const g = arcGeometry(node.width, node.fontSize, node.arc ?? 0, pad);
  const w = node.width;
  const h = g.boxHeight;
  const st = node.stretch ?? 1;
  const font = `${f.style === "normal" ? "" : f.style} ${lay.size}px ${f.family}, sans-serif`.trim();
  const stroke = node.stroke.enabled && node.stroke.width > 0 ? node.stroke : null;
  const sh = node.shadow.enabled ? node.shadow : null;
  return (
    <Group
      id={node.id}
      name="flyer-node"
      x={node.x + w / 2}
      y={node.y + h / 2}
      offsetX={w / 2}
      offsetY={h / 2}
      rotation={node.rotation}
      opacity={node.opacity}
      draggable={movable}
      listening={!!act?.interactive && !node.locked}
      onMouseDown={(e) => act?.onSelect(node.id, e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey, "down")}
      onClick={(e) => act?.onSelect(node.id, e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey, "click")}
      onTap={() => act?.onSelect(node.id, false, "tap")}
      onDblClick={() => act?.onEditText?.(node.id)}
      onDblTap={() => act?.onEditText?.(node.id)}
    >
      <Rect width={w} height={h} fill="rgba(0,0,0,0)" />
      {act?.interactive && lay.overflow && <Rect width={w} height={h} stroke="#e5484d" strokeWidth={3} dash={[10, 6]} listening={false} />}
      <KShape
        key={fontsKey}
        listening={false}
        globalCompositeOperation={blendOp(node.blend)}
        sceneFunc={(kctx) => {
          // Each letter on the arch, turned to the curve and widened along it (like SVG textLength).
          const c = (kctx as unknown as { _context: CanvasRenderingContext2D })._context;
          c.save();
          c.font = font;
          c.textAlign = "center";
          c.textBaseline = "alphabetic";
          const chars = graphemes(text);
          const widths = chars.map((ch) => c.measureText(ch).width);
          const { glyphs } = placeOnArc(g, widths, { spacing: lay.spacing, stretch: st, align: node.align });
          if (sh) {
            c.shadowColor = sh.color;
            c.shadowBlur = sh.blur;
            c.shadowOffsetX = sh.offsetX;
            c.shadowOffsetY = sh.offsetY;
            c.globalAlpha = c.globalAlpha * 1;
          }
          // Letter / word reveal: only the first whole graphemes are drawn.
          const show = reveal && reveal.amount < 1 ? revealCount(text, reveal.mode, reveal.amount) : glyphs.length;
          for (const pass of stroke ? (["stroke", "fill"] as const) : (["fill"] as const)) {
            glyphs.slice(0, show).forEach((p, i) => {
              c.save();
              c.translate(p.x, p.y);
              c.rotate(p.angle);
              c.scale(st, 1);
              if (pass === "stroke" && stroke) {
                c.lineJoin = "round";
                c.lineWidth = stroke.width / st;
                c.strokeStyle = stroke.color;
                c.strokeText(chars[i], 0, 0);
              } else {
                if (stroke) c.shadowColor = "transparent";
                c.fillStyle = node.fill;
                c.fillText(chars[i], 0, 0);
              }
              c.restore();
            });
          }
          c.restore();
        }}
      />
    </Group>
  );
}

/** A DJ name-logo slot without a logo: the DJ's display name, fitted on one line in the frame. */
/** Box / rectangle / oval / circle. The outline sits inside the shape's edges, so the size you set is the size you get. */
function ShapeLayer({ node, act, ctx, exporting }: { node: ShapeNode; act: Interact | null; ctx: SrcContext; exporting: boolean }) {
  const groupRef = useRef<Konva.Group>(null);
  useLayerEffects(groupRef, node, Math.min(3, Math.max(0.1, ctx.fxScale ?? 1)), exporting, 0);
  const movable = !!act && act.interactive && !node.locked && act.canMove(node);
  const sw = node.stroke.enabled ? Math.min(node.stroke.width, Math.min(node.width, node.height) / 2) : 0;
  const common = {
    fill: node.fillEnabled ? node.fill : undefined,
    fillEnabled: node.fillEnabled,
    stroke: sw > 0 ? node.stroke.color : undefined,
    strokeWidth: sw,
    listening: false,
    ...shadowProps(node.shadow)
  };
  return (
    <Group
      ref={groupRef}
      id={node.id}
      name="flyer-node"
      x={node.x}
      y={node.y}
      rotation={node.rotation}
      opacity={node.opacity}
      globalCompositeOperation={blendOp(node.blend)}
      draggable={movable}
      listening={!!act?.interactive && !node.locked}
      onMouseDown={(e) => act?.onSelect(node.id, e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey, "down")}
      onClick={(e) => act?.onSelect(node.id, e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey, "click")}
      onTap={() => act?.onSelect(node.id, false, "tap")}
    >
      {/* Full-size hit area, so outline-only shapes are easy to grab. */}
      <Rect width={node.width} height={node.height} fill="rgba(0,0,0,0)" />
      {node.shape === "ellipse" ? (
        <Ellipse x={node.width / 2} y={node.height / 2} radiusX={Math.max(0.5, (node.width - sw) / 2)} radiusY={Math.max(0.5, (node.height - sw) / 2)} {...common} />
      ) : (
        <Rect x={sw / 2} y={sw / 2} width={Math.max(1, node.width - sw)} height={Math.max(1, node.height - sw)} cornerRadius={Math.min(node.radius, Math.min(node.width, node.height) / 2)} {...common} />
      )}
    </Group>
  );
}

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
/** A text layer at one moment of its motion: added letter spacing and a drifting shadow (the saved layer is untouched). */
function textInMotion(n: TextNode, st: MotionState | undefined): TextNode {
  if (!st || (!st.trackingEm && !st.shadow)) return n;
  const out: TextNode = { ...n };
  if (st.trackingEm) out.trackingEm = (n.trackingEm ?? n.letterSpacing / Math.max(1, n.fontSize)) + st.trackingEm;
  if (st.shadow) {
    const base = n.shadow.enabled ? n.shadow : { enabled: true, color: st.shadow.color, blur: st.shadow.blur, offsetX: 0, offsetY: 0, opacity: st.shadow.opacity };
    out.shadow = { ...base, enabled: true, offsetX: base.offsetX + st.shadow.dx, offsetY: base.offsetY + st.shadow.dy };
  }
  return out;
}

/**
 * The layers themselves, drawn the same way in the editor, the preview and
 * every export. `motion` (Animate mode) adds each layer's offsets at one
 * moment of the timeline; without it this is exactly the static flyer.
 */
export function SceneNodes({ scene, ctx, exporting, act, fontsKey, onStatus, motion }: { scene: Scene; ctx: SrcContext; exporting: boolean; act: Interact | null; fontsKey: number; onStatus?: (id: string, done: boolean) => void; motion?: Map<string, MotionState> | null }) {
  useRasterImages(motion);
  const px = Math.min(1, Math.max(0.2, ctx.fxScale ?? 1));
  /** A layer as drawn on the flyer, with its motion. `clone`: a second copy (for occlusion), not pickable. */
  const draw = (n: FlyerNode, clone = false) => {
    const st = motion?.get(n.id);
    const k = clone ? `${n.id}__occ` : n.id;
    const nn = clone ? ({ ...n, id: k } as FlyerNode) : n;
    const el =
      nn.kind === "image" ? (
        <ImageLayer key={k} node={nn} ctx={ctx} exporting={exporting} act={clone ? null : act} onStatus={clone ? undefined : onStatus} echoAt={st?.echo ?? null} />
      ) : nn.kind === "shape" ? (
        <ShapeLayer key={k} node={nn} act={clone ? null : act} ctx={ctx} exporting={exporting} />
      ) : (
        <TextLayer key={k} node={textInMotion(nn, st)} act={clone ? null : act} fontsKey={fontsKey} ctx={ctx} exporting={exporting} reveal={st?.reveal ?? null} />
      );
    return st ? (
      <MotionWrap key={k} node={nn} st={st} px={px}>
        {el}
      </MotionWrap>
    ) : (
      el
    );
  };
  return (
    <>
      <Rect width={scene.width} height={scene.height} fill={scene.background} listening={false} />
      {scene.nodes.map((n) => {
        // Hidden by the user, or by its data ("only show when…", empty "hide when empty" text).
        if (!shownByData(n, ctx.values)) return null;
        const st = motion?.get(n.id);
        const occ = st?.occlude ? scene.nodes.find((o) => o.id === st.occlude!.nodeId && o.visible && shownByData(o, ctx.values)) : null;
        if (occ) {
          return (
            <OccludeGroup key={n.id} soft={st!.occlude!.soft} px={px} occluder={draw(occ, true)}>
              {draw(n)}
            </OccludeGroup>
          );
        }
        return draw(n);
      })}
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
  coarse,
  maskEdit,
  motion = null
}: {
  scene: Scene;
  zoom: number;
  selected: string[];
  ctx: SrcContext;
  fontsKey: number;
  showGuides: boolean;
  canMove: (n: FlyerNode) => boolean;
  onSelect: (id: string, additive: boolean, phase?: "down" | "click" | "tap") => void;
  onClear: () => void;
  onChange: (patches: NodePatch[], key: string) => void;
  onEditText: (id: string) => void;
  coarse: boolean;
  /** Mask mode: brushing and fade handles on this picture layer; nothing else can be picked or moved. */
  maskEdit?: MaskEdit | null;
  /** Animate: the moment of motion to draw (layers still move and resize at their saved place). */
  motion?: Map<string, MotionState> | null;
}) {
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [guides, setGuides] = useState<Guide[]>([]);

  const byId = useMemo(() => new Map(scene.nodes.map((n) => [n.id, n])), [scene.nodes]);
  const selNodes = maskEdit ? [] : selected.map((id) => byId.get(id)).filter((n): n is FlyerNode => !!n && n.visible);
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

  const act: Interact = { interactive: !maskEdit, canMove, onSelect, onEditText };

  function readPatches(): NodePatch[] {
    const stage = stageRef.current;
    if (!stage) return [];
    return selNodes.flatMap((n) => {
      const k = stage.findOne(`#${n.id}`);
      if (!k) return [];
      const sx = k.scaleX();
      const sy = k.scaleY();
      const patch: Partial<FlyerNode> = { x: Math.round(k.x() * 10) / 10, y: Math.round(k.y() * 10) / 10, rotation: Math.round(k.rotation() * 10) / 10 };
      if (n.kind === "image" || n.kind === "shape") {
        patch.width = Math.max(8, Math.round(n.width * sx));
        patch.height = Math.max(8, Math.round(n.height * sy));
      } else if (n.arc) {
        // Curved text: the box turns around its centre; resizing changes the width, and the letters and curve with the height.
        const w = Math.max(20, Math.round(n.width * sx));
        const tp = patch as Partial<TextNode>;
        tp.width = w;
        let size = n.fontSize;
        let arc = n.arc;
        if (Math.abs(sy - 1) > 0.001) {
          size = Math.max(6, Math.round(n.fontSize * sy * 10) / 10);
          arc = Math.round(n.arc * sy * 10) / 10;
          tp.fontSize = size;
          tp.arc = arc;
          if (n.minFontSize) tp.minFontSize = Math.max(6, Math.round(n.minFontSize * sy * 10) / 10);
        }
        const bh = arcGeometry(w, size, arc, n.padding ?? 0).boxHeight;
        tp.height = bh;
        patch.x = Math.round((k.x() - w / 2) * 10) / 10;
        patch.y = Math.round((k.y() - bh / 2) * 10) / 10;
      } else {
        const pad = n.padding ?? 0;
        // Stretched text carries its stretch as scaleX: only the change beyond it is a resize.
        const st = n.stretch ?? 1;
        const w = Math.max(20, Math.round((k as Konva.Text).width() * sx + pad * 2 * (sx / st)));
        patch.width = w;
        const tp = patch as Partial<TextNode>;
        if (Math.abs(sy - 1) > 0.001) {
          tp.fontSize = Math.max(6, Math.round(n.fontSize * sy * 10) / 10);
          if (n.minFontSize) tp.minFontSize = Math.max(6, Math.round(n.minFontSize * sy * 10) / 10);
          if (n.fitBox) tp.height = Math.max(8, Math.round(n.height * sy));
        }
        if (n.pivot === "center") {
          // k.x/k.y is the box centre (the pivot): keep it, and store the box's top-left.
          const bh = n.fitBox ? (tp.height ?? n.height) : ((k as Konva.Text).height() + pad * 2) * sy;
          patch.x = Math.round((k.x() - w / 2) * 10) / 10;
          patch.y = Math.round((k.y() - bh / 2) * 10) / 10;
        }
      }
      k.scaleX(n.kind === "text" && !n.arc ? (n.stretch ?? 1) : 1);
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
      onMouseDown={(e) => !maskEdit && e.target === e.target.getStage() && onClear()}
      onTouchStart={(e) => {
        if (!maskEdit && e.evt.touches.length === 1 && e.target === e.target.getStage()) onClear();
      }}
      onTouchMove={onTouchMove}
      style={{ touchAction: "none", cursor: maskEdit ? (maskEdit.tool === "fade" ? "crosshair" : "none") : undefined }}
    >
      <Layer
        onDragMove={onDragMove}
        onDragEnd={() => {
          setGuides([]);
          const p = readPatches();
          if (p.length) onChange(p, `drag:${selected.join(",")}`);
        }}
      >
        <SceneNodes scene={scene} ctx={ctx} exporting={false} act={act} fontsKey={fontsKey} motion={motion} />
        <Transformer
          ref={trRef}
          rotateEnabled={allMovable}
          resizeEnabled={allMovable}
          enabledAnchors={anchors}
          keepRatio={single?.kind === "shape" ? single.keepRatio : single?.kind !== "image"}
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
            if (single?.kind === "text" && !single.arc && k && (anchor === "middle-left" || anchor === "middle-right")) {
              // Keep the left edge where the handle put it while the width (not the letters) changes.
              const before = k.getTransform().point({ x: 0, y: k.offsetY() });
              k.width(Math.max(20, k.width() * k.scaleX()));
              k.scaleX(1);
              if (single.pivot === "center") k.offsetX((k.width() + (single.padding ?? 0) * 2) / 2 - (single.padding ?? 0));
              const after = k.getTransform().point({ x: 0, y: k.offsetY() });
              k.x(k.x() + before.x - after.x);
              k.y(k.y() + before.y - after.y);
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
      {maskEdit && <MaskTools stageRef={stageRef} edit={maskEdit} ctx={ctx} zoom={zoom} />}
    </Stage>
  );
}

/* ---------------- export ---------------- */

/**
 * Draws the flyer off screen at its real size (1080 wide) once every font
 * and image has loaded, then hands back the PNG/JPEG. Uses the same layer
 * drawing as the editor, so the export matches what's on screen.
 */
export function ExportStage({ scene, ctx: ctxIn, mime, quality, onDone, pixelRatio = 1 }: { scene: Scene; ctx: SrcContext; mime: "image/png" | "image/jpeg"; quality: number; onDone: (blob: Blob | null, error?: string) => void; pixelRatio?: number }) {
  // Photo Effects render at the export's full resolution (textures and sizes scale with it).
  const ctx = useMemo(() => ({ ...ctxIn, fxScale: pixelRatio }), [ctxIn, pixelRatio]);
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
          // Same layers, fonts and layout as the editor; pixelRatio 2 = high-resolution (every text and shape redrawn sharp).
          const canvas = stage.toCanvas({ pixelRatio, x: 0, y: 0, width: scene.width, height: scene.height });
          if (canvas.width !== Math.round(scene.width * pixelRatio) || canvas.height !== Math.round(scene.height * pixelRatio)) return doneRef.current(null, "The export came out the wrong size.");
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
  }, [ready, settledTick, imageIds, mime, quality, scene.width, scene.height, scene.background, pixelRatio]);

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
export function ScenePreview({ scene, width, ctx, motion = null }: { scene: Scene; width: number; ctx?: SrcContext; /** Animate: one moment of the motion. */ motion?: Map<string, MotionState> | null }) {
  const [fontsKey, setFontsKey] = useState(0);
  useEffect(() => {
    let live = true;
    loadSceneFonts([scene]).then(() => live && setFontsKey((k) => k + 1));
    return () => {
      live = false;
    };
  }, [scene]);
  const z = width / scene.width;
  const small = useMemo(() => ({ ...(ctx ?? {}), fxScale: Math.max(0.1, z * 2) }), [ctx, z]);
  return (
    <Stage width={Math.round(scene.width * z)} height={Math.round(scene.height * z)} scaleX={z} scaleY={z} listening={false}>
      <Layer listening={false}>
        <SceneNodes scene={scene} ctx={small} exporting={false} act={null} fontsKey={fontsKey} motion={motion} />
      </Layer>
    </Stage>
  );
}
