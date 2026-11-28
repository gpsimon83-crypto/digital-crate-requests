"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type Konva from "konva";
import { Layer, Stage } from "react-konva";
import { ScenePreview, SceneNodes } from "../flyer-canvas";
import { loadSceneFonts, type SrcContext } from "../loaders";
import { loadRasterImage } from "../motion-wrap";
import { newImage, newText } from "@/lib/flyers/scene";
import { ECHO_SAMPLE, THUMB_SAMPLE } from "@/lib/flyers/sample-assets";
import type { FlyerNode, Scene } from "@/lib/flyers/types";
import { PRESET_BY_ID, imagesUsed, type Preset } from "@/lib/flyers/motion/presets";
import { evaluateFrame, frameCount, frameTime } from "@/lib/flyers/motion/engine";
import { newItem } from "@/lib/flyers/motion/recipes";
import { RASTER_IMAGES } from "@/lib/flyers/motion/raster";
import { emptyAnimation, type Animation, type MotionItem, type MotionState } from "@/lib/flyers/motion/types";

/**
 * Photo thumbnails for the effect picker. Every card is the same sample DJ
 * portrait, same crop, with the real effect at its shipping defaults,
 * rendered by the same engine and drawing code as the preview and the
 * export (not a CSS imitation). Each is drawn once in the background at a
 * representative moment, cached (memory + this browser), and plays on
 * hover or keyboard focus.
 */

/** The sample: dj-01 (a cutout) over charcoal-studio, as two separate layers. Bump THUMB_V when it changes. */
const SAMPLE_PORTRAIT = THUMB_SAMPLE.portrait;
const SAMPLE_BACKDROP = THUMB_SAMPLE.background;
const THUMB_V = 7;
const W = THUMB_SAMPLE.size;
const H = THUMB_SAMPLE.size;
const SIZE = { width: W, height: H };
/** The part of the sample every card shows: the face and shoulders (about the card's shape). */
const CROP = { x: 0, y: 24, w: 627, h: 300 };

export const SAMPLE_IDS = { bg: "s-bg", dj: "s-dj", title: "s-title" };

const sampleCache = new Map<string, Scene>();
/** The sample flyer the thumbnails use (with a headline only where an effect needs one). */
export function sampleScene(withTitle: boolean | "echo" = false): Scene {
  const key = withTitle === "echo" ? "e" : withTitle ? "t" : "-";
  const hit = sampleCache.get(key);
  if (hit) return hit;
  if (withTitle === "echo") {
    // Echo cards: the same portrait and background, the portrait smaller so the echoes have room.
    const P = ECHO_SAMPLE.portrait;
    const ebg = newImage("background", { type: "static", src: SAMPLE_BACKDROP }, SIZE, { id: SAMPLE_IDS.bg, name: "Background", locked: false, x: 0, y: ECHO_SAMPLE.backgroundY, width: W, height: H, fit: "cover" });
    const edj = newImage("portrait", { type: "static", src: SAMPLE_PORTRAIT }, SIZE, { id: SAMPLE_IDS.dj, name: "DJ photo", x: P.x, y: P.y, width: P.w, height: P.h, fit: "contain" });
    const esc = { version: 1, format: "portrait", width: ECHO_SAMPLE.width, height: ECHO_SAMPLE.height, background: "#1c1c1c", safeMargin: 16, nodes: [ebg, edj] } as Scene;
    sampleCache.set(key, esc);
    return esc;
  }
  const bg = newImage("background", { type: "static", src: SAMPLE_BACKDROP }, SIZE, { id: SAMPLE_IDS.bg, name: "Background", locked: false, x: 0, y: 0, width: W, height: H, fit: "cover" });
  const title = newText("title", SIZE, { id: SAMPLE_IDS.title, name: "Headline", text: "DJ NIGHT", x: 20, y: 60, width: 587, height: 150, fontSize: 130, fill: "#f4eee2", align: "center", uppercase: true, minFontSize: 50 });
  const dj = newImage("portrait", { type: "static", src: SAMPLE_PORTRAIT }, SIZE, { id: SAMPLE_IDS.dj, name: "DJ photo", x: 0, y: 0, width: W, height: H, fit: "contain" });
  // Cropped to the card's view: every node shifted, so the thumbnails and the hover previews match exactly.
  const nodes = (withTitle ? [bg, title, dj] : [bg, dj]).map((n) => ({ ...n, x: n.x - CROP.x, y: n.y - CROP.y }) as FlyerNode);
  const sc = { version: 1, format: "portrait", width: CROP.w, height: CROP.h, background: "#1c1c1c", safeMargin: 16, nodes } as Scene;
  sampleCache.set(key, sc);
  return sc;
}
const sceneFor = (p: Preset | undefined) => sampleScene(p?.category === "echo" ? "echo" : p?.id === "text.occlude");

/** Which sample layer shows a preset best. */
export function thumbTarget(p: Preset): string {
  if (p.id === "text.occlude") return SAMPLE_IDS.title;
  if (p.category === "backgrounds") return SAMPLE_IDS.bg;
  const node = sampleScene().nodes.find((n) => n.id === SAMPLE_IDS.dj)!;
  if (p.fits(node, "portrait") === true) return SAMPLE_IDS.dj;
  const bg = sampleScene().nodes.find((n) => n.id === SAMPLE_IDS.bg)!;
  if (p.fits(bg, "background") === true) return SAMPLE_IDS.bg;
  return SAMPLE_IDS.title;
}

/** The effect alone on its sample layer, at its shipping defaults. */
export function thumbAnim(p: Preset, item?: MotionItem): Animation {
  const it = item ?? newItem(p.id);
  if (p.needs === "occluder") it.opts = { ...(it.opts ?? {}), occluder: SAMPLE_IDS.dj };
  // The lock is off for samples: the headline isn't an event detail.
  return { ...emptyAnimation(), readableLock: false, layers: { [thumbTarget(p)]: { stack: [it] } } };
}

/** How much a frame shows the effect (for choosing the representative frame). */
function magnitude(st: MotionState | undefined) {
  if (!st) return 0;
  let m = Math.abs(st.dx) + Math.abs(st.dy) + Math.abs(st.scale - 1) * 600 + (1 - st.opacity) * 300 + Math.abs(st.rotate) * 10;
  if (st.inner) m += Math.abs(st.inner.scale - 1) * 600 + Math.abs(st.inner.dx) + Math.abs(st.inner.dy);
  if (st.reveal) m += Math.min(st.reveal.amount, 1 - st.reveal.amount) * 300;
  m += st.trackingEm * 800 + (st.shadow ? Math.hypot(st.shadow.dx, st.shadow.dy) : 0);
  for (const o of st.overlays) m += o.kind === "particles" ? o.items.reduce((a, p) => a + p.a, 0) * 4 : o.kind === "sweep" ? (o.pos > 0.2 && o.pos < 0.8 ? o.alpha * 300 : 0) : o.alpha * 300;
  if (st.echo) m += 1;
  for (const r of st.raster) {
    if (r.kind === "slices") m += r.bands.reduce((a, b) => a + Math.abs(b.dx), 0) * 0.5;
    else if (r.kind === "rgb") m += (Math.abs(r.rdx) + Math.abs(r.bdx)) * 6;
    else if (r.kind === "rowwave") m += Math.abs(r.amp) * 3;
    else if (r.kind === "refract") m += (r.disp + r.disperse) * (r.window ? 1 - Math.min(1, Math.abs(r.window.centre - 0.5) * 2) : 1) * 8;
    else if (r.kind === "shine") m += r.pos > 0.1 && r.pos < 0.9 ? r.alpha * 300 : 0;
    else if (r.kind === "wipe") m += Math.min(r.amount, 1 - r.amount) * 300 + 20;
    else if (r.kind === "double") m += r.opacity * 300;
    else if (r.kind === "noise") m += r.amount * 200;
    else if (r.kind === "scan") m += r.alpha * 100;
  }
  return m;
}

/** The moment (seconds) that shows the effect most clearly: its strongest frame. */
export function representativeTime(scene: Scene, anim: Animation, target: string) {
  const N = frameCount(anim);
  let best = 0;
  let bestM = -1;
  for (let i = 0; i < N; i += 3) {
    const t = frameTime(anim, i);
    const m = magnitude(evaluateFrame(scene, anim, t).get(target));
    if (m > bestM + 1e-6) {
      bestM = m;
      best = t;
    }
  }
  return best;
}

/* ---------------- cache ---------------- */

const thumbs = new Map<string, string>();
const listeners = new Set<() => void>();
const storeKey = (id: string) => `dcdj-thumb-v${THUMB_V}:${id}`;
function getThumb(id: string) {
  if (thumbs.has(id)) return thumbs.get(id)!;
  try {
    const v = localStorage.getItem(storeKey(id));
    if (v) thumbs.set(id, v);
    return v;
  } catch {
    return null;
  }
}
function putThumb(id: string, url: string) {
  thumbs.set(id, url);
  try {
    localStorage.setItem(storeKey(id), url);
  } catch {
    // storage full or blocked: kept for this visit
  }
  listeners.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

/** A preset's cached photo thumbnail (data URL), or null while it's being drawn. */
export function useThumb(id: string) {
  return useSyncExternalStore(
    subscribe,
    () => getThumb(id),
    () => null
  );
}

/* ---------------- background renderer ---------------- */

const TW = 300;
const TH = Math.round((TW * CROP.h) / CROP.w);

/**
 * Draws missing thumbnails one at a time, off screen, and caches them.
 * Mounted while the library is open.
 */
export function ThumbFactory({ ids }: { ids: string[] }) {
  const todo = ids.filter((id) => PRESET_BY_ID.has(id) && !getThumb(id));
  const job = todo[0] ?? null;
  const scene = sceneFor(job ? PRESET_BY_ID.get(job) : undefined);
  const stage = useRef<Konva.Stage>(null);
  const status = useRef(new Map<string, boolean>());
  const [fontsKey, setFontsKey] = useState(0);
  const [, bump] = useState(0);
  useEffect(() => {
    let live = true;
    loadSceneFonts([sampleScene(true)]).then(() => live && setFontsKey((k) => k + 1));
    return () => {
      live = false;
    };
  }, []);
  const p = job ? PRESET_BY_ID.get(job)! : null;
  const anim = useMemo(() => (p ? thumbAnim(p) : null), [p]);
  const t = useMemo(() => (p && anim ? representativeTime(scene, anim, thumbTarget(p)) : 0), [p, anim, scene]);
  const motion = useMemo(() => (anim ? evaluateFrame(scene, anim, t) : null), [anim, scene, t]);
  const ctx = useMemo<SrcContext>(() => ({ fxScale: 0.5 }), []);
  useEffect(() => {
    if (!job || !anim || !fontsKey) return;
    let live = true;
    void (async () => {
      await Promise.all(imagesUsed(anim.layers).map(loadRasterImage));
      // Pictures in, then let the pixel effects re-draw.
      const start = performance.now();
      while (live && !(status.current.get(SAMPLE_IDS.bg) && status.current.get(SAMPLE_IDS.dj)) && performance.now() - start < 6000) await new Promise((r) => setTimeout(r, 60));
      await new Promise((r) => setTimeout(r, 420));
      if (!live || !stage.current) return;
      try {
        putThumb(job, stage.current.toDataURL({ pixelRatio: 1, mimeType: "image/webp", quality: 0.82 }));
      } catch {
        putThumb(job, "");
      }
      bump((x) => x + 1);
    })();
    return () => {
      live = false;
    };
  }, [job, anim, fontsKey]);
  if (!job) return null;
  return (
    <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, width: TW, height: TH, pointerEvents: "none", opacity: 0 }}>
      <Stage ref={stage} width={TW} height={TH} scaleX={TW / CROP.w} scaleY={TH / CROP.h} listening={false}>
        <Layer listening={false}>
          <SceneNodes scene={scene} ctx={ctx} exporting={false} act={null} fontsKey={fontsKey} motion={motion} onStatus={(id, done) => status.current.set(id, done)} />
        </Layer>
      </Stage>
    </div>
  );
}

/** The effect playing on the sample (hover / focus on a card). About 15 frames a second. */
export function LiveThumb({ id, width }: { id: string; width: number }) {
  const p = PRESET_BY_ID.get(id);
  const scene = sceneFor(p);
  const anim = useMemo(() => (p ? thumbAnim(p) : null), [p]);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!anim) return;
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (now - last > 66) {
        last = now;
        setT((((now - start) / 1000) % anim.duration) - (((now - start) / 1000) % anim.duration) % (1 / anim.fps));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anim]);
  const motion = useMemo(() => (anim ? evaluateFrame(scene, anim, t) : null), [anim, scene, t]);
  if (!anim) return null;
  return <ScenePreview scene={scene} width={width} motion={motion} />;
}

/* ---------------- Original / Effect, on the user's own layer ---------------- */

/** The flyer cropped to one layer's frame (with a little room), for a close comparison. */
export function cropTo(scene: Scene, node: FlyerNode, room = 0.08): Scene {
  const mx = node.width * room;
  const my = node.height * room;
  const x = Math.max(0, node.x - mx);
  const y = Math.max(0, node.y - my);
  const w = Math.min(scene.width - x, node.width + mx * 2);
  const h = Math.min(scene.height - y, node.height + my * 2);
  return { ...scene, width: Math.max(10, Math.round(w)), height: Math.max(10, Math.round(h)), nodes: scene.nodes.map((n) => ({ ...n, x: n.x - x, y: n.y - y }) as FlyerNode) };
}

/**
 * Before committing an effect: the selected layer as it is (Original) next
 * to the same layer with the effect (Effect), playing, on the user's own
 * picture or text. Nothing is added until Apply.
 */
export function Compare({ scene, node, ctx, base, item, width }: { scene: Scene; node: FlyerNode; ctx: SrcContext; base: Animation; item: MotionItem; width: number }) {
  // Echoes reach past the layer's frame: show more of the flyer around it.
  const room = PRESET_BY_ID.get(item.preset)?.category === "echo" ? 0.6 : 0.08;
  const crop = useMemo(() => cropTo(scene, node, room), [scene, node, room]);
  const anim = useMemo<Animation>(() => {
    const l = base.layers[node.id] ?? { stack: [] };
    return { ...base, layers: { [node.id]: { ...l, muted: false, solo: false, stack: [...l.stack.filter((x) => x.preset !== item.preset).slice(-3), item] } } };
  }, [base, node.id, item]);
  const [t, setT] = useState(() => representativeTime(crop, anim, node.id));
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    const start = performance.now() - t * 1000;
    const tick = (now: number) => {
      if (now - last > 50) {
        last = now;
        const s = ((now - start) / 1000) % anim.duration;
        setT(s - (s % (1 / anim.fps)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, anim]);
  const motion = useMemo(() => evaluateFrame(crop, anim, t), [crop, anim, t]);
  const half = Math.floor((width - 8) / 2);
  const ready = imagesUsed(anim.layers).every((s) => RASTER_IMAGES.has(s));
  useEffect(() => {
    void Promise.all(imagesUsed(anim.layers).map(loadRasterImage));
  }, [anim.layers]);
  return (
    <div className="grid grid-cols-2 gap-2" data-tour="animate-compare">
      <figure>
        <div className="overflow-hidden rounded-[10px] bg-black/40">
          <ScenePreview scene={crop} width={half} ctx={ctx} />
        </div>
        <figcaption className="mt-1 text-center text-[11px] text-[#8e9087]">Original</figcaption>
      </figure>
      <figure>
        <button className="block overflow-hidden rounded-[10px] bg-black/40" onClick={() => setPlaying((p) => !p)} title={playing ? "Pause" : "Play"} aria-label={playing ? "Pause the effect preview" : "Play the effect preview"}>
          <ScenePreview scene={crop} width={half} ctx={ctx} motion={ready ? motion : null} />
        </button>
        <figcaption className="mt-1 text-center text-[11px] text-[#c6f432]">Effect {playing ? "" : `(paused at ${t.toFixed(1)} s)`}</figcaption>
      </figure>
    </div>
  );
}
