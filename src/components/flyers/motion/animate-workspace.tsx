"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, BringToFront, ChevronDown, ChevronUp, ClipboardCopy, Move, Pencil, SendToBack, ClipboardPaste, Download, Eye, EyeOff, Headphones, Lock, Pause, Play, Plus, Redo2, RefreshCw, Repeat, Save, Trash2, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FlyerStage, ScenePreview, type NodePatch } from "../flyer-canvas";
import { fontString, loadSceneFonts, type SrcContext } from "../loaders";
import { FORMATS, ROLES, type FlyerNode, type Role, type Scene } from "@/lib/flyers/types";
import { MOTION_PRESETS, PLANNED, PRESET_BY_ID, isProtected, presetFits, roleOf, type Category, type ParamKey } from "@/lib/flyers/motion/presets";
import { checkLoop, evaluateFrame, frameCount, frameTime, type LoopReport } from "@/lib/flyers/motion/engine";
import { RECIPES, applyRecipe, newItem, newItemId, planRecipe } from "@/lib/flyers/motion/recipes";
import { DURATIONS, MAX_STACK, emptyAnimation, type Animation, type Intensity, type LayerMotion, type MotionItem } from "@/lib/flyers/motion/types";
import { parseAnimation } from "@/lib/flyers/motion/schema";
import { VideoRenderer, type ExportProgress } from "./video-export";

/**
 * Animate mode: the same flyer, its own layers, with motion added on top.
 * Simple mode is the default (pick a style, set the intensity, check the
 * loop, export); Advanced adds the layer list, the motion library, each
 * layer's stack and the timeline. Motion is saved on the flyer next to the
 * layout. Layers can also be moved, resized, renamed and re-stacked here:
 * those changes go to the flyer's layout (the same as in Design), and one
 * undo history covers both.
 */

const CATS: { key: Category; label: string }[] = [
  { key: "text", label: "Text" },
  { key: "photos", label: "Photos" },
  { key: "backgrounds", label: "Backgrounds" },
  { key: "overlays", label: "Overlays" }
];
const INTENSITIES: { key: Intensity; label: string }[] = [
  { key: "subtle", label: "Subtle" },
  { key: "balanced", label: "Balanced" },
  { key: "high", label: "High Energy" }
];
const PARAM_LABEL: Record<ParamKey, string> = { strength: "Strength", cycles: "Cycles per loop", phase: "Start offset", easing: "Easing", direction: "Direction", color: "Color", blend: "Blend", seed: "Seed", timing: "In / out" };
const CUSTOM_KEY = "dcdj-motion-presets-v1";

/** One undo step: the motion and the layers as they were, and what the step did. */
type Snap = { anim: Animation; nodes: FlyerNode[]; label: string };
type Hist = { past: Snap[]; future: Snap[]; lastKey: string | null; lastAt: number };
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

function loadCustom(): { name: string; stack: MotionItem[] }[] {
  try {
    const v = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]");
    return Array.isArray(v) ? v.slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function AnimateWorkspace({
  designId,
  scene,
  ctx,
  title,
  onClose,
  onNodes,
  canMove
}: {
  designId: string;
  scene: Scene;
  ctx: SrcContext;
  title: string;
  onClose: () => void;
  /** Writes layer changes (move, resize, rename, order) to the flyer's layout; the editor saves them. */
  onNodes: (nodes: FlyerNode[]) => void;
  canMove: (n: FlyerNode) => boolean;
}) {
  const [anim, setAnim] = useState<Animation | null>(null);
  const [hist, setHist] = useState<Hist>({ past: [], future: [], lastKey: null, lastAt: 0 });
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [selected, setSelected] = useState<string | null>(null);
  const [cat, setCat] = useState<Category>("text");
  const [preview, setPreview] = useState<Animation | null>(null);
  /** Hovering an effect in the library plays it on the selected layer (nothing is added). */
  const [trial, setTrial] = useState<Animation | null>(null);
  const trialStartedPlay = useRef(false);
  const [confirmRecipe, setConfirmRecipe] = useState<string | null>(null);
  const [clip, setClip] = useState<MotionItem[] | null>(null);
  const [custom, setCustom] = useState<{ name: string; stack: MotionItem[] }[]>(loadCustom);
  const [save, setSave] = useState<{ state: "saved" | "saving" | "error" | "idle"; msg?: string }>({ state: "idle" });
  const [loopOpen, setLoopOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [fontsKey, setFontsKey] = useState(0);
  const dirty = useRef(false);
  const animRef = useRef<Animation | null>(null);
  const sceneRef = useRef(scene);
  useEffect(() => {
    animRef.current = anim;
    sceneRef.current = scene;
  });

  // Load the saved settings (or start empty); reduced motion follows the device setting.
  useEffect(() => {
    let live = true;
    fetch(`/api/flyers/designs/${designId}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!live) return;
        if (!ok) return setLoadErr(j.error ?? "Couldn't open this flyer.");
        const p = parseAnimation(j.design?.animation ?? null);
        const base = p.ok && p.value ? p.value : emptyAnimation();
        // Motion on layers that were since deleted is kept out of the way (and dropped on the next save).
        const nodesNow = sceneRef.current.nodes;
        setAnim({ ...base, layers: Object.fromEntries(Object.entries(base.layers).filter(([id]) => nodesNow.some((n) => n.id === id))) });
        if (!("animation" in (j.design ?? {}))) setSave({ state: "error", msg: "Saving needs migration 0069_flyer_animation.sql in Supabase. You can still preview and export." });
      })
      .catch(() => live && setLoadErr("Couldn't open this flyer."));
    loadSceneFonts([sceneRef.current]).then(() => live && setFontsKey((k) => k + 1));
    return () => {
      live = false;
    };
  }, [designId]);

  const shown = preview ?? trial ?? anim;
  const N = shown ? frameCount(shown) : 240;
  const t = shown ? frameTime(shown, frame % N) : 0;
  const motion = useMemo(() => (shown ? evaluateFrame(scene, shown, t, { reduced }) : null), [scene, shown, t, reduced]);

  // Playback: the wall clock only picks WHICH frame to show; each frame is evaluated at its exact timeline time.
  useEffect(() => {
    if (!playing || !shown) return;
    let raf = 0;
    const start = performance.now() - (frame / shown.fps) * 1000;
    const tickFn = (now: number) => {
      setFrame(Math.floor(((now - start) / 1000) * shown.fps));
      raf = requestAnimationFrame(tickFn);
    };
    raf = requestAnimationFrame(tickFn);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, shown?.fps]);

  /** Records one undo step (quick repeats with the same key, like dragging a slider, merge into one). */
  const record = useCallback((label: string, key: string | null) => {
    const cur = animRef.current;
    if (!cur) return;
    const now = Date.now();
    setHist((h) => {
      if (key && key === h.lastKey && now - h.lastAt < 900 && h.past.length) return { ...h, lastAt: now };
      return { past: [...h.past.slice(-80), { anim: cur, nodes: sceneRef.current.nodes, label }], future: [], lastKey: key, lastAt: now };
    });
  }, []);

  /** Every motion change goes through here: undoable, then saved shortly after. */
  const change = useCallback(
    (fn: (a: Animation) => Animation, label = "Change motion", key: string | null = null) => {
      const cur = animRef.current;
      if (!cur) return;
      const next = fn(cur);
      if (next === cur) return;
      record(label, key);
      animRef.current = next;
      dirty.current = true;
      setAnim(next);
    },
    [record]
  );

  /** Layer changes (move, resize, rename, order): into the flyer's layout, undoable from here too. */
  const changeNodes = useCallback(
    (fn: (nodes: FlyerNode[]) => FlyerNode[], label: string, key: string | null = null) => {
      const cur = sceneRef.current.nodes;
      const next = fn(cur);
      if (next === cur) return;
      record(label, key);
      sceneRef.current = { ...sceneRef.current, nodes: next };
      onNodes(next);
    },
    [record, onNodes]
  );

  const restore = (snap: Snap) => {
    animRef.current = snap.anim;
    setAnim(snap.anim);
    dirty.current = true;
    if (snap.nodes !== sceneRef.current.nodes) {
      sceneRef.current = { ...sceneRef.current, nodes: snap.nodes };
      onNodes(snap.nodes);
    }
  };
  const undo = () => {
    const h = hist;
    if (!h.past.length || !anim) return;
    const prev = h.past[h.past.length - 1];
    setHist({ past: h.past.slice(0, -1), future: [{ anim, nodes: scene.nodes, label: prev.label }, ...h.future], lastKey: null, lastAt: 0 });
    restore(prev);
  };
  const redo = () => {
    const h = hist;
    if (!h.future.length || !anim) return;
    const next = h.future[0];
    setHist({ past: [...h.past, { anim, nodes: scene.nodes, label: next.label }], future: h.future.slice(1), lastKey: null, lastAt: 0 });
    restore(next);
  };

  const saveNow = useCallback(async (a: Animation) => {
    setSave({ state: "saving" });
    try {
      const r = await fetch(`/api/flyers/designs/${designId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ animation: a }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Couldn't save");
      dirty.current = false;
      setSave({ state: "saved" });
    } catch (e) {
      setSave({ state: "error", msg: e instanceof Error ? e.message : "Couldn't save" });
    }
  }, [designId]);
  useEffect(() => {
    if (!anim || !dirty.current) return;
    const h = setTimeout(() => void saveNow(anim), 1200);
    return () => clearTimeout(h);
  }, [anim, saveNow]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (selected && e.key.startsWith("Arrow")) {
        // Nudge the selected layer: 1 px, or 10 px with Shift.
        const n = scene.nodes.find((x) => x.id === selected);
        if (!n || n.locked || !canMove(n)) return;
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
        const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
        changeNodes((ns) => ns.map((x) => (x.id === n.id ? ({ ...x, x: x.x + dx, y: x.y + dy } as FlyerNode) : x)), `Move ${n.name}`, `nudge:${n.id}`);
      } else if (e.key === "Escape") {
        setSelected(null);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const nodes = [...scene.nodes].filter((n) => n.visible).reverse();
  const sel = scene.nodes.find((n) => n.id === selected) ?? null;
  const layerOf = (id: string): LayerMotion => anim?.layers[id] ?? { stack: [] };
  const setLayer = (id: string, fn: (l: LayerMotion) => LayerMotion, label = "Change motion", key: string | null = null) =>
    change((a) => ({ ...a, recipe: a.recipe, layers: { ...a.layers, [id]: fn(a.layers[id] ?? { stack: [] }) } }), label, key);

  /** Moves the layer in the stacking order (scene order is back to front). */
  const restack = (id: string, to: "front" | "forward" | "backward" | "back") =>
    changeNodes(
      (ns) => {
        const i = ns.findIndex((n) => n.id === id);
        if (i < 0) return ns;
        const j = to === "front" ? ns.length - 1 : to === "back" ? 0 : to === "forward" ? Math.min(ns.length - 1, i + 1) : Math.max(0, i - 1);
        if (i === j) return ns;
        const out = [...ns];
        const [n] = out.splice(i, 1);
        out.splice(j, 0, n);
        return out;
      },
      to === "front" || to === "forward" ? "Bring layer forward" : "Send layer back"
    );
  const rename = (id: string, name: string) => {
    const clean = name.trim().slice(0, 60);
    if (!clean) return;
    changeNodes((ns) => ns.map((n) => (n.id === id && n.name !== clean ? ({ ...n, name: clean } as FlyerNode) : n)), "Rename layer", `name:${id}`);
  };
  const applyPatches = (patches: NodePatch[], key: string) => {
    const names = patches.map((p) => scene.nodes.find((n) => n.id === p.id)?.name).filter(Boolean);
    changeNodes((ns) => ns.map((n) => {
      const p = patches.find((x) => x.id === n.id);
      return p ? ({ ...n, ...p.patch } as FlyerNode) : n;
    }), `Move ${names.join(", ") || "layer"}`, key);
  };

  /** Plays an effect on the selected layer while the pointer is on it in the library. */
  const tryPreset = (presetId: string | null) => {
    if (!presetId || !anim || !selected) {
      setTrial(null);
      if (trialStartedPlay.current) setPlaying(false);
      trialStartedPlay.current = false;
      return;
    }
    const l = anim.layers[selected] ?? { stack: [] };
    // Shown on its own (solo) so you see exactly what this effect does.
    setTrial({ ...anim, layers: { ...anim.layers, [selected]: { ...l, muted: false, solo: true, stack: [...l.stack.slice(0, MAX_STACK - 1), newItem(presetId)] } } });
    if (!playing) {
      trialStartedPlay.current = true;
      setPlaying(true);
    }
  };

  // Fit the preview to the space.
  // A callback ref: the preview box only exists once the settings have loaded.
  const [wrapEl, wrap] = useState<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(0.3);
  useEffect(() => {
    const el = wrapEl;
    if (!el) return;
    const ro = new ResizeObserver(() => setZoom(Math.max(0.08, Math.min((el.clientWidth - 24) / scene.width, (el.clientHeight - 24) / scene.height))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [wrapEl, scene.width, scene.height]);
  const pctx = useMemo(() => ({ ...ctx, fxScale: Math.max(0.2, zoom * 1.5) }), [ctx, zoom]);

  if (loadErr) return <Shell title={title} onClose={onClose}><p className="p-6 text-sm text-status-declined">{loadErr}</p></Shell>;
  if (!anim) return <Shell title={title} onClose={onClose}><p className="p-6 text-sm text-muted">Opening Animate…</p></Shell>;

  const animatedCount = Object.values(anim.layers).filter((l) => l.stack.length).length;
  const v = ctx.values ?? {};
  const details: [string, string | null | undefined][] = [
    ["Venue", v.venue_name as string],
    ["Date", (v.event_date as string) ?? null],
    ["Time", (v.event_time_range as string) ?? (v.start_time as string)],
    ["DJs", (v.dj_lineup as string) ?? (v.dj_name as string)]
  ];

  function recipeClick(id: string) {
    const r = RECIPES.find((x) => x.id === id)!;
    const plan = planRecipe(r, scene.nodes, anim!);
    const clash = Object.keys(plan).filter((k) => anim!.layers[k]?.stack.length);
    if (clash.length && confirmRecipe !== id) return setConfirmRecipe(id);
    setConfirmRecipe(null);
    setPreview(null);
    change((a) => applyRecipe(r, scene.nodes, a), `Apply ${r.name}`);
  }
  function removeRecipe(id: string) {
    const r = RECIPES.find((x) => x.id === id)!;
    const ids = Object.keys(planRecipe(r, scene.nodes, anim!));
    change((a) => ({ ...a, recipe: null, layers: Object.fromEntries(Object.entries(a.layers).map(([k, l]) => [k, ids.includes(k) ? { ...l, stack: [] } : l])) }), `Remove ${r.name}`);
  }
  const clearAll = () => change((a) => ({ ...a, recipe: null, layers: Object.fromEntries(Object.entries(a.layers).map(([k, l]) => [k, { ...l, stack: [] }])) }), "Remove all motion");
  const removeItem = (layerId: string, itemId: string) => setLayer(layerId, (l) => ({ ...l, stack: l.stack.filter((x) => x.id !== itemId) }), "Remove effect");
  const undoLabel = hist.past.length ? hist.past[hist.past.length - 1].label : null;
  const redoLabel = hist.future.length ? hist.future[0].label : null;

  const timeline = (
    <div className="border-t border-black/10 bg-[var(--card)] px-3 py-2" data-tour="animate-timeline">
      <div className="mb-1 flex items-center gap-3 text-xs">
        <span className="font-semibold">Timeline</span>
        <span className="text-muted">{fmt(t)} / {fmt(anim.duration)} · frame {(frame % N) + 1} of {N}</span>
      </div>
      <div className="max-h-44 overflow-y-auto">
        {nodes
          .filter((n) => layerOf(n.id).stack.length)
          .map((n) => {
            const l = layerOf(n.id);
            return (
              <div key={n.id} className="flex items-center gap-2 py-0.5 text-xs">
                <button className={cn("w-40 truncate text-left", selected === n.id && "font-semibold text-gold-dim")} onClick={() => setSelected(n.id)}>
                  {n.name}
                </button>
                <button aria-label={`${l.muted ? "Unmute" : "Mute"} ${n.name}`} onClick={() => setLayer(n.id, (x) => ({ ...x, muted: !x.muted }), l.muted ? "Unmute layer" : "Mute layer")} className={cn("rounded px-1", l.muted ? "text-status-declined" : "text-muted")}>
                  {l.muted ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button aria-label={`Solo ${n.name}`} aria-pressed={!!l.solo} onClick={() => setLayer(n.id, (x) => ({ ...x, solo: !x.solo }), "Solo layer")} className={cn("rounded px-1", l.solo ? "text-gold-dim" : "text-muted")}>
                  <Headphones size={13} />
                </button>
                <div className="relative h-5 flex-1 rounded bg-black/5">
                  {l.stack.map((it, i) => (
                    <Curve key={it.id} item={it} node={n} scene={scene} anim={anim} row={i} rows={l.stack.length} />
                  ))}
                  <span className="absolute top-0 h-full w-0.5 bg-gold" style={{ left: `${((frame % N) / N) * 100}%` }} aria-hidden />
                </div>
              </div>
            );
          })}
        {!animatedCount && <p className="py-2 text-xs text-muted">No layer has motion yet. Pick a motion style, or select a layer and add motion from the library.</p>}
      </div>
    </div>
  );

  return (
    <Shell
      title={title}
      onClose={onClose}
      bar={
        <>
          <div className="flex rounded-full border border-black/12 p-0.5 text-xs" role="tablist" aria-label="Animate mode" data-tour="animate-mode">
            {(["simple", "advanced"] as const).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("rounded-full px-3 py-1 capitalize", mode === m ? "bg-gold font-semibold text-black" : "text-muted")}>
                {m}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs">
            Length
            <select value={anim.duration} onChange={(e) => change((a) => ({ ...a, duration: Number(e.target.value) }), "Change length")} className="rounded-[8px] border border-black/12 bg-transparent px-2 py-1">
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} s
                </option>
              ))}
            </select>
          </label>
          <button className={iconBtn} onClick={undo} disabled={!undoLabel} aria-label={undoLabel ? `Undo: ${undoLabel}` : "Undo"} title={undoLabel ? `Undo: ${undoLabel} (Ctrl/⌘ Z)` : "Nothing to undo"} data-tour="animate-undo">
            <Undo2 size={15} /> <span className="hidden max-w-40 truncate xl:inline">{undoLabel ? `Undo: ${undoLabel}` : "Undo"}</span>
          </button>
          <button className={iconBtn} onClick={redo} disabled={!redoLabel} aria-label={redoLabel ? `Redo: ${redoLabel}` : "Redo"} title={redoLabel ? `Redo: ${redoLabel} (Ctrl/⌘ Shift Z)` : "Nothing to redo"}>
            <Redo2 size={15} />
          </button>
          <span className={cn("text-[11px]", save.state === "error" ? "text-status-declined" : "text-muted")} title={save.msg}>
            {save.state === "saving" ? "Saving…" : save.state === "saved" ? "Saved" : save.state === "error" ? (save.msg ?? "Not saved") : ""}
          </span>
          <button className={iconBtn} onClick={() => void saveNow(anim)} aria-label="Save now">
            <Save size={15} />
          </button>
          <button className={iconBtn} onClick={() => setLoopOpen(true)} data-tour="animate-check-loop">
            <Repeat size={15} /> Check loop
          </button>
          <button className={cn(iconBtn, "border-gold bg-gold font-semibold text-black")} onClick={() => setExportOpen(true)} data-tour="animate-export">
            <Download size={15} /> Export MP4
          </button>
        </>
      }
    >
      <div className={cn("grid min-h-0 flex-1 overflow-y-auto lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden", mode === "advanced" ? "lg:grid-cols-[260px_minmax(0,1fr)_340px]" : "lg:grid-cols-[minmax(0,1fr)_360px]")}>
        {mode === "advanced" && (
          <aside className="min-h-0 overflow-y-auto border-r border-black/10 bg-[var(--card)] p-3" aria-label="Layers" data-tour="animate-layers">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Layers</p>
            <p className="mb-2 text-[11px] text-muted">Top is the front. Double-click a name to rename it. Drag layers on the flyer to move them.</p>
            <ul className="flex flex-col gap-1">
              {nodes.map((n, i) => {
                const l = layerOf(n.id);
                const role = roleOf(n, l.role);
                return (
                  <li key={n.id} className={cn("group flex items-start gap-1 rounded-[10px] border px-2 py-1.5", selected === n.id ? "border-gold bg-gold/10" : "border-transparent hover:border-black/10")}>
                    <div className="min-w-0 flex-1">
                      <LayerName node={n} selected={selected === n.id} onSelect={() => setSelected(n.id)} onRename={(v) => rename(n.id, v)} />
                      <button onClick={() => setSelected(n.id)} className="block w-full text-left text-[11px] text-muted" tabIndex={-1}>
                        {ROLES[role]}
                        {n.kind === "text" ? " · live text" : n.kind === "image" ? " · picture" : " · shape"}
                        {l.stack.length > 0 && <span className="ml-1 rounded-full bg-gold/20 px-1.5 text-[10px] font-semibold text-gold-dim">{l.stack.length} motion</span>}
                        {anim.readableLock && isProtected(n, role) && <Lock size={11} className="ml-1 inline text-muted" aria-label="Kept readable" />}
                      </button>
                    </div>
                    <div className="flex flex-col opacity-60 group-hover:opacity-100">
                      <button className="p-0.5 disabled:opacity-20" disabled={i === 0 || !canMove(n)} onClick={() => restack(n.id, "forward")} aria-label={`Bring ${n.name} forward`} title="Bring forward">
                        <ChevronUp size={13} />
                      </button>
                      <button className="p-0.5 disabled:opacity-20" disabled={i === nodes.length - 1 || !canMove(n)} onClick={() => restack(n.id, "backward")} aria-label={`Send ${n.name} back`} title="Send back">
                        <ChevronDown size={13} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        <section className="flex min-w-0 flex-col bg-[#ece7dd] lg:min-h-0">
          <div ref={wrap} className="flex h-[58vh] shrink-0 items-center justify-center overflow-hidden p-3 lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink">
            <div className="shadow-xl" data-tour="animate-preview">
              <div
                onPointerDownCapture={() => {
                  // Grabbing a layer pauses playback, so it holds still while you move it.
                  if (playing) setPlaying(false);
                }}
              >
                <FlyerStage
                  scene={scene}
                  zoom={zoom}
                  selected={selected && !playing ? [selected] : []}
                  ctx={pctx}
                  fontsKey={fontsKey}
                  showGuides
                  canMove={canMove}
                  onSelect={(id) => setSelected(id)}
                  onClear={() => setSelected(null)}
                  onChange={applyPatches}
                  onEditText={(id) => {
                    setSelected(id);
                    setMode("advanced");
                  }}
                  coarse={typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches}
                  motion={motion}
                />
              </div>
            </div>
          </div>
          <p className="px-3 pb-1 text-center text-[11px] text-muted">
            <Move size={11} className="mr-1 inline" />
            Click a layer to select it, drag to move, use the handles to resize or turn. Arrow keys nudge (Shift for 10 px). Changes also apply to the flyer design.
          </p>
          <div className="flex flex-wrap items-center gap-2 border-t border-black/10 bg-[var(--card)] px-3 py-2">
            <button className={cn(iconBtn, "border-gold bg-gold text-black")} onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <input type="range" min={0} max={N - 1} value={frame % N} onChange={(e) => (setPlaying(false), setFrame(Number(e.target.value)))} aria-label="Scrub" className="min-w-32 flex-1 accent-[var(--gold)]" />
            <span className="w-24 text-right font-mono text-xs text-muted">{fmt(t)} / {fmt(anim.duration)}</span>
            <label className="flex items-center gap-1 text-xs text-muted">
              <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} /> Reduced motion preview
            </label>
            {trial && <span className="rounded-full bg-gold/15 px-3 py-1 text-xs">Trying an effect on {sel?.name}</span>}
            {preview && (
              <span className="flex items-center gap-2 rounded-full bg-gold/15 px-3 py-1 text-xs">
                Previewing a style
                <button className="font-semibold text-gold-dim underline" onClick={() => setPreview(null)}>
                  Stop
                </button>
              </span>
            )}
          </div>
          {mode === "advanced" && timeline}
        </section>

        <aside className="min-h-0 overflow-y-auto border-l border-black/10 bg-[var(--card)] p-4" aria-label={mode === "simple" ? "Motion style" : "Motion library"}>
          {mode === "simple" ? (
            <div className="flex flex-col gap-5">
              {sel && <LayerCard node={sel} anim={anim} canMove={canMove(sel)} onRename={(v) => rename(sel.id, v)} onRestack={(to) => restack(sel.id, to)} onRemove={(id) => removeItem(sel.id, id)} onEdit={() => setMode("advanced")} onClose={() => setSelected(null)} />}
              <section>
                <h2 className="text-sm font-semibold">1 · Event details</h2>
                <dl className="mt-1.5 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-0.5 text-xs">
                  {details.map(([k, val]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted">{k}</dt>
                      <dd className={cn(!val && "text-status-urgent")}>{val || "Not set (change it in Design)"}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-1 text-[11px] text-muted">These come from the flyer&apos;s event. Change them in Design; motion stays.</p>
              </section>
              <section data-tour="animate-styles">
                <h2 className="text-sm font-semibold">2 · Motion style</h2>
                <ul className="mt-2 flex flex-col gap-2">
                  {RECIPES.map((r) => {
                    const plan = planRecipe(r, scene.nodes, anim);
                    const names = Object.keys(plan).map((id) => scene.nodes.find((n) => n.id === id)?.name).filter(Boolean);
                    const on = anim.recipe === r.id;
                    return (
                      <li key={r.id} className={cn("rounded-[12px] border p-3", on ? "border-gold bg-gold/5" : "border-black/10")}>
                        <p className="text-sm font-semibold">
                          {r.name} {on && <span className="text-[11px] font-normal text-gold-dim">· applied</span>}
                        </p>
                        <p className="text-xs text-muted">{r.blurb}</p>
                        <p className="mt-1 text-[11px] text-muted">{names.length ? `Animates: ${names.join(", ")}` : "No matching layers on this flyer."}</p>
                        {confirmRecipe === r.id && <p className="mt-1 text-[11px] text-status-urgent">Some of these layers already have motion. Apply again to replace it (you can undo).</p>}
                        <div className="mt-2 flex gap-2">
                          <button
                            className="rounded-[8px] border border-black/12 px-2.5 py-1 text-xs hover:border-gold"
                            disabled={!names.length}
                            onClick={() => {
                              setPreview(applyRecipe(r, scene.nodes, anim));
                              setFrame(0);
                              setPlaying(true);
                            }}
                          >
                            Preview
                          </button>
                          <button className="rounded-[8px] border border-gold px-2.5 py-1 text-xs font-semibold hover:bg-gold/10" disabled={!names.length} onClick={() => recipeClick(r.id)}>
                            {confirmRecipe === r.id ? "Replace and apply" : on ? "Apply again" : "Apply"}
                          </button>
                          {on && (
                            <button className="rounded-[8px] border border-black/12 px-2.5 py-1 text-xs text-status-declined hover:border-status-declined" onClick={() => removeRecipe(r.id)}>
                              Remove
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <MotionSummary
                  nodes={nodes}
                  anim={anim}
                  onPick={(id) => {
                    setSelected(id);
                    setMode("advanced");
                  }}
                  onRemove={removeItem}
                  onClearAll={clearAll}
                />
              </section>
              <section data-tour="animate-intensity">
                <h2 className="text-sm font-semibold">3 · Intensity</h2>
                <div className="mt-2 grid grid-cols-3 gap-1 rounded-[10px] border border-black/12 p-1" role="radiogroup" aria-label="Overall intensity">
                  {INTENSITIES.map((i) => (
                    <button key={i.key} role="radio" aria-checked={anim.intensity === i.key} onClick={() => change((a) => ({ ...a, intensity: i.key }), `Intensity: ${i.label}`)} className={cn("rounded-[8px] py-1.5 text-xs", anim.intensity === i.key ? "bg-gold font-semibold text-black" : "text-muted")}>
                      {i.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted">Scales every effect within its safe limits. Each layer&apos;s own strength stays as you set it; this multiplies it.</p>
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={anim.readableLock} onChange={(e) => change((a) => ({ ...a, readableLock: e.target.checked }), e.target.checked ? "Keep details readable" : "Let details move")} />
                  <span>
                    Keep event details readable
                    <span className="block text-[11px] text-muted">Venue, date, time and address stay visible and steady. Decorative text can move freely.</span>
                  </span>
                </label>
              </section>
              <section>
                <h2 className="text-sm font-semibold">4 · Check and export</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className={iconBtn} onClick={() => setLoopOpen(true)}>
                    <Repeat size={15} /> Check loop
                  </button>
                  <button className={cn(iconBtn, "border-gold bg-gold font-semibold text-black")} onClick={() => setExportOpen(true)}>
                    <Download size={15} /> Export MP4
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  {FORMATS[scene.format].label} {scene.width}×{scene.height} · {anim.duration} s · 30 fps · no sound
                </p>
              </section>
              <button className="self-start text-xs text-gold-dim underline" onClick={() => setMode("advanced")}>
                Fine-tune each layer (Advanced)
              </button>
            </div>
          ) : (
            <Advanced
              anim={anim}
              sel={sel}
              cat={cat}
              setCat={setCat}
              layer={sel ? layerOf(sel.id) : null}
              setLayer={(fn, label, key) => sel && setLayer(sel.id, fn, label, key)}
              canMove={sel ? canMove(sel) : false}
              onRename={(v) => sel && rename(sel.id, v)}
              onRestack={(to) => sel && restack(sel.id, to)}
              onTry={tryPreset}
              clip={clip}
              setClip={setClip}
              custom={custom}
              saveCustom={(name, stack) => {
                const next = [{ name, stack: stack.map((s) => ({ ...s, id: newItemId() })) }, ...custom.filter((c) => c.name !== name)].slice(0, 30);
                setCustom(next);
                try {
                  localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
                } catch {
                  // private window: kept for this visit only
                }
              }}
            />
          )}
        </aside>
      </div>

      {loopOpen && <LoopCheck scene={scene} ctx={ctx} anim={anim} reduced={reduced} onClose={() => setLoopOpen(false)} onPlay={() => (setFrame(0), setPlaying(true))} />}
      {exportOpen && <ExportDialog scene={scene} ctx={ctx} anim={anim} title={title} onClose={() => setExportOpen(false)} />}
    </Shell>
  );
}

const iconBtn = "inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-black/12 px-2.5 text-xs disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

function Shell({ title, onClose, bar, children }: { title: string; onClose: () => void; bar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#ece7dd] text-foreground" role="dialog" aria-modal="true" aria-label="Animate">
      <header className="flex flex-wrap items-center gap-2 border-b border-black/10 bg-[var(--card)] px-3 py-2">
        <button className={iconBtn} onClick={onClose}>
          <ArrowLeft size={15} /> Design
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title} <span className="font-normal text-gold-dim">/ Animate</span>
        </p>
        {bar}
      </header>
      {children}
    </div>
  );
}

/** A small curve of how much the effect is doing across the loop (for the timeline). */
function Curve({ item, node, scene, anim, row, rows }: { item: MotionItem; node: FlyerNode; scene: Scene; anim: Animation; row: number; rows: number }) {
  const pts = useMemo(() => {
    const one: Animation = { ...anim, layers: { [node.id]: { stack: [item] } } };
    const vals = Array.from({ length: 49 }, (_, i) => {
      const s = evaluateFrame(scene, one, (i / 48) * anim.duration).get(node.id);
      if (!s) return 0;
      const o = s.overlays[0];
      // Signed, so back-and-forth motion reads as a wave (not a flat line).
      return s.dx + s.dy + (s.scale - 1) * 400 + s.rotate * 20 - (1 - s.opacity) * 200 + ((s.inner?.scale ?? 1) - 1) * 400 + (s.inner?.dx ?? 0) + (s.inner?.dy ?? 0) + ((s.reveal?.amount ?? 1) - 1) * 200 + s.trackingEm * 600 + (s.shadow?.dx ?? 0) + (o?.kind === "sweep" ? o.pos * 100 : o?.kind === "particles" ? o.items.reduce((m, p) => m + p.a, 0) : o ? o.alpha * 200 : 0);
    });
    const lo = Math.min(...vals);
    const span = Math.max(1e-6, Math.max(...vals) - lo);
    if (span < 1e-3) return vals.map((_, i) => `${(i / 48) * 100},50`).join(" ");
    return vals.map((v, i) => `${(i / 48) * 100},${95 - ((v - lo) / span) * 90}`).join(" ");
  }, [item, node.id, scene, anim]);
  const h = 100 / rows;
  return (
    <svg className="absolute left-0 w-full" style={{ top: `${row * h}%`, height: `${h}%` }} viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={PRESET_BY_ID.get(item.preset)?.name}>
      <polyline points={pts} fill="none" stroke="var(--gold)" strokeWidth={6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Advanced({
  anim,
  sel,
  cat,
  setCat,
  layer,
  setLayer,
  clip,
  setClip,
  custom,
  saveCustom,
  canMove,
  onRename,
  onRestack,
  onTry
}: {
  anim: Animation;
  sel: FlyerNode | null;
  cat: Category;
  setCat: (c: Category) => void;
  layer: LayerMotion | null;
  setLayer: (fn: (l: LayerMotion) => LayerMotion, label?: string, key?: string | null) => void;
  canMove: boolean;
  onRename: (name: string) => void;
  onRestack: (to: "front" | "forward" | "backward" | "back") => void;
  onTry: (presetId: string | null) => void;
  clip: MotionItem[] | null;
  setClip: (s: MotionItem[] | null) => void;
  custom: { name: string; stack: MotionItem[] }[];
  saveCustom: (name: string, stack: MotionItem[]) => void;
}) {
  const [customName, setCustomName] = useState("");
  // Leaving the panel (or picking another layer) ends any effect being tried.
  useEffect(() => () => onTry(null), [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sel || !layer) return <p className="text-sm text-muted">Select a layer on the left to add or adjust its motion.</p>;
  const role = roleOf(sel, layer.role);
  const full = layer.stack.length >= MAX_STACK;
  const patchItem = (id: string, p: Partial<MotionItem>, key?: string) => setLayer((l) => ({ ...l, stack: l.stack.map((x) => (x.id === id ? { ...x, ...p } : x)) }), "Adjust effect", key ?? `item:${id}:${Object.keys(p).join()}`);
  const swap = (id: string, presetId: string) =>
    setLayer((l) => ({ ...l, stack: l.stack.map((x) => (x.id === id ? { ...newItem(presetId), id: x.id, strength: x.strength, cycles: x.cycles, phase: x.phase } : x)) }), `Change to ${PRESET_BY_ID.get(presetId)?.name}`);
  const sample = sel.kind === "text" ? (sel.uppercase ? sel.text.toUpperCase() : sel.text).replace(/\s+/g, " ").replace(/\{\{[^}]*\}\}/g, "").trim().slice(0, 16) || "Text" : null;
  const sampleFont = sel.kind === "text" ? fontString(sel) : null;
  const move = (i: number, d: -1 | 1) =>
    setLayer((l) => {
      const s = [...l.stack];
      const j = i + d;
      if (j < 0 || j >= s.length) return l;
      [s[i], s[j]] = [s[j], s[i]];
      return { ...l, stack: s };
    }, "Reorder effects");
  const presets = MOTION_PRESETS.filter((p) => p.category === cat);
  return (
    <div className="flex flex-col gap-4" data-tour="animate-library">
      <div>
        <LayerNameField key={`${sel.id}:${sel.name}`} name={sel.name} onRename={onRename} />
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <RestackButtons canMove={canMove} onRestack={onRestack} />
        </div>
        <label className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          Role
          <select value={role} onChange={(e) => setLayer((l) => ({ ...l, role: e.target.value === sel.role ? undefined : (e.target.value as Role) }), "Change role")} className="rounded-[6px] border border-black/12 bg-transparent px-1.5 py-0.5">
            {(Object.keys(ROLES) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLES[r]}
                {r === sel.role ? " (from the template)" : ""}
              </option>
            ))}
          </select>
        </label>
        {anim.readableLock && isProtected(sel, role) && <p className="mt-1 flex items-center gap-1 text-[11px] text-muted"><Lock size={11} /> Kept readable: effects that hide it are off, movement is limited.</p>}
      </div>

      <section>
        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted">Motion Library</p>
        <p className="mb-1.5 text-[11px] text-muted">Point at an effect to see it play on {sel.name}. Click to add it.</p>
        <div className="mb-2 grid grid-cols-4 gap-1 text-[11px]" role="tablist">
          {CATS.map((c) => (
            <button key={c.key} role="tab" aria-selected={cat === c.key} onClick={() => setCat(c.key)} className={cn("rounded-[8px] py-1", cat === c.key ? "bg-gold font-semibold text-black" : "border border-black/10 text-muted")}>
              {c.label}
            </button>
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {presets.map((p) => {
            const fits = presetFits(p, sel, role, anim.readableLock);
            return (
              <li key={p.id}>
                <button
                  disabled={fits !== true || full}
                  title={fits !== true ? fits : full ? `Up to ${MAX_STACK} effects per layer` : p.description}
                  onClick={() => {
                    onTry(null);
                    setLayer((l) => ({ ...l, stack: [...l.stack, newItem(p.id)] }), `Add ${p.name}`);
                  }}
                  onMouseEnter={() => fits === true && onTry(p.id)}
                  onMouseLeave={() => onTry(null)}
                  onFocus={() => fits === true && onTry(p.id)}
                  onBlur={() => onTry(null)}
                  className="motion-card group w-full rounded-[10px] border border-black/10 p-2 text-left hover:border-gold focus-visible:border-gold focus-visible:outline-none disabled:opacity-40"
                  data-preset={p.id}
                >
                  <span className="mb-1 flex h-10 items-center justify-center overflow-hidden rounded-[6px] bg-[#16140f]" aria-hidden>
                    <span
                      className={cn("motion-thumb inline-block truncate px-1 text-[13px] leading-none text-[#f3e8cf]", `mt-${p.id.split(".")[1]}`)}
                      style={sample && sampleFont ? { fontFamily: `${sampleFont.family}, sans-serif`, fontWeight: Number(sampleFont.style.replace(/\D/g, "")) || 700 } : undefined}
                    >
                      {sample ?? (p.category === "photos" ? "◉ photo" : p.category === "backgrounds" ? "▦ background" : "✦ overlay")}
                    </span>
                  </span>
                  <span className="block text-xs font-medium leading-tight">{p.name}</span>
                  <span className="block text-[10px] leading-tight text-muted">{p.description}</span>
                  {fits !== true && <span className="block text-[10px] leading-tight text-muted">{fits}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <details className="mt-2 text-[11px] text-muted">
          <summary className="cursor-pointer">Not available yet ({PLANNED.filter((p) => p.id.startsWith(cat === "photos" ? "photos" : cat)).length} in {CATS.find((c) => c.key === cat)?.label})</summary>
          <ul className="mt-1 list-disc pl-4">
            {PLANNED.filter((p) => p.id.startsWith(cat === "photos" ? "photos" : cat)).map((p) => (
              <li key={p.id}>
                {p.name}: {p.why}
              </li>
            ))}
          </ul>
        </details>
        {custom.length > 0 && (
          <div className="mt-2">
            <p className="text-[11px] font-semibold text-muted">My presets (this device)</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {custom.map((c) => (
                <button key={c.name} className="rounded-full border border-black/12 px-2 py-0.5 text-[11px] hover:border-gold" onClick={() => setLayer((l) => ({ ...l, stack: c.stack.filter((x) => PRESET_BY_ID.has(x.preset)).slice(0, MAX_STACK).map((x) => ({ ...x, id: newItemId() })) }), `Use preset ${c.name}`)}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section data-tour="animate-stack">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">This layer&apos;s motion ({layer.stack.length}/{MAX_STACK})</p>
          <div className="flex gap-1">
            <button className={iconBtn} disabled={!layer.stack.length} onClick={() => setClip(layer.stack)} aria-label="Copy motion" title="Copy motion">
              <ClipboardCopy size={13} />
            </button>
            <button className={iconBtn} disabled={!clip} onClick={() => clip && setLayer((l) => ({ ...l, stack: clip.map((x) => ({ ...x, id: newItemId() })) }), "Paste motion")} aria-label="Paste motion" title="Paste motion">
              <ClipboardPaste size={13} />
            </button>
            <button className={iconBtn} disabled={!layer.stack.length} onClick={() => setLayer((l) => ({ ...l, stack: [] }), "Clear layer motion")} aria-label="Clear motion" title="Clear motion">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        {!layer.stack.length && <p className="text-xs text-muted">No motion yet: add one from the library.</p>}
        <ol className="flex flex-col gap-2">
          {layer.stack.map((it, i) => {
            const p = PRESET_BY_ID.get(it.preset)!;
            const fits = presetFits(p, sel, role, anim.readableLock);
            return (
              <li key={it.id} className="rounded-[10px] border border-black/10 p-2.5">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">{i + 1}.</span>
                  <select
                    value={it.preset}
                    onChange={(e) => swap(it.id, e.target.value)}
                    aria-label={`Change effect ${i + 1}`}
                    title="Change this effect"
                    className="min-w-0 flex-1 truncate rounded-[6px] border border-transparent bg-transparent py-0.5 text-sm font-medium hover:border-black/12"
                  >
                    {MOTION_PRESETS.filter((q) => q.id === it.preset || presetFits(q, sel, role, anim.readableLock) === true).map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.name} ({CATS.find((c) => c.key === q.category)?.label})
                      </option>
                    ))}
                  </select>
                  <button className="p-1 text-muted disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${p.name} up`}>
                    <ArrowUp size={13} />
                  </button>
                  <button className="p-1 text-muted disabled:opacity-30" disabled={i === layer.stack.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${p.name} down`}>
                    <ArrowDown size={13} />
                  </button>
                  <button className="p-1 text-status-declined" onClick={() => setLayer((l) => ({ ...l, stack: l.stack.filter((x) => x.id !== it.id) }), `Remove ${p.name}`)} aria-label={`Remove ${p.name}`} title="Remove this effect">
                    <X size={13} />
                  </button>
                </div>
                <p className="text-[11px] text-muted">{p.description}</p>
                {fits !== true && <p className="text-[11px] text-status-urgent">Paused: {fits}</p>}
                <Params item={it} params={p.params} onChange={(x) => patchItem(it.id, x)} />
              </li>
            );
          })}
        </ol>
        {layer.stack.length > 0 && (
          <form
            className="mt-2 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (customName.trim()) {
                saveCustom(customName.trim().slice(0, 40), layer.stack);
                setCustomName("");
              }
            }}
          >
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Save as my preset…" aria-label="Preset name" className="min-w-0 flex-1 rounded-[8px] border border-black/12 bg-transparent px-2 py-1 text-xs" />
            <button className={iconBtn} disabled={!customName.trim()}>
              <Plus size={13} /> Save
            </button>
          </form>
        )}
      </section>
      <style>{THUMB_CSS}</style>
    </div>
  );
}

function RestackButtons({ canMove, onRestack }: { canMove: boolean; onRestack: (to: "front" | "forward" | "backward" | "back") => void }) {
  const b = "inline-flex h-7 items-center gap-1 rounded-[7px] border border-black/12 px-2 text-[11px] disabled:opacity-40 hover:border-gold";
  if (!canMove) return <span className="text-[11px] text-muted">This layer is locked in the design, so it can&apos;t be moved here.</span>;
  return (
    <>
      <button className={b} onClick={() => onRestack("front")} title="Bring to front">
        <BringToFront size={12} /> Front
      </button>
      <button className={b} onClick={() => onRestack("forward")} title="Bring forward one" aria-label="Bring forward">
        <ChevronUp size={12} />
      </button>
      <button className={b} onClick={() => onRestack("backward")} title="Send back one" aria-label="Send backward">
        <ChevronDown size={12} />
      </button>
      <button className={b} onClick={() => onRestack("back")} title="Send to back">
        <SendToBack size={12} /> Back
      </button>
    </>
  );
}

/** Rename field: saves on Enter or when you leave it. */
function LayerNameField({ name, onRename }: { name: string; onRename: (v: string) => void }) {
  const [v, setV] = useState(name);
  return (
    <label className="flex items-center gap-1.5">
      <Pencil size={13} className="shrink-0 text-muted" aria-hidden />
      <input
        value={v}
        maxLength={60}
        aria-label="Layer name"
        onChange={(e) => setV(e.target.value)}
        onBlur={() => (v.trim() ? onRename(v) : setV(name))}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setV(name);
        }}
        className="min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold hover:border-black/12 focus:border-gold focus:outline-none"
        data-tour="animate-rename"
      />
    </label>
  );
}

/** Layer list name: click selects, double-click (or the pencil) renames in place. */
function LayerName({ node, selected, onSelect, onRename }: { node: FlyerNode; selected: boolean; onSelect: () => void; onRename: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(node.name);
  if (editing)
    return (
      <input
        autoFocus
        value={v}
        maxLength={60}
        aria-label={`Rename ${node.name}`}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v.trim()) onRename(v);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setV(node.name);
            setEditing(false);
          }
        }}
        className="w-full rounded-[6px] border border-gold bg-transparent px-1 py-0.5 text-sm font-medium focus:outline-none"
      />
    );
  return (
    <span className="flex items-center gap-1">
      <button onClick={onSelect} onDoubleClick={() => (setV(node.name), setEditing(true))} className={cn("min-w-0 flex-1 truncate text-left text-sm font-medium", selected && "text-gold-dim")}>
        {node.name}
      </button>
      <button className="p-0.5 text-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => (setV(node.name), setEditing(true))} aria-label={`Rename ${node.name}`} title="Rename">
        <Pencil size={12} />
      </button>
    </span>
  );
}

/** Simple mode: the layer picked on the flyer, with its name, order and motion. */
function LayerCard({ node, anim, canMove, onRename, onRestack, onRemove, onEdit, onClose }: { node: FlyerNode; anim: Animation; canMove: boolean; onRename: (v: string) => void; onRestack: (to: "front" | "forward" | "backward" | "back") => void; onRemove: (itemId: string) => void; onEdit: () => void; onClose: () => void }) {
  const stack = anim.layers[node.id]?.stack ?? [];
  return (
    <section className="rounded-[12px] border border-gold/60 bg-gold/5 p-3" aria-label="Selected layer" data-tour="animate-layer-card">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <LayerNameField key={`${node.id}:${node.name}`} name={node.name} onRename={onRename} />
        </div>
        <button className="p-1 text-muted" onClick={onClose} aria-label="Deselect layer">
          <X size={14} />
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted">{canMove ? "Drag it on the flyer to move it; use the handles to resize or turn it." : "Locked in the design."}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <RestackButtons canMove={canMove} onRestack={onRestack} />
      </div>
      <p className="mt-3 text-xs font-semibold">Motion on this layer</p>
      {stack.length ? (
        <ul className="mt-1 flex flex-col gap-1">
          {stack.map((it) => (
            <li key={it.id} className="flex items-center gap-1 text-xs">
              <span className="min-w-0 flex-1 truncate">{PRESET_BY_ID.get(it.preset)?.name}</span>
              <button className="p-0.5 text-status-declined" onClick={() => onRemove(it.id)} aria-label={`Remove ${PRESET_BY_ID.get(it.preset)?.name}`} title="Remove">
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[11px] text-muted">None yet.</p>
      )}
      <button className="mt-2 text-xs font-semibold text-gold-dim underline" onClick={onEdit}>
        Add or change motion (Advanced)
      </button>
    </section>
  );
}

/** Simple mode: every effect on the flyer right now, with remove and change. */
function MotionSummary({ nodes, anim, onPick, onRemove, onClearAll }: { nodes: FlyerNode[]; anim: Animation; onPick: (id: string) => void; onRemove: (layerId: string, itemId: string) => void; onClearAll: () => void }) {
  const rows = nodes.filter((n) => anim.layers[n.id]?.stack.length);
  if (!rows.length) return null;
  return (
    <div className="mt-3 rounded-[12px] border border-black/10 p-3" data-tour="animate-summary">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">Motion on this flyer now</p>
        <button className="text-[11px] text-status-declined underline" onClick={onClearAll}>
          Remove all motion
        </button>
      </div>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {rows.map((n) => (
          <li key={n.id} className="text-xs">
            <button className="font-medium hover:text-gold-dim hover:underline" onClick={() => onPick(n.id)} title="Change this layer's motion">
              {n.name}
            </button>
            <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
              {anim.layers[n.id].stack.map((it) => (
                <span key={it.id} className="inline-flex items-center gap-0.5 rounded-full bg-black/5 py-0.5 pl-2 pr-1 text-[11px]">
                  {PRESET_BY_ID.get(it.preset)?.name}
                  <button onClick={() => onRemove(n.id, it.id)} aria-label={`Remove ${PRESET_BY_ID.get(it.preset)?.name} from ${n.name}`} className="rounded-full p-0.5 text-muted hover:text-status-declined">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] text-muted">Click a layer name to change its effects. Undo (top bar) steps back through every change.</p>
    </div>
  );
}

function Params({ item, params, onChange }: { item: MotionItem; params: ParamKey[]; onChange: (p: Partial<MotionItem>) => void }) {
  const row = "grid grid-cols-[6.5rem_1fr] items-center gap-2 text-[11px]";
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {params.includes("strength") && (
        <label className={row}>
          <span className="text-muted">{PARAM_LABEL.strength}</span>
          <input type="range" min={0} max={1} step={0.01} value={item.strength} onChange={(e) => onChange({ strength: Number(e.target.value) })} className="accent-[var(--gold)]" />
        </label>
      )}
      {params.includes("cycles") && (
        <label className={row}>
          <span className="text-muted">{PARAM_LABEL.cycles}</span>
          <select value={item.cycles} onChange={(e) => onChange({ cycles: Number(e.target.value) })} className="rounded border border-black/12 bg-transparent px-1 py-0.5">
            {[1, 2, 3, 4, 6, 8].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
      {params.includes("phase") && (
        <label className={row}>
          <span className="text-muted">{PARAM_LABEL.phase}</span>
          <input type="range" min={0} max={0.99} step={0.01} value={item.phase} onChange={(e) => onChange({ phase: Number(e.target.value) })} className="accent-[var(--gold)]" />
        </label>
      )}
      {params.includes("easing") && (
        <label className={row}>
          <span className="text-muted">{PARAM_LABEL.easing}</span>
          <select value={item.easing} onChange={(e) => onChange({ easing: e.target.value as MotionItem["easing"] })} className="rounded border border-black/12 bg-transparent px-1 py-0.5">
            <option value="easeInOut">Ease in & out</option>
            <option value="easeOut">Ease out</option>
            <option value="linear">Linear</option>
          </select>
        </label>
      )}
      {params.includes("direction") && (
        <label className={row}>
          <span className="text-muted">{PARAM_LABEL.direction}</span>
          <select value={item.direction ?? "up"} onChange={(e) => onChange({ direction: e.target.value as MotionItem["direction"] })} className="rounded border border-black/12 bg-transparent px-1 py-0.5">
            {["up", "down", "left", "right"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      )}
      {params.includes("color") && (
        <label className={row}>
          <span className="text-muted">{PARAM_LABEL.color}</span>
          <input type="color" value={item.color ?? "#ffffff"} onChange={(e) => onChange({ color: e.target.value })} className="h-6 w-10" />
        </label>
      )}
      {params.includes("blend") && (
        <label className={row}>
          <span className="text-muted">{PARAM_LABEL.blend}</span>
          <select value={item.blend ?? "screen"} onChange={(e) => onChange({ blend: e.target.value as MotionItem["blend"] })} className="rounded border border-black/12 bg-transparent px-1 py-0.5">
            {["screen", "normal", "overlay", "soft-light", "multiply"].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
      )}
      {params.includes("seed") && (
        <label className={row}>
          <span className="text-muted">{PARAM_LABEL.seed}</span>
          <span className="flex items-center gap-1">
            <input type="number" min={0} max={99999} value={item.seed ?? 48} onChange={(e) => onChange({ seed: Number(e.target.value) })} className="w-20 rounded border border-black/12 bg-transparent px-1 py-0.5" />
            <button type="button" aria-label="New seed" onClick={() => onChange({ seed: Math.floor(Math.random() * 99999) })}>
              <RefreshCw size={12} />
            </button>
          </span>
        </label>
      )}
      {params.includes("timing") && (
        <label className={row}>
          <span className="text-muted">{PARAM_LABEL.timing}</span>
          <span className="flex items-center gap-1">
            <input type="range" min={0.05} max={0.45} step={0.01} value={item.timing?.in ?? 0.18} onChange={(e) => onChange({ timing: { in: Number(e.target.value), out: item.timing?.out ?? 0.18 } })} aria-label="Entrance" className="w-1/2 accent-[var(--gold)]" />
            <input type="range" min={0.05} max={0.45} step={0.01} value={item.timing?.out ?? 0.18} onChange={(e) => onChange({ timing: { in: item.timing?.in ?? 0.18, out: Number(e.target.value) } })} aria-label="Exit" className="w-1/2 accent-[var(--gold)]" />
          </span>
        </label>
      )}
    </div>
  );
}

/** Library thumbnails move only on hover / keyboard focus (saves CPU). */
const THUMB_CSS = `
.motion-card:hover .motion-thumb, .motion-card:focus-visible .motion-thumb { animation-duration: 1.6s; animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
.motion-card:hover .mt-fade, .motion-card:focus-visible .mt-fade { animation-name: mtFade; }
.motion-card:hover .mt-slide, .motion-card:focus-visible .mt-slide { animation-name: mtSlide; }
.motion-card:hover .mt-pulse, .motion-card:focus-visible .mt-pulse { animation-name: mtPulse; }
.motion-card:hover .mt-tracking, .motion-card:focus-visible .mt-tracking { animation-name: mtTrack; }
.motion-card:hover .mt-shadow, .motion-card:focus-visible .mt-shadow { animation-name: mtShadow; }
.motion-card:hover .mt-letter-reveal, .motion-card:hover .mt-word-reveal { animation-name: mtReveal; }
.motion-card:hover .mt-float, .motion-card:hover .mt-zoom, .motion-card:hover .mt-pan { animation-name: mtSlide; }
.motion-card:hover .mt-light, .motion-card:hover .mt-sparkle, .motion-card:hover .mt-dust, .motion-card:hover .mt-leak, .motion-card:hover .mt-vignette { animation-name: mtFade; }
@keyframes mtFade { 50% { opacity: .35 } }
@keyframes mtSlide { 50% { transform: translateY(-4px) } }
@keyframes mtPulse { 50% { transform: scale(1.12) } }
@keyframes mtTrack { 50% { letter-spacing: .35em } }
@keyframes mtShadow { 50% { text-shadow: 4px 4px 2px #000 } }
@keyframes mtReveal { 0% { clip-path: inset(0 100% 0 0) } 60% { clip-path: inset(0 0 0 0) } 100% { clip-path: inset(0 100% 0 0) } }
@media (prefers-reduced-motion: reduce) { .motion-thumb { animation: none !important } }
`;

function LoopCheck({ scene, ctx, anim, reduced, onClose, onPlay }: { scene: Scene; ctx: SrcContext; anim: Animation; reduced: boolean; onClose: () => void; onPlay: () => void }) {
  const report: LoopReport = useMemo(() => checkLoop(scene, anim), [scene, anim]);
  const N = frameCount(anim);
  const last = useMemo(() => evaluateFrame(scene, anim, frameTime(anim, N - 1), { reduced }), [scene, anim, N, reduced]);
  const first = useMemo(() => evaluateFrame(scene, anim, 0, { reduced }), [scene, anim, reduced]);
  // Three repetitions back to back, in a small player.
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
  const w = 170;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Check loop">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[16px] bg-[var(--card)] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Check loop</h2>
          <button className={iconBtn} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <figure>
            <ScenePreview scene={scene} width={w} ctx={ctx} motion={loop} />
            <figcaption className="mt-1 text-xs text-muted">Playing {Math.min(3, Math.floor(i / N) + 1)} of 3 loops</figcaption>
          </figure>
          <figure>
            <ScenePreview scene={scene} width={w} ctx={ctx} motion={last} />
            <figcaption className="mt-1 text-xs text-muted">Last frame ({N} of {N})</figcaption>
          </figure>
          <figure>
            <ScenePreview scene={scene} width={w} ctx={ctx} motion={first} />
            <figcaption className="mt-1 text-xs text-muted">First frame (1 of {N})</figcaption>
          </figure>
        </div>
        <div className={cn("mt-4 rounded-[10px] border p-3 text-sm", report.ok ? "border-status-approved/40" : "border-status-urgent/50")} role="status">
          {report.ok ? (
            <p>No sudden changes found between the last and first frame. This check looks at the motion settings; watch the loop above to be sure.</p>
          ) : (
            <>
              <p className="font-semibold text-status-urgent">Possible seam</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {report.issues.map((x) => (
                  <li key={x.nodeId}>
                    {x.name} {x.what}.
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button className={iconBtn} onClick={() => (onClose(), onPlay())}>
            <Play size={14} /> Play in the editor
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportDialog({ scene, ctx, anim, title, onClose }: { scene: Scene; ctx: SrcContext; anim: Animation; title: string; onClose: () => void }) {
  const [run, setRun] = useState(1);
  const [tries, setTries] = useState(0);
  const [p, setP] = useState<ExportProgress>({ phase: "preparing", frame: 0, frames: frameCount(anim) });
  const cancel = useRef(false);
  const url = useMemo(() => (p.phase === "done" && p.blob ? URL.createObjectURL(p.blob) : null), [p.phase, p.blob]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  const busy = p.phase === "preparing" || p.phase === "rendering" || p.phase === "finishing";
  const name = `${title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "flyer"}-${scene.width}x${scene.height}-${anim.duration}s.mp4`;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Export video">
      <div className="w-full max-w-md rounded-[16px] bg-[var(--card)] p-5 shadow-2xl">
        <h2 className="text-lg font-semibold">Export MP4</h2>
        <p className="mt-1 text-xs text-muted">
          {scene.width}×{scene.height} · {anim.duration} s · 30 fps · {frameCount(anim)} frames · H.264 · no sound. Made on this device, frame by frame; keep this tab open.
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuenow={p.frame} aria-valuemax={p.frames} aria-label="Export progress">
          <div className="h-full bg-gold transition-[width]" style={{ width: `${(p.frame / Math.max(1, p.frames)) * 100}%` }} />
        </div>
        <p className="mt-2 text-sm" role="status">
          {p.phase === "preparing" && "Loading fonts and pictures…"}
          {p.phase === "rendering" && `Drawing frame ${p.frame} of ${p.frames}…`}
          {p.phase === "finishing" && "Finishing the video…"}
          {p.phase === "done" && `Ready: ${((p.blob?.size ?? 0) / 1e6).toFixed(1)} MB.`}
          {p.phase === "cancelled" && "Cancelled. Nothing was saved."}
          {p.phase === "error" && <span className="text-status-declined">{p.message}</span>}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {busy && (
            <button className={iconBtn} onClick={() => (cancel.current = true)}>
              Cancel
            </button>
          )}
          {url && (
            <a href={url} download={name} className={cn(iconBtn, "border-gold bg-gold font-semibold text-black")}>
              <Download size={14} /> Download {name.length > 34 ? "MP4" : name}
            </a>
          )}
          {(p.phase === "error" || p.phase === "cancelled") && tries < 2 && (
            <button
              className={iconBtn}
              onClick={() => {
                cancel.current = false;
                setTries((n) => n + 1);
                setP({ phase: "preparing", frame: 0, frames: frameCount(anim) });
                setRun((r) => r + 1);
              }}
            >
              <RefreshCw size={14} /> Try again
            </button>
          )}
          <button className={iconBtn} onClick={() => ((cancel.current = true), onClose())}>
            Close
          </button>
        </div>
      </div>
      {!(p.phase === "done" || p.phase === "error" || p.phase === "cancelled") && <VideoRenderer key={run} scene={scene} ctx={ctx} anim={anim} onProgress={setP} cancelRef={cancel} />}
    </div>
  );
}
