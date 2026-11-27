"use client";

import { THUMB_SAMPLE } from "@/lib/flyers/sample-assets";
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import KonvaLib from "konva";
import { Eye, Loader2, RotateCcw, Save, Sparkles, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { imageLayout } from "@/lib/flyers/scene";
import { processedImage } from "@/lib/flyers/feather";
import { CONTROL_INFO, NEEDS_CUTOUT, PRESETS, cutoutShare, effectsOn, newEffects, presetById, resolveParams, type ControlKey, type Params, type PhotoEffects, type PresetId } from "@/lib/flyers/effects";
import type { FlyerNode, ImageNode, Scene } from "@/lib/flyers/types";
import { srcFor, useImage, type SrcContext } from "./loaders";
import { runEffects } from "./fx-runner";
import { fxStatusOf, subscribeFx } from "./fx-status";

export type FxApi = {
  ctx: SrcContext;
  editing: boolean;
  /** The settings being adjusted (null = no effect); undefined when not editing. */
  draft: PhotoEffects | null | undefined;
  /** The layers the effect goes on (ticked in the Effects tab, else the selection). */
  targets: string[];
  setTargets: (ids: string[] | null) => void;
  start: () => void;
  change: (fx: PhotoEffects | null) => void;
  apply: () => void;
  cancel: () => void;
  hold: (on: boolean) => void;
  /** Commit right away (Remove effects outside the editor). */
  quick: (ids: string[], fx: PhotoEffects | null) => void;
};

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1";
const btn = cn("inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-[8px] border border-black/10 bg-white px-2.5 text-xs text-foreground hover:border-gold disabled:pointer-events-none disabled:opacity-40", FOCUS);
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted";
const GROUPS: { key: "tone" | "color" | "texture" | "mask"; title: string }[] = [
  { key: "tone", title: "Light" },
  { key: "color", title: "Color" },
  { key: "texture", title: "Texture" },
  { key: "mask", title: "Cutout & fade" }
];

/** Photos only: not logos, name logos or decorative overlays. */
export const isPhotoLayer = (n: ImageNode) => n.source.type === "dj_photo" || (n.role !== "logo" && n.role !== "dj_logo" && n.role !== "overlay" && n.source.type !== "venue_logo" && n.source.type !== "dj_logo" && n.source.type !== "none");

function useFxStatus(id: string) {
  return useSyncExternalStore(
    subscribeFx,
    () => fxStatusOf(id),
    () => null
  );
}

/** A small copy of the first chosen layer (a photo as framed, or text / a shape as drawn) for the preset thumbnails. */
function useThumbBase(layer: FlyerNode, ctx: SrcContext) {
  const n = layer as ImageNode;
  const isImg = layer.kind === "image";
  const { img, status } = useImage(isImg ? srcFor(n.source, ctx) : null);
  const [drawn, setDrawn] = useState<{ id: string; c: HTMLCanvasElement } | null>(null);
  useEffect(() => {
    if (isImg) return;
    // Text and shapes: copy the layer off the canvas without its effects.
    const raf = requestAnimationFrame(() => {
      const k = KonvaLib.stages.map((st) => st.findOne(`#${layer.id}`)).find(Boolean);
      if (!k) return;
      const copy = k.clone({ x: 0, y: 0, rotation: 0, opacity: 1 });
      copy.clearCache();
      copy.filters([]);
      const r = copy.getClientRect({ skipTransform: false });
      const scale = 132 / Math.max(1, Math.max(r.width, r.height));
      try {
        setDrawn({ id: layer.id, c: copy.toCanvas({ pixelRatio: scale, x: r.x, y: r.y, width: r.width, height: r.height }) });
      } catch {
        // nothing to draw
      }
      copy.destroy();
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.id, isImg, (layer as { text?: string }).text]);
  const imgBase = useMemo(() => {
    if (!isImg || !img) return null;
    const lay = imageLayout(n, { width: img.naturalWidth, height: img.naturalHeight }, n.fit, n.crop);
    const scale = 132 / Math.max(n.width, n.height);
    return processedImage(img, n, lay, n.flipX, n.flipY, n.feather ?? { amount: 0, shape: "edges" }, n.recolor, { scale, withFeather: false, mask: { mask: n.mask, natural: { width: img.naturalWidth, height: img.naturalHeight }, owner: `${n.id}~thumb` } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, isImg, n.width, n.height, n.fit, n.crop?.zoom, n.crop?.x, n.crop?.y, n.flipX, n.flipY, n.recolor?.mode, n.recolor?.color, n.recolor?.knockoutWhite, n.mask]);
  const base = isImg ? imgBase : drawn?.id === layer.id ? drawn.c : null;
  const cutout = useMemo(() => {
    if (!base) return false;
    const d = base.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, base.width, base.height);
    return cutoutShare({ data: d.data, width: d.width, height: d.height }) > 0.02;
  }, [base]);
  return { base, status: isImg ? status : base ? "ready" : "loading", cutout, scale: 132 / Math.max(layer.width, layer.height) };
}

/**
 * The sample the preset cards all use: dj-01 (a cutout) over charcoal-studio,
 * as two layers (same subject and crop on every card). The effect runs on the
 * portrait layer, as it does on a flyer, then sits over the background.
 */
const SAMPLE_W = 192;
const SAMPLE_H = 240;
const FX_THUMB_V = 2;
/** 4:5 crop of the 627 px square sample, centred on the subject. */
const SRC_CROP = { x: 63, y: 0, w: 501, h: 627 };
function loadImg(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function cropped(img: HTMLImageElement) {
  const c = document.createElement("canvas");
  c.width = SAMPLE_W;
  c.height = SAMPLE_H;
  c.getContext("2d")!.drawImage(img, SRC_CROP.x, SRC_CROP.y, SRC_CROP.w, SRC_CROP.h, 0, 0, SAMPLE_W, SAMPLE_H);
  return c;
}
let sampleLayers: Promise<{ portrait: HTMLCanvasElement; background: HTMLCanvasElement }> | null = null;
function sampleCanvases() {
  sampleLayers ??= Promise.all([loadImg(THUMB_SAMPLE.portrait), loadImg(THUMB_SAMPLE.background)]).then(([p, b]) => ({ portrait: cropped(p), background: cropped(b) }));
  return sampleLayers;
}
/** The processed portrait layer over the background layer. */
function composite(background: HTMLCanvasElement, portrait: HTMLCanvasElement) {
  const c = document.createElement("canvas");
  c.width = SAMPLE_W;
  c.height = SAMPLE_H;
  const g = c.getContext("2d")!;
  g.drawImage(background, 0, 0);
  g.drawImage(portrait, 0, 0, SAMPLE_W, SAMPLE_H);
  return c.toDataURL("image/webp", 0.85);
}
const fxThumbs = new Map<string, string>();
function cachedThumb(id: string) {
  if (fxThumbs.has(id)) return fxThumbs.get(id)!;
  try {
    const v = localStorage.getItem(`dcdj-fxthumb-v${FX_THUMB_V}:${id}`);
    if (v) fxThumbs.set(id, v);
    return v;
  } catch {
    return null;
  }
}

/**
 * Preset cards: each preset on the same sample DJ portrait, at its shipping
 * defaults, made by the real effect code (cached in this browser). Picking
 * one shows it on your own photo on the canvas, with "View original" to
 * compare, before you apply it.
 */
function Thumbs({ value, onPick }: { base?: HTMLCanvasElement | null; scale?: number; seed?: number; value: PresetId | null; onPick: (p: PresetId | null) => void }) {
  const [urls, setUrls] = useState<Record<string, string>>(() => Object.fromEntries(["none", ...PRESETS.map((p) => p.id)].map((id) => [id, cachedThumb(id) ?? ""]).filter(([, v]) => v)));
  useEffect(() => {
    let live = true;
    (async () => {
      const layers = await sampleCanvases().catch(() => null);
      if (!layers || !live) return;
      const base = layers.portrait;
      const put = (id: string, url: string) => {
        fxThumbs.set(id, url);
        try {
          localStorage.setItem(`dcdj-fxthumb-v${FX_THUMB_V}:${id}`, url);
        } catch {
          // storage full: kept for this visit
        }
        setUrls((m) => ({ ...m, [id]: url }));
      };
      if (!cachedThumb("none")) put("none", composite(layers.background, base));
      for (const p of PRESETS) {
        if (cachedThumb(p.id)) continue;
        try {
          // Same sizes as on a flyer, scaled down with the thumbnail (the sample is 960 px wide).
          const c = await runEffects(base, { ...newEffects(p.id, 7), strength: 1 }, SAMPLE_W / 960);
          if (!live) return;
          put(p.id, composite(layers.background, c));
        } catch {
          // leave the tile on its label
        }
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  const map = urls;
  const tiles: { id: PresetId | null; name: string }[] = [{ id: null, name: "Original" }, ...PRESETS.map((p) => ({ id: p.id, name: p.name }))];
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0" role="radiogroup" aria-label="Effect presets" data-tour="fx-presets">
      {tiles.map((t) => {
        const url = map[t.id ?? "none"];
        const on = value === t.id;
        return (
          <button key={t.id ?? "none"} role="radio" aria-checked={on} onClick={() => onPick(t.id)} className={cn("group flex w-[84px] shrink-0 flex-col overflow-hidden rounded-[8px] border bg-white text-left lg:w-auto", on ? "border-gold ring-2 ring-gold/50" : "border-black/10 hover:border-gold", FOCUS)}>
            <span className="relative block aspect-[4/5] w-full bg-[repeating-conic-gradient(#ece8e0_0%_25%,#f7f4ee_0%_50%)] bg-[length:12px_12px]">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="absolute inset-0 h-full w-full object-contain" />
              ) : (
                <Loader2 size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-muted" />
              )}
            </span>
            <span className="truncate px-1.5 py-1 text-[10.5px] leading-tight">{t.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function Ctrl({ k, value, onChange, disabled }: { k: ControlKey; value: number | string | boolean; onChange: (v: number | string | boolean) => void; disabled?: boolean }) {
  const id = useId();
  const info = CONTROL_INFO[k];
  if (info.kind === "bool")
    return (
      <label className={cn("flex min-h-8 cursor-pointer items-center gap-2 text-sm", disabled && "opacity-50")}>
        <input type="checkbox" className={cn("h-4 w-4 accent-[#c99428]", FOCUS)} checked={!!value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        {info.label}
      </label>
    );
  if (info.kind === "color")
    return (
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs">
          {info.label}
        </label>
        <input id={id} type="color" className={cn("h-8 w-12 cursor-pointer rounded border border-black/12 bg-white p-0.5", FOCUS)} value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={labelCls}>
          {info.label}
        </label>
        <span className="text-[11px] tabular-nums text-muted">
          {Math.round(Number(value))}
          {info.unit ?? ""}
        </span>
      </div>
      <input id={id} type="range" className={cn("w-full accent-[#c99428]", FOCUS)} min={info.min} max={info.max} step={info.step ?? 1} value={Number(value)} disabled={disabled} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

type Saved = { id: string; name: string; effects: PhotoEffects };

/**
 * "Photo effects" for a selected photo layer: preset thumbnails made from
 * the photo, overall strength, the preset's own controls, press-and-hold
 * View original, Reset, saved presets, and Apply / Cancel (one undo step).
 */
export function PhotoEffectsSection({ nodes, api, canStyle }: { nodes: FlyerNode[]; api: FxApi; canStyle: boolean }) {
  const n = nodes[0];
  const status = useFxStatus(n.id);
  const looks = new Set(nodes.map((x) => (x.effects && effectsOn(x.effects) ? `${x.effects.custom ?? presetById(x.effects.preset)?.name} · ${Math.round(x.effects.strength * 100)}%` : "")));
  const current = n.effects && effectsOn(n.effects) ? n.effects : null;
  const anyOn = nodes.some((x) => x.effects && effectsOn(x.effects));

  if (!api.editing)
    return (
      <div className="flex flex-col gap-2" data-tour="fx-section">
        {anyOn ? (
          <p className="text-sm">{looks.size > 1 ? "These layers have different looks; adjusting gives them all the same one." : <span className="font-semibold">{[...looks][0] || "No effect"}</span>}</p>
        ) : (
          <p className="text-[11px] text-muted">Color grades, duotones, print and VHS looks. The layers themselves stay as they are; the look is a setting you can change or remove.</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <button className={cn(btn, "flex-1")} disabled={!canStyle} onClick={() => api.start()} data-tour="fx-open">
            <Sparkles size={14} /> {current ? "Adjust effects" : "Add an effect"}
          </button>
          {anyOn && (
            <button className={btn} disabled={!canStyle} onClick={() => api.quick(nodes.map((x) => x.id), null)}>
              <RotateCcw size={14} /> Remove
            </button>
          )}
        </div>
        {status === "error" && <p className="text-[11px] text-[#b42318]">The effect couldn&rsquo;t be drawn; the photo shows without it.</p>}
      </div>
    );
  // Thumbnails come from a picture when one is chosen (they show the looks best), else the first layer.
  return <Editor n={nodes.find((x) => x.kind === "image") ?? n} api={api} canStyle={canStyle} status={status} />;
}

function Editor({ n, api, canStyle, status }: { n: FlyerNode; api: FxApi; canStyle: boolean; status: string | null }) {
  const fx = api.draft ?? null;
  const { base, status: imgStatus, cutout, scale } = useThumbBase(n, api.ctx);
  const [seed] = useState(() => fx?.seed ?? Math.floor(Math.random() * 2 ** 31));
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [saveName, setSaveName] = useState("");
  const [savingOpen, setSavingOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/flyers/effect-presets")
      .then((r) => (r.ok ? r.json() : { presets: [] }))
      .then((j) => setSaved(j.presets ?? []))
      .catch(() => setSaved([]));
  }, []);

  const preset = fx ? presetById(fx.preset) : null;
  const P = fx ? resolveParams(fx) : null;
  const setParam = (k: keyof Params, v: number | string | boolean) => fx && api.change({ ...fx, custom: null, params: { ...fx.params, [k]: v } });
  const pick = (id: PresetId | null) => api.change(id ? { ...newEffects(id, fx?.seed ?? seed), strength: fx?.strength ?? 1 } : null);

  async function savePreset() {
    if (!fx || !saveName.trim()) return;
    const r = await fetch("/api/flyers/effect-presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: saveName, effects: fx }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j.error ?? "Couldn't save the preset.");
    setSaved((s) => [{ id: j.preset.id, name: j.preset.name, effects: j.preset.effects }, ...(s ?? []).filter((x) => x.name !== j.preset.name)]);
    api.change({ ...fx, custom: j.preset.name });
    setSavingOpen(false);
    setSaveName("");
    setMsg(`Saved “${j.preset.name}”.`);
  }
  async function deletePreset(p: Saved) {
    const r = await fetch(`/api/flyers/effect-presets?id=${p.id}`, { method: "DELETE" });
    if (r.ok) setSaved((s) => (s ?? []).filter((x) => x.id !== p.id));
  }

  const hold = {
    onPointerDown: () => api.hold(true),
    onPointerUp: () => api.hold(false),
    onPointerLeave: () => api.hold(false),
    onPointerCancel: () => api.hold(false),
    onKeyDown: (e: React.KeyboardEvent) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), api.hold(true)),
    onKeyUp: () => api.hold(false),
    onBlur: () => api.hold(false)
  };

  return (
    <div className="flex flex-col gap-3" data-tour="fx-editor">
      {imgStatus === "failed" && <p className="text-[11px] text-[#b42318]">This photo couldn&rsquo;t be loaded, so there&rsquo;s nothing to apply effects to.</p>}
      {imgStatus === "none" && <p className="text-[11px] text-muted">Pick a photo for this layer first.</p>}
      <Thumbs base={base} scale={scale} seed={fx?.seed ?? seed} value={fx?.preset ?? null} onPick={pick} />

      {fx && preset && P && (
        <>
          <p className="text-[11px] text-muted">{preset.blurb}.</p>
          <div data-tour="fx-strength">
            <div className="flex items-center justify-between">
              <label htmlFor={`${n.id}-strength`} className={labelCls}>
                Strength
              </label>
              <span className="text-[11px] tabular-nums text-muted">{Math.round(fx.strength * 100)}%</span>
            </div>
            <input id={`${n.id}-strength`} type="range" min={0} max={100} value={Math.round(fx.strength * 100)} disabled={!canStyle} className={cn("w-full accent-[#c99428]", FOCUS)} onChange={(e) => api.change({ ...fx, strength: parseFloat(e.target.value) / 100 })} />
          </div>
          {GROUPS.map((g) => {
            const keys = preset.controls.filter((k) => CONTROL_INFO[k].group === g.key);
            if (!keys.length) return null;
            return (
              <details key={g.key} open={g.key !== "mask"} className="rounded-[8px] border border-black/8 px-2.5 py-2">
                <summary className={cn("cursor-pointer list-none text-[11px] font-semibold uppercase tracking-wide", FOCUS)}>{g.title}</summary>
                <div className="mt-2 flex flex-col gap-2.5">
                  {g.key === "mask" && !cutout && keys.some((k) => NEEDS_CUTOUT.includes(k)) && <p className="text-[11px] text-muted">Edge light, subject shadow and echoes use the subject&rsquo;s outline, so they need a cut-out photo (transparent background). They&rsquo;re skipped on this one.</p>}
                  {keys.map((k) =>
                    k === "fade" ? (
                      <div key={k} className="flex flex-col gap-2.5">
                        <Ctrl k="fade" value={fx.mask.fade} disabled={!canStyle} onChange={(v) => api.change({ ...fx, custom: null, mask: { ...fx.mask, fade: Number(v) } })} />
                        {fx.mask.fade > 0 && (
                          <div>
                            <div className="flex items-center justify-between">
                              <span className={labelCls}>Fade starts</span>
                              <span className="text-[11px] tabular-nums text-muted">{Math.round(fx.mask.fadeAt)}%</span>
                            </div>
                            <input aria-label="Fade starts" type="range" min={0} max={95} value={fx.mask.fadeAt} disabled={!canStyle} className={cn("w-full accent-[#c99428]", FOCUS)} onChange={(e) => api.change({ ...fx, custom: null, mask: { ...fx.mask, fadeAt: parseFloat(e.target.value) } })} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <Ctrl key={k} k={k} value={P[k as keyof Params]} disabled={!canStyle || (NEEDS_CUTOUT.includes(k) && !cutout)} onChange={(v) => setParam(k as keyof Params, v)} />
                    )
                  )}
                </div>
              </details>
            );
          })}
          {preset.controls.includes("edgeOn") && <p className="text-[11px] text-muted">Edge light is drawn from the cutout&rsquo;s outline. It imitates a rim light; it doesn&rsquo;t relight the photo.</p>}
        </>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} {...hold} disabled={!fx} aria-label="View original (hold)" data-tour="fx-original">
          <Eye size={14} /> Hold to view original
        </button>
        <button type="button" className={btn} disabled={!fx} onClick={() => api.change(null)}>
          <RotateCcw size={14} /> Reset effects
        </button>
      </div>

      {/* Saved presets */}
      <div className="rounded-[8px] border border-black/8 px-2.5 py-2" data-tour="fx-saved">
        <p className="text-[11px] font-semibold uppercase tracking-wide">My presets</p>
        {saved === null ? (
          <p className="mt-1 text-[11px] text-muted">Loading…</p>
        ) : saved.length ? (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {saved.map((p) => (
              <li key={p.id} className="flex items-center overflow-hidden rounded-full border border-black/10 bg-white text-xs">
                <button className={cn("px-2.5 py-1 hover:text-gold", FOCUS, fx?.custom === p.name && "font-semibold text-gold")} onClick={() => api.change({ ...p.effects, custom: p.name })}>
                  {p.name}
                </button>
                <button aria-label={`Delete ${p.name}`} className={cn("px-1.5 py-1 text-muted hover:text-[#b42318]", FOCUS)} onClick={() => void deletePreset(p)}>
                  <Trash2 size={11} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[11px] text-muted">Save a look you like to use it on other photos.</p>
        )}
        {fx &&
          (savingOpen ? (
            <div className="mt-2 flex gap-1.5">
              <input value={saveName} onChange={(e) => setSaveName(e.target.value)} maxLength={40} placeholder="Preset name" aria-label="Preset name" className={cn("min-w-0 flex-1 rounded-[8px] border border-black/12 bg-white px-2.5 py-1.5 text-sm", FOCUS)} />
              <button className={btn} disabled={!saveName.trim()} onClick={() => void savePreset()}>
                Save
              </button>
              <button className={btn} aria-label="Cancel" onClick={() => setSavingOpen(false)}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <button className={cn(btn, "mt-2")} onClick={() => setSavingOpen(true)}>
              <Save size={14} /> Save as preset
            </button>
          ))}
        {msg && <p className="mt-1 text-[11px] text-muted">{msg}</p>}
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-2 border-t border-black/8 bg-[var(--card,#fff)] px-1 py-2.5">
        <button className={cn(btn, "flex-1 border-gold bg-gold text-[#1a140a] hover:brightness-105")} disabled={!canStyle} onClick={api.apply} data-tour="fx-apply">
          Apply
        </button>
        <button className={cn(btn, "flex-1")} onClick={api.cancel}>
          Cancel
        </button>
        <span className="w-20 text-right text-[11px] text-muted" aria-live="polite">
          {status === "working" ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Applying
            </span>
          ) : status === "error" ? (
            <span className="text-[#b42318]">Couldn&rsquo;t draw</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = { image: "Picture", text: "Text", shape: "Shape" };

/**
 * The Effects tab in the editor's left panel: choose which layers get the
 * look (any layers, or Include all), then the look itself.
 */
export function EffectsTab({ scene, api, canStyle }: { scene: Scene; api: FxApi; canStyle: (n: FlyerNode) => boolean }) {
  const layers = [...scene.nodes].reverse(); // top of the list = front, like Layers
  const allowed = layers.filter((n) => canStyle(n));
  const chosen = layers.filter((n) => api.targets.includes(n.id));
  const all = allowed.length > 0 && allowed.every((n) => api.targets.includes(n.id));
  const toggle = (id: string, on: boolean) => api.setTargets(on ? [...api.targets.filter((x) => x !== id), id] : api.targets.filter((x) => x !== id));
  return (
    <div className="flex flex-col gap-3" data-tour="fx-tab">
      <fieldset className="rounded-[8px] border border-black/8 px-2.5 py-2" data-tour="fx-layers">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide">Apply to</legend>
        <label className="flex min-h-8 cursor-pointer items-center gap-2 border-b border-black/8 pb-1.5 text-sm font-semibold">
          <input
            type="checkbox"
            className={cn("h-4 w-4 accent-[#c99428]", FOCUS)}
            checked={all}
            ref={(el) => {
              if (el) el.indeterminate = !all && chosen.length > 0;
            }}
            disabled={!allowed.length}
            onChange={(e) => api.setTargets(e.target.checked ? allowed.map((n) => n.id) : [])}
          />
          Include all layers
        </label>
        <ul className="mt-1 flex max-h-56 flex-col overflow-y-auto">
          {layers.map((n) => {
            const on = api.targets.includes(n.id);
            const fx = n.effects && effectsOn(n.effects) ? n.effects : null;
            return (
              <li key={n.id}>
                <label className={cn("flex min-h-8 cursor-pointer items-center gap-2 text-sm", !canStyle(n) && "cursor-not-allowed opacity-50")}>
                  <input type="checkbox" className={cn("h-4 w-4 accent-[#c99428]", FOCUS)} checked={on} disabled={!canStyle(n)} onChange={(e) => toggle(n.id, e.target.checked)} />
                  <span className="min-w-0 flex-1 truncate">{n.name}</span>
                  <span className="shrink-0 text-[10.5px] text-muted">{fx ? (fx.custom ?? presetById(fx.preset)?.name) : KIND_LABEL[n.kind]}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {allowed.length < layers.length && <p className="mt-1 text-[11px] text-muted">Greyed-out layers are styled by the template.</p>}
      </fieldset>
      {chosen.length ? (
        <>
          <p className="text-sm font-semibold">{chosen.length === 1 ? chosen[0].name : `${chosen.length} layers`}</p>
          <PhotoEffectsSection nodes={chosen} api={api} canStyle={chosen.every((n) => canStyle(n))} />
        </>
      ) : (
        <p className="text-[11px] text-muted">Tick the layers you want the effect on (or Include all), or select one on the flyer.</p>
      )}
    </div>
  );
}
