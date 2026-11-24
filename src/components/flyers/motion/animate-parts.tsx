"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Diamond, Download, Eye, EyeOff, Film, Image as ImageIcon, Infinity as InfinityIcon, Layers, Lock, LockOpen, Magnet, Maximize2, Play, Redo2, RefreshCw, SlidersHorizontal, Trash2, Type, Undo2, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScenePreview } from "../flyer-canvas";
import type { SrcContext } from "../loaders";
import { FORMATS, FORMAT_KEYS, type FlyerNode, type FormatKey, type Scene } from "@/lib/flyers/types";
import { PRESET_BY_ID, isProtected, roleOf, type ParamKey } from "@/lib/flyers/motion/presets";
import { checkLoop, evaluateFrame, frameCount, frameTime, keyValues, type LoopReport } from "@/lib/flyers/motion/engine";
import { newItemId } from "@/lib/flyers/motion/recipes";
import { MAX_KEYS, type Animation, type Keyframe, type LayerMotion, type MotionItem } from "@/lib/flyers/motion/types";
import { DEFAULT_FRAMING, cutOff, framingFor, safeArea, type FormatFraming } from "@/lib/flyers/motion/formats";
import { VideoRenderer, type ExportProgress } from "./video-export";

/* ------------------------------------------------------------------ */
/* Look: dark workspace, lime accent (the Flyer Animator concept).     */
/* ------------------------------------------------------------------ */

export const T = {
  bg: "bg-[#0b0c0a]",
  panel: "rounded-[14px] border border-[#262722] bg-[#131411]",
  line: "border-[#262722]",
  text: "text-[#ecede4]",
  muted: "text-[#8e9087]",
  lime: "#c6f432",
  tile: "bg-[#1b1c18]",
  btn: "inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[#2e2f29] bg-[#1b1c18] px-2.5 text-xs text-[#ecede4] hover:border-[#c6f432]/60 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6f432]",
  icon: "inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#c9cbc0] hover:bg-[#22231e] hover:text-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6f432]",
  limeBtn: "inline-flex h-9 items-center gap-2 rounded-[10px] bg-[#c6f432] px-3.5 text-sm font-semibold text-[#10120a] hover:brightness-105 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
  input: "rounded-[8px] border border-[#2e2f29] bg-[#0f100d] px-2 py-1 text-xs text-[#ecede4] focus:border-[#c6f432] focus:outline-none",
  range: "accent-[#c6f432]"
};

/** Track colours, one per layer row (as in the concept). */
export const TRACK = ["#7b5cd6", "#8fbf1f", "#3b6fd8", "#c27a3c", "#2a9d8f", "#a64fc9", "#d0a52c", "#d4566b"];

export const fmt = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;
export const fmtFine = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

export function KindIcon({ n, size = 16 }: { n: FlyerNode; size?: number }) {
  if (n.kind === "text") return <Type size={size} aria-hidden />;
  if (n.role === "overlay") return <Layers size={size} aria-hidden />;
  return <ImageIcon size={size} aria-hidden />;
}
export const kindLabel = (n: FlyerNode) => (n.kind === "text" ? "Text" : n.role === "overlay" ? "Overlay" : n.role === "background" ? "Background image" : n.kind === "image" ? "Image" : "Shape");

export type SetLayer = (id: string, fn: (l: LayerMotion) => LayerMotion, label?: string, key?: string | null) => void;

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

/**
 * One track per layer: its on-screen bar (drag the ends), keyframes
 * (diamonds: click to edit, drag to move, double-click the bar to add),
 * and the playhead. Times snap to frames, and with the magnet on to
 * quarter seconds, the playhead and other keyframes.
 */
export function Timeline({
  nodes,
  anim,
  frame,
  N,
  selected,
  selectedKey,
  onSelect,
  onSelectKey,
  onSeek,
  setLayer,
  undo,
  redo,
  undoLabel,
  redoLabel,
  compact
}: {
  nodes: FlyerNode[];
  anim: Animation;
  frame: number;
  N: number;
  selected: string | null;
  selectedKey: string | null;
  onSelect: (id: string) => void;
  onSelectKey: (id: string | null) => void;
  onSeek: (f: number) => void;
  setLayer: SetLayer;
  undo: () => void;
  redo: () => void;
  undoLabel: string | null;
  redoLabel: string | null;
  compact: boolean;
}) {
  const [zoomT, setZoomT] = useState(1);
  const [snap, setSnap] = useState(true);
  const D = anim.duration;
  const fps = anim.fps;
  const playT = frame / fps;
  const toFrame = (t: number) => Math.round(t * fps) / fps;
  const snapT = (t: number, others: number[]) => {
    let v = Math.min(D - 1 / fps, Math.max(0, t));
    if (snap) {
      const near = [Math.round(v * 4) / 4, playT, ...others].reduce((best, c) => (Math.abs(c - v) < Math.abs(best - v) ? c : best), Infinity);
      if (Math.abs(near - v) < (D / zoomT) * 0.02) v = near;
    }
    return Math.min(D - 1 / fps, toFrame(v));
  };
  const timeAt = (e: { clientX: number }, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * D;
  };
  /** Pointer drag: move(t) on every move. Repeated changes share one undo key, so a drag is one undo step. */
  const drag = (e: React.PointerEvent, track: HTMLElement, move: (t: number) => void) => {
    e.preventDefault();
    e.stopPropagation();
    const mv = (ev: PointerEvent) => move(timeAt(ev, track));
    const up = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  };
  const addKey = (id: string, at?: number) => {
    const l = anim.layers[id] ?? { stack: [] };
    if (l.locked) return;
    const t = toFrame(at ?? playT);
    const same = l.keys?.find((k) => Math.abs(k.t - t) < 0.5 / fps);
    if (same) return onSelectKey(same.id);
    if ((l.keys?.length ?? 0) >= MAX_KEYS) return;
    const v = keyValues(l.keys, t, D) ?? { dx: 0, dy: 0, scale: 1, rotate: 0, opacity: 1, fx: 1 };
    const k: Keyframe = { id: newItemId(), t, ...v, easing: "easeInOut" };
    onSelect(id);
    onSelectKey(k.id);
    setLayer(id, (x) => ({ ...x, keys: [...(x.keys ?? []), k] }), "Add keyframe");
  };
  const minor = Array.from({ length: Math.floor(D * 4) + 1 }, (_, i) => i / 4);
  return (
    <section className={cn(T.panel, "flex min-h-0 flex-col")} aria-label="Timeline" data-tour="animate-timeline">
      <div className={cn("flex flex-wrap items-center gap-1 border-b px-3 py-2", T.line)}>
        <Film size={18} className="mr-1 text-[#c9cbc0]" aria-hidden />
        <h2 className="mr-3 text-[15px] font-semibold">Timeline</h2>
        <button className={T.icon} onClick={undo} disabled={!undoLabel} aria-label={undoLabel ? `Undo: ${undoLabel}` : "Undo"} title={undoLabel ? `Undo: ${undoLabel} (Ctrl/⌘ Z)` : "Nothing to undo"} data-tour="animate-undo">
          <Undo2 size={17} />
        </button>
        <button className={T.icon} onClick={redo} disabled={!redoLabel} aria-label={redoLabel ? `Redo: ${redoLabel}` : "Redo"} title={redoLabel ? `Redo: ${redoLabel}` : "Nothing to redo"}>
          <Redo2 size={17} />
        </button>
        {undoLabel && <span className={cn("hidden max-w-52 truncate text-[11px] md:inline", T.muted)}>Undo: {undoLabel}</span>}
        <span className={cn("mx-2 h-5 border-l", T.line)} />
        <button className={T.icon} onClick={() => setZoomT(1)} aria-label="Fit the whole loop" title="Fit the whole loop">
          <Maximize2 size={16} />
        </button>
        <button className={T.icon} onClick={() => setZoomT((z) => Math.max(1, z / 1.5))} disabled={zoomT <= 1} aria-label="Zoom timeline out">
          <ZoomOut size={17} />
        </button>
        <button className={T.icon} onClick={() => setZoomT((z) => Math.min(6, z * 1.5))} disabled={zoomT >= 6} aria-label="Zoom timeline in">
          <ZoomIn size={17} />
        </button>
        <span className={cn("ml-auto flex items-center gap-1.5")}>
          <button className={cn(T.btn, snap && "border-[#c6f432]/70 text-[#c6f432]")} onClick={() => setSnap((v) => !v)} aria-pressed={snap} title="Snap to ¼ seconds, the playhead and other keyframes">
            <Magnet size={13} /> Snap
          </button>
          <button className={T.btn} disabled={!selected || !!anim.layers[selected ?? ""]?.locked} onClick={() => selected && addKey(selected)} title="Add a keyframe for the selected layer at the playhead" data-tour="animate-add-key">
            <Diamond size={12} /> Keyframe
          </button>
        </span>
      </div>
      <div className={cn("flex min-h-0 flex-1 overflow-y-auto", compact ? "max-h-[15vh]" : "max-h-[20vh] [@media(min-height:900px)]:max-h-[24vh]")}>
        <div className="w-60 shrink-0 pl-3">
          <div className="h-9" />
          {nodes.map((n) => {
            const l = anim.layers[n.id] ?? { stack: [] };
            return (
              <div key={n.id} className={cn("group flex h-[30px] items-center gap-2 text-[13px]", selected === n.id && "text-[#c6f432]")}>
                <button
                  aria-label={`${l.hidden ? "Show" : "Hide"} ${n.name} in the video`}
                  title={l.hidden ? "Hidden in the video" : "Shown in the video"}
                  onClick={() => setLayer(n.id, (x) => ({ ...x, hidden: !x.hidden }), l.hidden ? "Show layer" : "Hide layer")}
                  className={l.hidden ? "text-[#6a6c64]" : "text-[#c6f432]"}
                >
                  {l.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <span className="text-[#c9cbc0]">
                  <KindIcon n={n} size={15} />
                </span>
                <button className="min-w-0 flex-1 truncate text-left" onClick={() => onSelect(n.id)}>
                  {n.name}
                </button>
                <span className="flex items-center gap-1 pr-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                  <button aria-label={`${l.locked ? "Unlock" : "Lock"} ${n.name}`} aria-pressed={!!l.locked} title={l.locked ? "Locked in Animate" : "Lock in Animate"} onClick={() => setLayer(n.id, (x) => ({ ...x, locked: !x.locked }), l.locked ? "Unlock layer" : "Lock layer")} className={l.locked ? "text-[#c6f432]" : T.muted}>
                    {l.locked ? <Lock size={13} /> : <LockOpen size={13} />}
                  </button>
                  <button aria-label={`${l.muted ? "Turn on" : "Turn off"} ${n.name}'s motion`} title={l.muted ? "Motion off" : "Turn motion off"} onClick={() => setLayer(n.id, (x) => ({ ...x, muted: !x.muted }), l.muted ? "Motion on" : "Motion off")} className={cn("w-4 text-[10px] font-bold", l.muted ? "text-[#ff6b6b]" : T.muted)}>
                    M
                  </button>
                  <button aria-label={`Solo ${n.name}`} aria-pressed={!!l.solo} title="Solo: only this layer moves" onClick={() => setLayer(n.id, (x) => ({ ...x, solo: !x.solo }), "Solo layer")} className={cn("w-4 text-[10px] font-bold", l.solo ? "text-[#c6f432]" : T.muted)}>
                    S
                  </button>
                </span>
                {l.locked && <Lock size={11} className="text-[#c6f432] group-hover:hidden" aria-hidden />}
              </div>
            );
          })}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto pr-3">
          <div style={{ width: `${zoomT * 100}%` }} className="relative min-w-[360px]">
            {/* Ruler: click or drag to move the playhead. */}
            <div
              className="relative h-9 cursor-pointer select-none text-[12px] text-[#c9cbc0]"
              onPointerDown={(e) => {
                const el = e.currentTarget;
                onSeek(Math.round((timeAt(e, el) / D) * N));
                drag(e, el, (t) => onSeek(Math.round((Math.min(D, Math.max(0, t)) / D) * N)));
              }}
            >
              {minor.map((s) => {
                const major = Math.abs(s % 2) < 1e-6 || Math.abs(s - D) < 1e-6;
                return (
                  <span key={s} className="absolute bottom-0" style={{ left: `${(s / D) * 100}%` }}>
                    {major && <span className={cn("absolute bottom-3 whitespace-nowrap", s === 0 ? "" : Math.abs(s - D) < 1e-6 ? "-translate-x-full" : "-translate-x-1/2")}>{s}s</span>}
                    <span className={cn("absolute bottom-0 border-l border-[#55574f]", major ? "h-3" : Number.isInteger(s) ? "h-2" : "h-1.5")} />
                  </span>
                );
              })}
            </div>
            {nodes.map((n, row) => {
              const l = anim.layers[n.id] ?? { stack: [] };
              const ws = l.window ? l.window.start : 0;
              const we = l.window ? l.window.end : D;
              const color = TRACK[row % TRACK.length];
              const locked = !!l.locked;
              return (
                <div
                  key={n.id}
                  className="relative h-[30px]"
                  onPointerDown={(e) => {
                    onSelect(n.id);
                    onSelectKey(null);
                    onSeek(Math.round((timeAt(e, e.currentTarget) / D) * N));
                  }}
                  onDoubleClick={(e) => addKey(n.id, timeAt(e, e.currentTarget))}
                  title="Click to move the playhead; double-click to add a keyframe here"
                >
                  {(ws < we ? [[ws, we]] : [[ws, D], [0, we]]).map(([a, b], i) => (
                    <span
                      key={i}
                      className={cn("absolute top-[5px] h-5 rounded-[6px]", selected === n.id && "ring-2 ring-white/70", (l.hidden || l.muted) && "opacity-35")}
                      style={{ left: `${(a / D) * 100}%`, width: `${((b - a) / D) * 100}%`, background: color }}
                      aria-hidden
                    />
                  ))}
                  {!locked &&
                    (["start", "end"] as const).map((edge) => (
                      <span
                        key={edge}
                        role="slider"
                        tabIndex={0}
                        aria-label={`${n.name} ${edge === "start" ? "comes on at" : "goes off at"}`}
                        aria-valuemin={0}
                        aria-valuemax={D}
                        aria-valuenow={edge === "start" ? ws : we}
                        title={edge === "start" ? "Drag: when the layer comes on screen" : "Drag: when it goes off"}
                        className="absolute top-[5px] z-10 h-5 w-2 -translate-x-1/2 cursor-ew-resize rounded-[3px] bg-white/0 hover:bg-white/60 focus-visible:bg-white/80"
                        style={{ left: `${((edge === "start" ? ws : we) / D) * 100}%` }}
                        onPointerDown={(e) => {
                          const track = e.currentTarget.parentElement!;
                          drag(e, track, (t) => {
                            const v = edge === "end" ? Math.min(D, snapT(t, [])) : snapT(t, []);
                            setLayer(
                              n.id,
                              (x) => {
                                const cur = x.window ?? { start: 0, end: D };
                                const next = edge === "start" ? { ...cur, start: v } : { ...cur, end: v <= 0 ? D : v };
                                return { ...x, window: next.start === 0 && next.end >= D ? undefined : next };
                              },
                              "Change on-screen time",
                              `win:${n.id}:${edge}`
                            );
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                          e.preventDefault();
                          const step = (e.key === "ArrowLeft" ? -1 : 1) / fps;
                          setLayer(n.id, (x) => {
                            const cur = x.window ?? { start: 0, end: D };
                            return { ...x, window: edge === "start" ? { ...cur, start: Math.min(D, Math.max(0, cur.start + step)) } : { ...cur, end: Math.min(D, Math.max(0, cur.end + step)) } };
                          }, "Change on-screen time", `win:${n.id}:${edge}`);
                        }}
                      />
                    ))}
                  {(l.keys ?? []).map((k) => (
                    <button
                      key={k.id}
                      className={cn("absolute top-1/2 z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] shadow", selectedKey === k.id ? "bg-[#c6f432] ring-2 ring-white" : "bg-[#f1eefc]", locked && "cursor-not-allowed opacity-60")}
                      style={{ left: `${(k.t / D) * 100}%` }}
                      aria-label={`Keyframe at ${k.t.toFixed(2)} s on ${n.name}`}
                      title={`${k.t.toFixed(2)} s: drag to move, click to edit`}
                      onPointerDown={(e) => {
                        onSelect(n.id);
                        onSelectKey(k.id);
                        if (locked) return e.stopPropagation();
                        const track = e.currentTarget.parentElement!;
                        const others = (l.keys ?? []).filter((x) => x.id !== k.id).map((x) => x.t);
                        drag(e, track, (t) => {
                          const v = snapT(t, others);
                          setLayer(n.id, (x) => ({ ...x, keys: (x.keys ?? []).map((y) => (y.id === k.id ? { ...y, t: v } : y)) }), "Move keyframe", `key:${k.id}`);
                        });
                      }}
                    />
                  ))}
                  {/* Small ticks where effects are on this layer (count, not timing). */}
                  {l.stack.length > 0 && (
                    <span className="pointer-events-none absolute right-1 top-[7px] rounded bg-black/40 px-1 text-[9px] font-semibold text-white" aria-hidden>
                      {l.stack.length} fx
                    </span>
                  )}
                </div>
              );
            })}
            {/* Playhead */}
            <span className="pointer-events-none absolute top-0 z-30 h-full" style={{ left: `${(frame / N) * 100}%` }} aria-hidden>
              <span className="absolute -left-[7px] top-[14px] h-4 w-[14px] rounded-[3px] bg-[#c6f432]" />
              <span className="absolute left-0 top-[18px] h-[calc(100%-18px)] w-[2px] -translate-x-1/2 bg-[#c6f432]" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Effect controls                                                      */
/* ------------------------------------------------------------------ */

function NumBox({ value, onChange, suffix, step = 1, min, max, label }: { value: number; onChange: (v: number) => void; suffix: string; step?: number; min: number; max: number; label: string }) {
  // A draft only while typing; otherwise it shows the current value.
  const [draft, setDraft] = useState<string | null>(null);
  const v = draft ?? String(value);
  const setV = (x: string) => setDraft(x);
  return (
    <span className={cn("flex h-8 w-[4.6rem] items-center rounded-[8px] border border-[#2e2f29] bg-[#0f100d] pr-1.5 text-xs", "focus-within:border-[#c6f432]")}>
      <input
        aria-label={`${label} value`}
        inputMode="decimal"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Number(v);
          if (Number.isFinite(n) && draft !== null) onChange(Math.min(max, Math.max(min, Math.round(n / step) * step)));
          setDraft(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-full min-w-0 bg-transparent px-2 text-right text-[#ecede4] focus:outline-none"
      />
      <span className={T.muted}>{suffix}</span>
    </span>
  );
}

function SliderRow({ label, value, min, max, step, onChange, shown, box }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; shown?: string; box?: { value: number; suffix: string; step?: number; toValue: (b: number) => number } }) {
  const pct = ((value - min) / (max - min || 1)) * 100;
  return (
    <div className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-[13px]">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="anim-range h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, #c6f432 ${pct}%, #34352f ${pct}%)` }}
      />
      {box ? <NumBox label={label} value={box.value} suffix={box.suffix} step={box.step} min={Number.NEGATIVE_INFINITY} max={Number.POSITIVE_INFINITY} onChange={(b) => onChange(Math.min(max, Math.max(min, box.toValue(b))))} /> : <span className={cn("w-[4.6rem] text-right text-xs", T.muted)}>{shown}</span>}
    </div>
  );
}

/**
 * Effect Controls for the effect picked in the library: Strength, Speed
 * (whole cycles per loop, so it always loops), Start offset (seconds) and
 * Loop mode, then that effect's own settings.
 */
export function EffectControls({ item, duration, layerName, onChange, onRemove }: { item: MotionItem; duration: number; layerName: string; onChange: (p: Partial<MotionItem>, key: string) => void; onRemove: () => void }) {
  const p = PRESET_BY_ID.get(item.preset);
  const [more, setMore] = useState(false);
  if (!p) return null;
  const has = (k: ParamKey) => p.params.includes(k);
  const cycleLen = duration / Math.max(1, item.cycles);
  const g = { ...(p.defaults.glitch ?? { bursts: 3, burstLen: 0.3, slices: 12, maxShift: 60, rgb: 8, noise: 0.1 }), ...(item.glitch ?? {}) };
  const G: [keyof typeof g, string, number, number, number, (v: number) => string][] = [
    ["bursts", "Bursts per loop", 1, 6, 1, (v) => String(v)],
    ["burstLen", "Burst length", 0.1, 1.2, 0.05, (v) => `${v.toFixed(2)} s`],
    ["slices", "Slices", 2, 30, 1, (v) => String(v)],
    ["maxShift", "Max move", 0, 160, 2, (v) => `${v} px`],
    ["rgb", "RGB split", 0, 40, 1, (v) => `${v} px`],
    ["noise", "Noise", 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`]
  ];
  return (
    <section className={cn("border-t px-4 pb-3 pt-2.5", T.line)} aria-label="Effect controls" data-tour="animate-effect-controls">
      <div className="mb-2 flex items-center gap-2">
        <SlidersHorizontal size={17} className="text-[#c9cbc0]" aria-hidden />
        <h3 className="flex-1 text-[15px] font-semibold">
          Effect Controls <span className="font-normal text-[#c9cbc0]">({p.name})</span>
        </h3>
        <button className={cn(T.icon, "h-7 w-7 text-[#ff8a8a]")} onClick={onRemove} aria-label={`Remove ${p.name} from ${layerName}`} title="Remove this effect">
          <Trash2 size={14} />
        </button>
      </div>
      <p className={cn("-mt-1.5 mb-2 truncate text-[11px]", T.muted)} title={p.description}>
        {p.description}
      </p>
      <div className="flex flex-col gap-2">
        {has("strength") && <SliderRow label="Strength" value={item.strength} min={0} max={1} step={0.01} onChange={(v) => onChange({ strength: v }, "strength")} box={{ value: Math.round(item.strength * 100), suffix: "%", toValue: (b) => b / 100 }} />}
        {has("cycles") && <SliderRow label="Speed" value={item.cycles} min={1} max={8} step={1} onChange={(v) => onChange({ cycles: Math.round(v) }, "cycles")} box={{ value: item.cycles, suffix: "×", toValue: (b) => Math.round(b) }} />}
        {has("phase") && <SliderRow label="Start offset" value={item.phase} min={0} max={0.99} step={0.01} onChange={(v) => onChange({ phase: v }, "phase")} box={{ value: Math.round(item.phase * cycleLen * 10) / 10, suffix: "s", step: 0.1, toValue: (b) => (b / cycleLen) % 1 }} />}
        <label className="grid grid-cols-[6.5rem_1fr] items-center gap-3 text-[13px]">
          <span>Loop mode</span>
          <span className="relative">
            <InfinityIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#c6f432]" aria-hidden />
            <select value={item.loop ?? "repeat"} onChange={(e) => onChange({ loop: e.target.value as MotionItem["loop"] }, "loop")} className={cn(T.input, "h-9 w-full appearance-none pl-9 text-[13px]")}>
              <option value="repeat">Repeat (loop)</option>
              <option value="pingpong">Ping-pong (forward, then back)</option>
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#c9cbc0]" aria-hidden />
          </span>
        </label>
        {has("glitch") && G.map(([k, label, lo, hi, step, f]) => <SliderRow key={k} label={label} value={g[k]} min={lo} max={hi} step={step} onChange={(v) => onChange({ glitch: { ...g, [k]: v } }, `glitch.${k}`)} shown={f(g[k])} />)}
        {(has("direction") || has("color") || has("blend") || has("seed") || has("easing") || has("timing")) && (
          <button className={cn("self-start text-xs underline", T.muted)} onClick={() => setMore((m) => !m)} aria-expanded={more}>
            {more ? "Fewer settings" : "More settings"}
          </button>
        )}
        {more && (
          <div className="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-2 text-[13px]">
            {has("direction") && (
              <>
                <span>Direction</span>
                <select value={item.direction ?? "up"} onChange={(e) => onChange({ direction: e.target.value as MotionItem["direction"] }, "direction")} className={T.input}>
                  {["up", "down", "left", "right"].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </>
            )}
            {has("easing") && (
              <>
                <span>Easing</span>
                <select value={item.easing} onChange={(e) => onChange({ easing: e.target.value as MotionItem["easing"] }, "easing")} className={T.input}>
                  <option value="easeInOut">Ease in & out</option>
                  <option value="easeOut">Ease out</option>
                  <option value="linear">Linear</option>
                </select>
              </>
            )}
            {has("timing") && (
              <>
                <span>In / out</span>
                <span className="flex gap-2">
                  <input type="range" min={0.05} max={0.45} step={0.01} value={item.timing?.in ?? 0.18} onChange={(e) => onChange({ timing: { in: Number(e.target.value), out: item.timing?.out ?? 0.18 } }, "timing.in")} aria-label="Entrance" className={cn("w-1/2", T.range)} />
                  <input type="range" min={0.05} max={0.45} step={0.01} value={item.timing?.out ?? 0.18} onChange={(e) => onChange({ timing: { in: item.timing?.in ?? 0.18, out: Number(e.target.value) } }, "timing.out")} aria-label="Exit" className={cn("w-1/2", T.range)} />
                </span>
              </>
            )}
            {has("color") && (
              <>
                <span>Colour</span>
                <input type="color" value={item.color ?? "#ffffff"} onChange={(e) => onChange({ color: e.target.value }, "color")} className="h-7 w-12 rounded bg-transparent" aria-label="Colour" />
              </>
            )}
            {has("blend") && (
              <>
                <span>Blend</span>
                <select value={item.blend ?? "screen"} onChange={(e) => onChange({ blend: e.target.value as MotionItem["blend"] }, "blend")} className={T.input}>
                  {["screen", "normal", "overlay", "soft-light", "multiply"].map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </>
            )}
            {has("seed") && (
              <>
                <span>Seed</span>
                <span className="flex items-center gap-2">
                  <input type="number" min={0} max={99999} value={item.seed ?? 48} onChange={(e) => onChange({ seed: Number(e.target.value) }, "seed")} className={cn(T.input, "w-24")} aria-label="Seed" />
                  <button type="button" className={T.icon} aria-label="New seed" onClick={() => onChange({ seed: Math.floor(Math.random() * 99999) }, "seed")}>
                    <RefreshCw size={13} />
                  </button>
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Edit one keyframe: offsets from the layer's saved place at its time. */
export function KeyInspector({ layer, keyId, duration, fps, onChange, onClose }: { layer: LayerMotion; keyId: string; duration: number; fps: number; onChange: (fn: (l: LayerMotion) => LayerMotion, label: string, key?: string | null) => void; onClose: () => void }) {
  const k = layer.keys?.find((x) => x.id === keyId);
  if (!k) return null;
  const set = (p: Partial<Keyframe>, field: string) => onChange((l) => ({ ...l, keys: (l.keys ?? []).map((x) => (x.id === keyId ? { ...x, ...p } : x)) }), "Edit keyframe", `kf:${keyId}:${field}`);
  const F: [keyof Keyframe, string, number, number, number, (v: number) => string][] = [
    ["dx", "Move across", -400, 400, 1, (v) => `${Math.round(v)} px`],
    ["dy", "Move up/down", -400, 400, 1, (v) => `${Math.round(v)} px`],
    ["scale", "Size", 0.3, 2, 0.01, (v) => `${Math.round(v * 100)}%`],
    ["rotate", "Turn", -45, 45, 0.5, (v) => `${v.toFixed(1)}°`],
    ["opacity", "Opacity", 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
    ["fx", "Effect strength", 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`]
  ];
  return (
    <section className={cn("border-t px-4 pb-4 pt-3", T.line)} aria-label="Keyframe" data-tour="animate-key-inspector">
      <div className="mb-3 flex items-center gap-2">
        <Diamond size={15} className="text-[#c6f432]" aria-hidden />
        <h3 className="flex-1 text-[15px] font-semibold">Keyframe</h3>
        <button className="text-xs text-[#ff8a8a] underline" onClick={() => (onChange((l) => ({ ...l, keys: (l.keys ?? []).filter((x) => x.id !== keyId) }), "Delete keyframe"), onClose())}>
          Delete
        </button>
        <button className={cn(T.icon, "h-7 w-7")} onClick={onClose} aria-label="Close keyframe">
          <X size={14} />
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <SliderRow label="Time" value={k.t} min={0} max={duration - 1 / fps} step={1 / fps} onChange={(v) => set({ t: Math.round(v * fps) / fps }, "t")} shown={`${k.t.toFixed(2)} s`} />
        {F.map(([f, label, lo, hi, step, show]) => (
          <SliderRow key={f} label={label} value={k[f] as number} min={lo} max={hi} step={step} onChange={(v) => set({ [f]: v } as Partial<Keyframe>, f)} shown={show(k[f] as number)} />
        ))}
        <label className="grid grid-cols-[6.5rem_1fr] items-center gap-3 text-[13px]">
          <span>To the next</span>
          <select value={k.easing} onChange={(e) => set({ easing: e.target.value as Keyframe["easing"] }, "easing")} className={T.input}>
            <option value="easeInOut">Eased</option>
            <option value="linear">Linear</option>
          </select>
        </label>
      </div>
      <p className={cn("mt-2 text-[11px]", T.muted)}>Added to the layer&apos;s saved place. After the last keyframe the layer travels back to the first, so the loop closes.</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */

function Modal({ label, onClose, children, wide }: { label: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={label} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className={cn(T.panel, T.text, "max-h-[92vh] w-full overflow-y-auto p-5 shadow-2xl", wide ? "max-w-4xl" : "max-w-xl")}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{label}</h2>
          <button className={T.icon} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LoopCheck({ scene, ctx, anim, reduced, onClose, onPlay }: { scene: Scene; ctx: SrcContext; anim: Animation; reduced: boolean; onClose: () => void; onPlay: () => void }) {
  const report: LoopReport = useMemo(() => checkLoop(scene, anim), [scene, anim]);
  const N = frameCount(anim);
  const last = useMemo(() => evaluateFrame(scene, anim, frameTime(anim, N - 1), { reduced }), [scene, anim, N, reduced]);
  const first = useMemo(() => evaluateFrame(scene, anim, 0, { reduced }), [scene, anim, reduced]);
  const [i, setI] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const f = Math.floor(((now - start) / 1000) * anim.fps);
      setI(f);
      if (f < N * 3) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [anim.fps, N]);
  const loop = useMemo(() => evaluateFrame(scene, anim, frameTime(anim, Math.min(i, N * 3 - 1) % N), { reduced }), [scene, anim, i, N, reduced]);
  const w = 180;
  return (
    <Modal label="Check loop" onClose={onClose} wide>
      <div className="grid gap-4 sm:grid-cols-3">
        <figure>
          <ScenePreview scene={scene} width={w} ctx={ctx} motion={loop} />
          <figcaption className={cn("mt-1 text-xs", T.muted)}>Playing {Math.min(3, Math.floor(i / N) + 1)} of 3 loops</figcaption>
        </figure>
        <figure>
          <ScenePreview scene={scene} width={w} ctx={ctx} motion={last} />
          <figcaption className={cn("mt-1 text-xs", T.muted)}>
            Last frame ({N} of {N})
          </figcaption>
        </figure>
        <figure>
          <ScenePreview scene={scene} width={w} ctx={ctx} motion={first} />
          <figcaption className={cn("mt-1 text-xs", T.muted)}>First frame (1 of {N})</figcaption>
        </figure>
      </div>
      <div className={cn("mt-4 rounded-[10px] border p-3 text-sm", report.ok ? "border-[#c6f432]/40" : "border-[#f5a524]/60")} role="status">
        {report.ok ? (
          <p>No sudden changes found between the last and first frame. This compares the motion settings, not the pictures, so it can&apos;t promise a perfect loop: watch the three plays and compare the last and first frames.</p>
        ) : (
          <>
            <p className="font-semibold text-[#f5a524]">Possible seam</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {report.issues.map((x) => (
                <li key={x.nodeId} className="mt-1">
                  <span className="font-medium">{x.name}</span> {x.what}.<span className={cn("block", T.muted)}>Try: {x.fix}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <button className={cn(T.btn, "mt-3")} onClick={() => (onClose(), onPlay())}>
        <Play size={14} /> Play in the editor
      </button>
    </Modal>
  );
}

type Job = { id: string; format: FormatKey; width: number; height: number; duration: number; status: "queued" | "rendering" | "encoding" | "completed" | "failed" | "cancelled"; progress: number; error: string | null; attempts: number; bytes: number | null; createdAt: string; downloadUrl?: string | null };
const STATUS: Record<Job["status"], string> = { queued: "Queued", rendering: "Rendering", encoding: "Encoding", completed: "Ready", failed: "Failed", cancelled: "Cancelled" };

/** A framing preview: the flyer placed in the target size, with the apps' safe area marked. */
function FramePreview({ scene, ctx, target, f }: { scene: Scene; ctx: SrcContext; target: FormatKey; f: FormatFraming }) {
  const fr = framingFor(scene, target, f);
  const W = 120;
  const k = W / fr.width;
  const sa = safeArea(target);
  return (
    <div className="relative overflow-hidden rounded-[6px]" style={{ width: W, height: fr.height * k, background: scene.background }} aria-hidden>
      <div className="absolute" style={{ left: fr.ox * k, top: fr.oy * k }}>
        <ScenePreview scene={scene} width={scene.width * fr.scale * k} ctx={ctx} />
      </div>
      <div className="pointer-events-none absolute border border-dashed border-[#c6f432]/80" style={{ left: sa.left * k, right: sa.right * k, top: sa.top * k, bottom: sa.bottom * k }} />
    </div>
  );
}

/**
 * Export video: pick the sizes, then each one is rendered here, frame by
 * frame, and tracked as a job (progress shows on any device, Cancel stops
 * the encoder, finished files are kept for download). Without the jobs
 * migration it still exports, just without the tracking and storage.
 */
const TEMPLATE_NOTE = "Template preview: videos download straight away and aren't kept. Flyers made from this template keep their exports.";

export function ExportQueue({ designId, scene, ctx, anim, title, onClose, onFormats }: { designId: string | null; scene: Scene; ctx: SrcContext; anim: Animation; title: string; onClose: () => void; onFormats: (f: NonNullable<Animation["formats"]>) => void }) {
  const [pick, setPick] = useState<FormatKey[]>([scene.format]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [noJobs, setNoJobs] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [run, setRun] = useState<{ jobId: string | null; format: FormatKey; key: number } | null>(null);
  const [p, setP] = useState<ExportProgress | null>(null);
  const [local, setLocal] = useState<{ format: FormatKey; url: string; size: number }[]>([]);
  const cancel = useRef(false);
  const queue = useRef<{ jobId: string | null; format: FormatKey }[]>([]);
  const lastBeat = useRef(0);
  const noJobsRef = useRef<string | null>(null);
  const runKey = useRef(0);
  const inFlight = useRef(false);
  const formats = anim.formats ?? {};
  const fr = (k: FormatKey) => formats[k] ?? DEFAULT_FRAMING;

  const refresh = async () => {
    // Templates: videos download straight away (no saved export history; that belongs to real flyers).
    if (!designId) {
      noJobsRef.current = TEMPLATE_NOTE;
      return setNoJobs(TEMPLATE_NOTE);
    }
    const r = await fetch(`/api/flyers/designs/${designId}/renders`);
    const j = await r.json().catch(() => ({}));
    if (r.status === 503 && j.setup) {
      noJobsRef.current = j.error;
      return setNoJobs(j.error);
    }
    if (r.ok) setJobs(j.jobs ?? []);
  };
  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const h = setInterval(() => void refresh(), 4000);
    return () => {
      clearTimeout(first);
      clearInterval(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId]);

  /** Starts the next video in line. Its job is created only now, so waiting videos can't go stale. */
  const next = async () => {
    cancel.current = false;
    lastBeat.current = 0;
    setP(null);
    const n = queue.current.shift();
    if (!n) return setRun(null);
    let jobId = n.jobId;
    if (!jobId && !noJobsRef.current) {
      const r = await fetch(`/api/flyers/designs/${designId}/renders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: n.format }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 503 && j.setup) {
        noJobsRef.current = j.error;
        setNoJobs(j.error);
      } else if (!r.ok) {
        setErr(`${FORMATS[n.format].label}: ${j.error ?? "Couldn't start the export."}`);
        return void next();
      } else jobId = j.job.id;
      void refresh();
    }
    runKey.current += 1;
    setRun({ jobId, format: n.format, key: runKey.current });
  };
  const start = () => {
    setErr(null);
    queue.current.push(...pick.map((f) => ({ jobId: null, format: f })));
    if (!run) void next();
  };
  const patch = async (jobId: string, body: Record<string, unknown>) => {
    // Progress beats never overlap; state changes always go through.
    if (body.status === "rendering" && inFlight.current) return;
    inFlight.current = true;
    const r = await fetch(`/api/flyers/renders/${jobId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    inFlight.current = false;
    if (j.cancelled) cancel.current = true;
  };
  // Progress from the renderer: shown here, and sent to the job about once a second (its heartbeat).
  const onProgress = (x: ExportProgress) => {
    setP(x);
    const id = run?.jobId;
    if (!id) {
      if (x.phase === "done" && x.blob) {
        setLocal((l) => [{ format: run!.format, url: URL.createObjectURL(x.blob!), size: x.blob!.size }, ...l]);
        void next();
      } else if (x.phase === "error" || x.phase === "cancelled") void next();
      return;
    }
    const now = Date.now();
    if (x.phase === "rendering" && now - lastBeat.current > 1000) {
      lastBeat.current = now;
      void patch(id, { status: "rendering", progress: (x.frame / x.frames) * 0.95, codec: x.codec });
    } else if (x.phase === "finishing") void patch(id, { status: "encoding", progress: 0.96 });
    else if (x.phase === "error") void patch(id, { status: "failed", error: x.message }).then(() => (void refresh(), void next()));
    else if (x.phase === "cancelled") void refresh().then(() => next());
    else if (x.phase === "done" && x.blob) {
      const blob = x.blob;
      void (async () => {
        try {
          await patch(id, { status: "encoding", progress: 0.97 });
          const u = await fetch(`/api/flyers/renders/${id}/upload`, { method: "POST" });
          const uj = await u.json().catch(() => ({}));
          if (!u.ok) throw new Error(uj.error ?? "Couldn't get an upload link.");
          const put = await fetch(uj.url, { method: "PUT", headers: { "Content-Type": "video/mp4", "x-upsert": "true" }, body: blob });
          if (!put.ok) throw new Error("The upload didn't go through. Check your connection and try again.");
          const c = await fetch(`/api/flyers/renders/${id}/complete`, { method: "POST" });
          const cj = await c.json().catch(() => ({}));
          if (!c.ok) throw new Error(cj.error ?? "Couldn't finish the export.");
        } catch (e) {
          // Keep the video for this visit anyway, and record why the upload failed.
          setLocal((l) => [{ format: run!.format, url: URL.createObjectURL(blob), size: blob.size }, ...l]);
          await patch(id, { status: "failed", error: e instanceof Error ? e.message : "Upload failed" });
        }
        await refresh();
        void next();
      })();
    }
  };
  const cancelJob = async (j: Job) => {
    if (run?.jobId === j.id) cancel.current = true;
    queue.current = queue.current.filter((q) => q.jobId !== j.id);
    await fetch(`/api/flyers/renders/${j.id}`, { method: "DELETE" });
    await refresh();
  };
  const retry = async (j: Job) => {
    const r = await fetch(`/api/flyers/renders/${j.id}/retry`, { method: "POST" });
    const x = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(x.error ?? "Couldn't retry.");
    await refresh();
    queue.current.push({ jobId: j.id, format: j.format });
    if (!run) void next();
  };
  const remove = async (j: Job) => {
    await fetch(`/api/flyers/renders/${j.id}`, { method: "DELETE" });
    await refresh();
  };
  const ready = jobs.filter((j) => j.status === "completed" && j.downloadUrl);
  const downloadAll = () => {
    const links = [...ready.map((j) => j.downloadUrl!), ...local.map((l) => l.url)];
    links.forEach((u, i) =>
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = u;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 600)
    );
  };
  const nameFor = (f: FormatKey) => `${title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "flyer"}-${FORMATS[f].width}x${FORMATS[f].height}-${anim.duration}s.mp4`;
  const busy = !!run;
  const runFraming = run ? framingFor(scene, run.format, fr(run.format)) : null;

  return (
    <Modal label="Export video" onClose={onClose} wide>
      <p className={cn("text-xs", T.muted)}>
        {anim.duration} s · 30 fps · H.264 MP4 · no sound. Each video is drawn on this device, frame by frame (keep this tab open; about 30 s per video). Finished videos are kept for 30 days.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3" data-tour="animate-formats">
        {FORMAT_KEYS.map((k) => {
          const on = pick.includes(k);
          const f = fr(k);
          const own = k === scene.format;
          const setF = (p: Partial<FormatFraming>) => onFormats({ ...formats, [k]: { ...f, ...p } });
          return (
            <div key={k} className={cn("rounded-[12px] border p-3", on ? "border-[#c6f432]/70 bg-[#c6f432]/5" : T.line)}>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={on} onChange={(e) => setPick((x) => (e.target.checked ? [...x, k] : x.filter((y) => y !== k)))} className={T.range} />
                {FORMATS[k].label} <span className={cn("font-normal", T.muted)}>{FORMATS[k].size}</span>
              </label>
              <div className="mt-2 flex gap-3">
                <FramePreview scene={scene} ctx={ctx} target={k} f={f} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-[11px]">
                  {own && f.zoom === 1 && !f.x && !f.y ? <span className={T.muted}>The flyer&apos;s own size.</span> : null}
                  <select value={f.mode} onChange={(e) => setF({ mode: e.target.value as FormatFraming["mode"] })} className={T.input} aria-label={`${FORMATS[k].label}: fit or fill`}>
                    <option value="crop">Fill (crop edges)</option>
                    <option value="fit">Fit (show all)</option>
                  </select>
                  <label className={T.muted}>
                    Across
                    <input type="range" min={-1} max={1} step={0.02} value={f.x} onChange={(e) => setF({ x: Number(e.target.value) })} className={cn("w-full", T.range)} />
                  </label>
                  <label className={T.muted}>
                    Up / down
                    <input type="range" min={-1} max={1} step={0.02} value={f.y} onChange={(e) => setF({ y: Number(e.target.value) })} className={cn("w-full", T.range)} />
                  </label>
                  {(() => {
                    const cut = cutOff(scene, k, f, (n) => isProtected(n, roleOf(n, anim.layers[n.id]?.role)));
                    return cut.length ? (
                      <span className="text-[#f5a524]">
                        May sit under the app&apos;s buttons or captions: {cut.join(", ")}.{own ? " Move them in the design if they get covered." : " Try Fit, or move the picture."}
                      </span>
                    ) : null;
                  })()}
                  <label className={T.muted}>
                    Zoom
                    <input type="range" min={1} max={2} step={0.02} value={f.zoom} onChange={(e) => setF({ zoom: Number(e.target.value) })} className={cn("w-full", T.range)} />
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className={cn("mt-2 text-[11px]", T.muted)}>Dashed line: where apps put their own buttons and captions. Keep key details inside it. The artwork is never stretched; other sizes are made from your layout.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className={T.limeBtn} disabled={!pick.length} onClick={start} data-tour="animate-export-start">
          <Download size={16} /> Export {pick.length > 1 ? `${pick.length} videos` : "video"}
        </button>
        {(ready.length > 0 || local.length > 0) && (
          <button className={T.btn} onClick={downloadAll}>
            <Download size={14} /> Download all ({ready.length + local.length})
          </button>
        )}
        {noJobs && <span className="text-[11px] text-[#f5a524]">{noJobs} Exports still work; they just aren&apos;t tracked or kept.</span>}
        {err && <span className="text-xs text-[#ff8a8a]">{err}</span>}
      </div>

      {run && p && (
        <div className="mt-4 rounded-[10px] border border-[#2e2f29] p-3" role="status">
          <div className="flex items-center justify-between text-sm">
            <span>
              {FORMATS[run.format].label}: {p.phase === "preparing" ? "checking fonts and pictures…" : p.phase === "rendering" ? `frame ${p.frame} of ${p.frames}` : p.phase === "finishing" ? "encoding…" : p.phase === "done" ? "saving…" : p.phase}
            </span>
            <button
              className={T.btn}
              onClick={() => {
                cancel.current = true;
                queue.current = [];
                if (run.jobId) void fetch(`/api/flyers/renders/${run.jobId}`, { method: "DELETE" }).then(refresh);
              }}
            >
              Cancel
            </button>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#2a2b26]" role="progressbar" aria-valuenow={p.frame} aria-valuemax={p.frames} aria-label="Export progress">
            <div className="h-full bg-[#c6f432] transition-[width]" style={{ width: `${(p.frame / Math.max(1, p.frames)) * 100}%` }} />
          </div>
        </div>
      )}

      {(jobs.length > 0 || local.length > 0) && (
        <table className="mt-4 w-full text-left text-xs">
          <thead className={T.muted}>
            <tr>
              <th className="py-1 font-normal">Video</th>
              <th className="font-normal">Status</th>
              <th className="font-normal">Size</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {local.map((l) => (
              <tr key={l.url} className={cn("border-t", T.line)}>
                <td className="py-2">{FORMATS[l.format].label} (this visit only)</td>
                <td>Ready</td>
                <td>{(l.size / 1e6).toFixed(1)} MB</td>
                <td className="text-right">
                  <a className={T.btn} href={l.url} download={nameFor(l.format)}>
                    <Download size={13} /> Download
                  </a>
                </td>
              </tr>
            ))}
            {jobs.map((j) => (
              <tr key={j.id} className={cn("border-t", T.line)}>
                <td className="py-2">
                  {FORMATS[j.format]?.label ?? j.format} · {j.duration} s<span className={cn("block", T.muted)}>{new Date(j.createdAt).toLocaleString()}</span>
                </td>
                <td>
                  <span className={cn(j.status === "completed" ? "text-[#c6f432]" : j.status === "failed" ? "text-[#ff8a8a]" : "")}>{STATUS[j.status]}</span>
                  {(j.status === "rendering" || j.status === "encoding") && ` ${Math.round(j.progress * 100)}%`}
                  {j.error && <span className={cn("block max-w-64", T.muted)}>{j.error}</span>}
                </td>
                <td>{j.bytes ? `${(j.bytes / 1e6).toFixed(1)} MB` : ""}</td>
                <td className="whitespace-nowrap text-right">
                  {j.downloadUrl && (
                    <a className={T.btn} href={j.downloadUrl} download>
                      <Download size={13} /> Download
                    </a>
                  )}
                  {["queued", "rendering", "encoding"].includes(j.status) && (
                    <button className={cn(T.btn, "ml-1")} onClick={() => void cancelJob(j)}>
                      Cancel
                    </button>
                  )}
                  {(j.status === "failed" || j.status === "cancelled") && j.attempts < 3 && (
                    <button className={cn(T.btn, "ml-1")} disabled={busy} onClick={() => void retry(j)}>
                      <RefreshCw size={13} /> Retry
                    </button>
                  )}
                  {!["queued", "rendering", "encoding"].includes(j.status) && (
                    <button className={cn(T.icon, "ml-1 h-7 w-7")} onClick={() => void remove(j)} aria-label="Delete this video" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {run && runFraming && <VideoRenderer key={run.key} scene={scene} ctx={ctx} anim={anim} out={runFraming} onProgress={onProgress} cancelRef={cancel} />}
    </Modal>
  );
}
