"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioWaveform, Check, ChevronDown, Copy, Download, Eye, EyeOff, GripVertical, Infinity as InfinityIcon, Layers, Lock, Maximize, Minimize, Pause, Play, Plus, SkipBack, SkipForward, Sparkles, Trash2, VolumeX, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { FlyerStage, type NodePatch } from "../flyer-canvas";
import { fontString, loadSceneFonts, type SrcContext } from "../loaders";
import { FORMATS, ROLES, type FlyerNode, type FormatKey, type Role, type Scene } from "@/lib/flyers/types";
import { duplicateNodes, newText } from "@/lib/flyers/scene";
import { MOTION_PRESETS, PLANNED, PRESET_BY_ID, isProtected, presetFits, roleOf, type Category } from "@/lib/flyers/motion/presets";
import { evaluateFrame, frameCount, frameTime } from "@/lib/flyers/motion/engine";
import { RECIPES, applyRecipe, newItem, newItemId, planRecipe } from "@/lib/flyers/motion/recipes";
import { DURATIONS, MAX_STACK, emptyAnimation, type Animation, type Intensity, type LayerMotion, type MotionItem } from "@/lib/flyers/motion/types";
import { parseAnimation } from "@/lib/flyers/motion/schema";
import { EffectControls, ExportQueue, KeyInspector, KindIcon, LoopCheck, T, Timeline, fmt, kindLabel } from "./animate-parts";

/**
 * Animate (the Flyer Animator): the same flyer and its own layers, with
 * motion added on top. Layers on the left, the flyer in the middle, the
 * Motion Library and the picked effect's controls on the right, and the
 * timeline across the bottom. Simple mode starts on ready-made motion
 * styles with a shorter timeline; Advanced is for per-layer effects and
 * keyframes (both use the same layout).
 *
 * Motion is saved on the flyer next to the layout. Moving, renaming,
 * adding or removing layers here changes the flyer's layout (the same as
 * in Design), and one undo history covers motion and layout.
 */

type Tab = "styles" | Category;
const TABS: { key: Tab; label: string }[] = [
  { key: "styles", label: "Styles" },
  { key: "text", label: "Text" },
  { key: "photos", label: "Photos" },
  { key: "backgrounds", label: "Backgrounds" },
  { key: "overlays", label: "Overlays" },
  { key: "fx", label: "Glitch" }
];
const INTENSITIES: { key: Intensity; label: string }[] = [
  { key: "subtle", label: "Subtle" },
  { key: "balanced", label: "Balanced" },
  { key: "high", label: "High Energy" }
];
const CUSTOM_KEY = "dcdj-motion-presets-v1";

/** One undo step: the motion and the layers as they were, and what the step did. */
type Snap = { anim: Animation; nodes: FlyerNode[]; label: string };
type Hist = { past: Snap[]; future: Snap[]; lastKey: string | null; lastAt: number };

function loadCustom(): { name: string; stack: MotionItem[] }[] {
  try {
    const v = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]");
    return Array.isArray(v) ? v.slice(0, 30) : [];
  } catch {
    return [];
  }
}

const tabFor = (n: FlyerNode): Tab => (n.kind === "text" ? "text" : n.role === "background" ? "backgrounds" : n.role === "overlay" ? "overlays" : "photos");

export type AnimateSource = { kind: "design"; id: string } | { kind: "template"; id: string; format: FormatKey };

export function AnimateWorkspace({
  source,
  scene,
  ctx,
  title,
  onClose,
  onNodes,
  canMove,
  canRemove
}: {
  /** Where the motion is saved: a flyer, or one size of a template's draft. */
  source: AnimateSource;
  scene: Scene;
  ctx: SrcContext;
  title: string;
  onClose: () => void;
  /** Writes layer changes (move, resize, rename, order, add, delete) to the flyer's layout; the editor saves them. */
  onNodes: (nodes: FlyerNode[]) => void;
  canMove: (n: FlyerNode) => boolean;
  canRemove?: (n: FlyerNode) => boolean;
}) {
  const [anim, setAnim] = useState<Animation | null>(null);
  const [hist, setHist] = useState<Hist>({ past: [], future: [], lastKey: null, lastAt: 0 });
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [quality, setQuality] = useState<"draft" | "normal" | "full">("normal");
  const [tab, setTab] = useState<Tab>("styles");
  const [preview, setPreview] = useState<Animation | null>(null);
  const [trial, setTrial] = useState<Animation | null>(null);
  const trialStartedPlay = useRef(false);
  const [confirmRecipe, setConfirmRecipe] = useState<string | null>(null);
  const [clip, setClip] = useState<LayerMotion | null>(null);
  const [custom, setCustom] = useState<{ name: string; stack: MotionItem[] }[]>(loadCustom);
  const [save, setSave] = useState<{ state: "saved" | "saving" | "error" | "idle"; msg?: string }>({ state: "idle" });
  const [loopOpen, setLoopOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [durOpen, setDurOpen] = useState(false);
  const [fontsKey, setFontsKey] = useState(0);
  const [full, setFull] = useState(false);
  const dirty = useRef(false);
  const animRef = useRef<Animation | null>(null);
  const sceneRef = useRef(scene);
  useEffect(() => {
    animRef.current = anim;
    sceneRef.current = scene;
  });

  // Load the saved settings once (or start empty).
  useEffect(() => {
    let live = true;
    fetch(source.kind === "design" ? `/api/flyers/designs/${source.id}` : `/api/admin/flyers/templates/${source.id}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!live) return;
        if (!ok) return setLoadErr(j.error ?? (source.kind === "design" ? "Couldn't open this flyer." : "Couldn't open this template."));
        const saved = source.kind === "design" ? (j.design?.animation ?? null) : ((j.template?.animation ?? null)?.[source.format] ?? null);
        const p = parseAnimation(saved);
        const base = p.ok && p.value ? p.value : emptyAnimation();
        const nodesNow = sceneRef.current.nodes;
        // Motion on layers that were since deleted is dropped.
        setAnim({ ...base, layers: Object.fromEntries(Object.entries(base.layers).filter(([id]) => nodesNow.some((n) => n.id === id))) });
        if (source.kind === "design" && !("animation" in (j.design ?? {}))) setSave({ state: "error", msg: "Saving needs migration 0069_flyer_animation.sql in Supabase. You can still preview and export." });
        if (source.kind === "template" && j.template?.animation === undefined) setSave({ state: "error", msg: "Saving motion on templates needs migration 0071_flyer_template_animation.sql in Supabase. You can still preview and export." });
      })
      .catch(() => live && setLoadErr("Couldn't open this flyer."));
    loadSceneFonts([sceneRef.current]).then(() => live && setFontsKey((k) => k + 1));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.kind, source.id, source.kind === "template" ? source.format : ""]);

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

  /** One undo step (quick repeats with the same key, like a slider drag, merge into one). */
  const record = useCallback((label: string, key: string | null) => {
    const cur = animRef.current;
    if (!cur) return;
    const now = Date.now();
    setHist((h) => {
      if (key && key === h.lastKey && now - h.lastAt < 900 && h.past.length) return { ...h, lastAt: now };
      return { past: [...h.past.slice(-80), { anim: cur, nodes: sceneRef.current.nodes, label }], future: [], lastKey: key, lastAt: now };
    });
  }, []);
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
    if (!hist.past.length || !anim) return;
    const prev = hist.past[hist.past.length - 1];
    setHist({ past: hist.past.slice(0, -1), future: [{ anim, nodes: scene.nodes, label: prev.label }, ...hist.future], lastKey: null, lastAt: 0 });
    restore(prev);
  };
  const redo = () => {
    if (!hist.future.length || !anim) return;
    const next = hist.future[0];
    setHist({ past: [...hist.past, { anim, nodes: scene.nodes, label: next.label }], future: hist.future.slice(1), lastKey: null, lastAt: 0 });
    restore(next);
  };

  const saveNow = useCallback(
    async (a: Animation) => {
      setSave({ state: "saving" });
      try {
        const r =
          source.kind === "design"
            ? await fetch(`/api/flyers/designs/${source.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ animation: a }) })
            : await fetch(`/api/admin/flyers/templates/${source.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ animation: { format: source.format, value: a } }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Couldn't save");
        dirty.current = false;
        setSave({ state: "saved" });
      } catch (e) {
        setSave({ state: "error", msg: e instanceof Error ? e.message : "Couldn't save" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source.kind, source.id, source.kind === "template" ? source.format : ""]
  );
  useEffect(() => {
    if (!anim || !dirty.current) return;
    const h = setTimeout(() => void saveNow(anim), 1200);
    return () => clearTimeout(h);
  }, [anim, saveNow]);

  const layerOf = (id: string): LayerMotion => anim?.layers[id] ?? { stack: [] };
  const setLayer = (id: string, fn: (l: LayerMotion) => LayerMotion, label = "Change motion", key: string | null = null) => change((a) => ({ ...a, layers: { ...a.layers, [id]: fn(a.layers[id] ?? { stack: [] }) } }), label, key);
  const locked = (id: string) => !!anim?.layers[id]?.locked;

  // Front of the list = front of the flyer (scene order is back to front).
  const nodes = [...scene.nodes].filter((n) => n.visible).reverse();

  /** Moves a layer to a place in the list (list index, front first). */
  const moveTo = (id: string, listIndex: number) =>
    changeNodes((ns) => {
      const list = [...ns].filter((n) => n.visible).reverse();
      const from = list.findIndex((n) => n.id === id);
      if (from < 0 || listIndex === from || listIndex < 0 || listIndex >= list.length) return ns;
      const reordered = [...list];
      const [n] = reordered.splice(from, 1);
      reordered.splice(listIndex, 0, n);
      // Hidden-in-design layers keep their place at the back.
      return [...ns.filter((x) => !x.visible), ...reordered.reverse()];
    }, "Reorder layers");

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select, [role=slider], [data-grip]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (selected && e.key.startsWith("Arrow")) {
        const n = scene.nodes.find((x) => x.id === selected);
        if (!n || n.locked || locked(n.id) || !canMove(n)) return;
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
        const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
        changeNodes((ns) => ns.map((x) => (x.id === n.id ? ({ ...x, x: x.x + dx, y: x.y + dy } as FlyerNode) : x)), `Move ${n.name}`, `nudge:${n.id}`);
      } else if (e.key === "," || e.key === ".") {
        setPlaying(false);
        setFrame((f) => (((f % N) + (e.key === "," ? -1 : 1)) % N + N) % N);
      } else if (e.key === "Escape") {
        setSelected(null);
        setSelectedKey(null);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const sel = scene.nodes.find((n) => n.id === selected) ?? null;
  const selLayer = sel ? layerOf(sel.id) : null;
  const selRole = sel ? roleOf(sel, selLayer?.role) : null;
  const item = selLayer?.stack.find((x) => x.id === selectedItem) ?? selLayer?.stack[0] ?? null;

  const select = (id: string | null) => {
    setSelected(id);
    setSelectedKey(null);
    setSelectedItem(null);
    const n = id ? scene.nodes.find((x) => x.id === id) : null;
    if (n && (tab === "styles" || mode === "advanced")) setTab(tabFor(n));
  };
  const rename = (id: string, name: string) => {
    const clean = name.trim().slice(0, 60);
    if (clean) changeNodes((ns) => ns.map((n) => (n.id === id && n.name !== clean ? ({ ...n, name: clean } as FlyerNode) : n)), "Rename layer", `name:${id}`);
  };
  const addText = () => {
    const n = { ...newText("text", scene, { text: "NEW TEXT", x: Math.round(scene.width * 0.1), y: Math.round(scene.height * 0.45) }), name: "New text" } as FlyerNode;
    changeNodes((ns) => [...ns, n], "Add text layer");
    setSelected(n.id);
    setTab("text");
  };
  const duplicate = (id: string) => {
    const r = duplicateNodes(scene.nodes, [id]);
    changeNodes(() => r.nodes, "Duplicate layer");
    const copy = r.newIds[0];
    const src = anim?.layers[id];
    if (copy && src) setLayer(copy, () => ({ ...src, stack: src.stack.map((x) => ({ ...x, id: newItemId() })), keys: src.keys?.map((k) => ({ ...k, id: newItemId() })), locked: false }), "Duplicate layer");
    if (copy) setSelected(copy);
  };
  const remove = (id: string) => {
    changeNodes((ns) => ns.filter((n) => n.id !== id), "Delete layer");
    setSelected(null);
  };
  const applyPatches = (patches: NodePatch[], key: string) => {
    const names = patches.map((p) => scene.nodes.find((n) => n.id === p.id)?.name).filter(Boolean);
    changeNodes(
      (ns) =>
        ns.map((n) => {
          const p = patches.find((x) => x.id === n.id);
          return p ? ({ ...n, ...p.patch } as FlyerNode) : n;
        }),
      `Move ${names.join(", ") || "layer"}`,
      key
    );
  };
  /** Pointing at an effect plays it on the selected layer, alone (nothing is added). */
  const tryPreset = (presetId: string | null) => {
    if (!presetId || !anim || !selected) {
      setTrial(null);
      if (trialStartedPlay.current) setPlaying(false);
      trialStartedPlay.current = false;
      return;
    }
    const l = anim.layers[selected] ?? { stack: [] };
    setTrial({ ...anim, layers: { ...anim.layers, [selected]: { ...l, muted: false, solo: true, hidden: false, stack: [...l.stack.slice(0, MAX_STACK - 1), newItem(presetId)] } } });
    if (!playing) {
      trialStartedPlay.current = true;
      setPlaying(true);
    }
  };

  // Fit the flyer to the canvas area (callback ref: the area exists only once settings load).
  const [wrapEl, wrap] = useState<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(0.3);
  useEffect(() => {
    const el = wrapEl;
    if (!el) return;
    const ro = new ResizeObserver(() => setZoom(Math.max(0.08, Math.min((el.clientWidth - 16) / scene.width, (el.clientHeight - 16) / scene.height))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [wrapEl, scene.width, scene.height]);
  // Preview quality: effects and pixel passes at a lower resolution while you work; the export is always full size.
  const pctx = useMemo(() => ({ ...ctx, fxScale: quality === "full" ? 1 : quality === "draft" ? 0.3 : Math.min(1, Math.max(0.3, zoom * 1.5)) }), [ctx, zoom, quality]);
  const canvasCard = useRef<HTMLElement>(null);
  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  if (loadErr || !anim)
    return (
      <Shell>
        <p className={cn("p-6 text-sm", loadErr ? "text-[#ff8a8a]" : T.muted)}>{loadErr ?? "Opening Animate…"}</p>
        <button className={cn(T.btn, "mx-6 self-start")} onClick={onClose}>
          Back to the design
        </button>
      </Shell>
    );

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
  const clearAll = () => change((a) => ({ ...a, recipe: null, layers: Object.fromEntries(Object.entries(a.layers).map(([k, l]) => [k, { ...l, stack: [], keys: undefined, window: undefined, hidden: undefined }])) }), "Remove all motion");
  const removeItem = (layerId: string, itemId: string) => setLayer(layerId, (l) => ({ ...l, stack: l.stack.filter((x) => x.id !== itemId) }), `Remove ${PRESET_BY_ID.get(layerOf(layerId).stack.find((x) => x.id === itemId)?.preset ?? "")?.name ?? "effect"}`);
  const undoLabel = hist.past.length ? hist.past[hist.past.length - 1].label : null;
  const redoLabel = hist.future.length ? hist.future[0].label : null;
  /** Clicking an effect: adds it to the layer (or picks it if it's already there) and opens its controls. */
  const pickEffect = (presetId: string) => {
    if (!sel || locked(sel.id)) return;
    tryPreset(null);
    setSelectedKey(null);
    const existing = layerOf(sel.id).stack.find((x) => x.preset === presetId);
    if (existing) return setSelectedItem(existing.id);
    if (layerOf(sel.id).stack.length >= MAX_STACK) return;
    const it = newItem(presetId);
    setLayer(sel.id, (l) => ({ ...l, stack: [...l.stack, it] }), `Add ${PRESET_BY_ID.get(presetId)?.name}`);
    setSelectedItem(it.id);
  };
  const sample =
    sel?.kind === "text"
      ? ((sel.uppercase ? sel.text.toUpperCase() : sel.text).replace(/\{\{[^}|]*\|?([^}]*)\}\}/g, "$1").replace(/\s+/g, " ").trim().split(" ")[0] || "TEXT").slice(0, 9)
      : "TEXT";
  const sampleFont = sel?.kind === "text" ? fontString(sel) : null;
  const libPresets = tab === "styles" ? [] : MOTION_PRESETS.filter((p) => p.category === tab || p.also?.includes(tab));
  const pct = ((frame % N) / Math.max(1, N - 1)) * 100;

  return (
    <Shell>
      {/* ---------------- header ---------------- */}
      <header className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5", T.line)}>
        <div className="flex items-center gap-2">
          <AudioWaveform size={26} className="text-[#c6f432]" aria-hidden />
          <span className="text-[19px] font-black tracking-tight">CRATESDJS</span>
          <span className="hidden text-[15px] text-[#c9cbc0] 2xl:inline">Flyer Animator</span>
        </div>
        <span className={cn("hidden h-7 border-l md:block", T.line)} />
        <nav className="flex min-w-0 items-center gap-2 text-[17px]" aria-label="Breadcrumb">
          <button onClick={onClose} className="hover:underline" title={`Back to the design: ${title}`}>
            {source.kind === "template" ? "Flyer Template" : "Flyer Creator"}
          </button>
          <span className={T.muted}>/</span>
          <span className="font-semibold text-[#c6f432]">Animate</span>
          {source.kind === "template" && (
            <span className="rounded-full border border-[#2e2f29] px-2 py-0.5 text-[11px] text-[#c9cbc0]" title="Motion is saved for this size. New flyers made from this template start with it after you publish.">
              {FORMATS[source.format].label} size
            </span>
          )}
          <span className={cn("hidden max-w-56 truncate text-xs 2xl:inline", T.muted)}>{title}</span>
        </nav>
        <div className="flex rounded-full border border-[#2e2f29] p-0.5 text-xs" role="tablist" aria-label="Animate mode" data-tour="animate-mode">
          {(["simple", "advanced"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                if (m === "simple") setTab("styles");
                else if (sel) setTab(tabFor(sel));
              }}
              className={cn("rounded-full px-3 py-1 capitalize", mode === m ? "bg-[#c6f432] font-semibold text-[#10120a]" : "text-[#c9cbc0]")}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <span className={cn("text-[11px]", save.state === "error" ? "text-[#ff8a8a]" : T.muted)} title={save.msg} role="status">
            {save.state === "saving" ? "Saving…" : save.state === "saved" ? "Saved" : save.state === "error" ? (save.msg ?? "Not saved") : ""}
          </span>
          <span className="hidden text-[15px] lg:inline">Duration:</span>
          <div className="relative">
            <button className={cn(T.btn, "h-10 gap-3 px-4 text-[15px]")} onClick={() => setDurOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={durOpen} aria-label={`Duration: ${anim.duration} seconds`}>
              {anim.duration} seconds <ChevronDown size={15} />
            </button>
            {durOpen && (
              <ul role="listbox" aria-label="Duration" className={cn(T.panel, "absolute right-0 top-11 z-50 w-40 p-1 shadow-xl")}>
                {DURATIONS.map((d) => (
                  <li key={d}>
                    <button
                      role="option"
                      aria-selected={anim.duration === d}
                      className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-sm hover:bg-[#22231e]"
                      onClick={() => {
                        change((a) => ({ ...a, duration: d }), "Change duration");
                        setDurOpen(false);
                      }}
                    >
                      {d} seconds {anim.duration === d && <Check size={14} className="text-[#c6f432]" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <span className={cn("hidden h-7 border-l lg:block", T.line)} />
          <button className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#c6f432] px-3.5 text-[15px] text-[#c6f432] hover:bg-[#c6f432]/10" onClick={() => setLoopOpen(true)} title="Every video loops seamlessly. Click to check the loop point." data-tour="animate-check-loop">
            <InfinityIcon size={20} /> Loop enabled
          </button>
          <button className={cn(T.limeBtn, "h-10 text-[15px]")} onClick={() => setExportOpen(true)} data-tour="animate-export">
            <Download size={18} /> Export video
          </button>
        </div>
      </header>

      {/* ---------------- panels ---------------- */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(250px,24%)_minmax(0,1fr)_minmax(330px,33%)] lg:grid-rows-[minmax(0,1fr)_auto] lg:overflow-hidden">
        {/* Layers */}
        <section className={cn(T.panel, "order-2 flex h-[340px] flex-col lg:order-none lg:h-auto lg:min-h-0")} aria-label="Layers" data-tour="animate-layers">
          <div className={cn("flex items-center gap-2 border-b px-4 py-3", T.line)}>
            <Layers size={20} className="text-[#c9cbc0]" aria-hidden />
            <h2 className="flex-1 text-[17px] font-semibold">Layers</h2>
            <button className={T.icon} onClick={addText} aria-label="Add a text layer" title="Add a text layer">
              <Plus size={19} />
            </button>
            <button className={T.icon} disabled={!sel || locked(sel.id)} onClick={() => sel && duplicate(sel.id)} aria-label="Duplicate the selected layer" title="Duplicate">
              <Copy size={17} />
            </button>
            <button className={T.icon} disabled={!sel || locked(sel.id) || (canRemove ? !canRemove(sel) : false)} onClick={() => sel && remove(sel.id)} aria-label="Delete the selected layer" title="Delete (you can undo)">
              <Trash2 size={17} />
            </button>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Layers, front to back">
            {nodes.map((n, i) => (
              <LayerRow
                key={n.id}
                n={n}
                index={i}
                count={nodes.length}
                l={layerOf(n.id)}
                lockOn={anim.readableLock && isProtected(n, roleOf(n, layerOf(n.id).role))}
                selected={selected === n.id}
                canMove={canMove(n) && !locked(n.id)}
                onSelect={() => select(n.id)}
                onRename={(v) => rename(n.id, v)}
                onMove={(to) => moveTo(n.id, to)}
                onDropLayer={(id) => moveTo(id, i)}
                onToggleHidden={() => setLayer(n.id, (x) => ({ ...x, hidden: !x.hidden }), layerOf(n.id).hidden ? "Show layer" : "Hide layer")}
              />
            ))}
          </ul>
          <p className={cn("border-t px-4 py-2 text-[11px]", T.line, T.muted)}>Drag ⠿ to reorder (top is front). Double-click a name to rename it. The eye hides a layer in the video only.</p>
        </section>

        {/* Canvas */}
        <section ref={canvasCard} className={cn(T.panel, "order-1 flex min-h-[60vh] min-w-0 flex-col lg:order-none lg:min-h-0")} aria-label="Preview">
          <div ref={wrap} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2" data-tour="animate-preview">
            <div onPointerDownCapture={() => playing && setPlaying(false)} className="shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
              <FlyerStage
                scene={scene}
                zoom={zoom}
                selected={selected && !playing ? [selected] : []}
                ctx={pctx}
                fontsKey={fontsKey}
                showGuides
                canMove={(n) => canMove(n) && !locked(n.id)}
                onSelect={(id) => select(id)}
                onClear={() => setSelected(null)}
                onChange={applyPatches}
                onEditText={(id) => select(id)}
                coarse={typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches}
                motion={motion}
              />
            </div>
          </div>
          {(preview || trial) && (
            <p className="mx-3 mb-2 flex items-center justify-between rounded-[8px] bg-[#c6f432]/10 px-3 py-1.5 text-xs text-[#c6f432]">
              {preview ? "Previewing a style (nothing changed yet)" : `Trying an effect on ${sel?.name}`}
              {preview && (
                <button className="font-semibold underline" onClick={() => setPreview(null)}>
                  Stop
                </button>
              )}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 px-3 pb-3 pt-1">
            <button className="inline-flex h-10 w-12 items-center justify-center rounded-[8px] bg-[#c6f432] text-[#10120a]" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button className={T.icon} onClick={() => (setPlaying(false), setFrame((f) => ((f % N) - 1 + N) % N))} aria-label="Previous frame" title="Previous frame (,)">
              <SkipBack size={18} />
            </button>
            <button className={T.icon} onClick={() => (setPlaying(false), setFrame((f) => ((f % N) + 1) % N))} aria-label="Next frame" title="Next frame (.)">
              <SkipForward size={18} />
            </button>
            <span className="w-24 font-mono text-[14px] tabular-nums">
              {fmt(t)} / {fmt(anim.duration)}
            </span>
            <input type="range" min={0} max={N - 1} value={frame % N} onChange={(e) => (setPlaying(false), setFrame(Number(e.target.value)))} aria-label="Scrub" className="anim-range h-1.5 min-w-24 flex-1" style={{ background: `linear-gradient(90deg, #c6f432 ${pct}%, #34352f ${pct}%)` }} />
            <span className={T.icon} title="Videos are exported without sound" aria-label="No sound: videos are silent" role="img">
              <VolumeX size={18} />
            </span>
            <div className="relative">
              <button className={T.icon} onClick={() => setSettingsOpen((o) => !o)} aria-label="Preview settings" aria-expanded={settingsOpen} title="Preview settings">
                <Sparkles size={17} />
              </button>
              {settingsOpen && (
                <div className={cn(T.panel, "absolute bottom-11 right-0 z-50 w-64 p-3 text-xs shadow-xl")} role="dialog" aria-label="Preview settings">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} className={T.range} /> Reduced motion preview
                  </label>
                  <label className="mt-2 flex items-center justify-between gap-2">
                    Preview quality
                    <select value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)} className={T.input}>
                      <option value="draft">Draft (fastest)</option>
                      <option value="normal">Normal</option>
                      <option value="full">Full</option>
                    </select>
                  </label>
                  <p className={cn("mt-2", T.muted)}>The export is always full size, whatever you pick here.</p>
                </div>
              )}
            </div>
            <button className={T.icon} onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void canvasCard.current?.requestFullscreen?.())} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen" : "Full screen"}>
              {full ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </section>

        {/* Motion Library + Effect Controls */}
        <section className={cn(T.panel, "order-3 flex h-[620px] flex-col overflow-hidden lg:order-none lg:h-auto lg:min-h-0")} aria-label="Motion library" data-tour="animate-library">
          <div className="px-4 pt-3">
            <div className="mb-3 flex items-center gap-2">
              <Zap size={19} className="text-[#c9cbc0]" aria-hidden />
              <h2 className="text-[17px] font-semibold">Motion Library</h2>
              {sel && tab !== "styles" && <span className={cn("ml-auto truncate text-xs", T.muted)}>for {sel.name}</span>}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-3" role="tablist" aria-label="Library">
              {TABS.map((x) => (
                <button key={x.key} role="tab" aria-selected={tab === x.key} onClick={() => setTab(x.key)} className={cn("shrink-0 rounded-[8px] px-4 py-2 text-[14px]", tab === x.key ? "bg-[#c6f432] font-semibold text-[#10120a]" : "bg-[#22231e] text-[#dcded3] hover:bg-[#2a2b25]")}>
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {tab === "styles" ? (
              <div className="min-h-0 flex-1 overflow-y-auto">
              <StylesPanel
                anim={anim}
                scene={scene}
                nodes={nodes}
                confirmRecipe={confirmRecipe}
                ctxValues={ctx.values ?? {}}
                onPreview={(r) => {
                  setPreview(applyRecipe(r, scene.nodes, anim));
                  setFrame(0);
                  setPlaying(true);
                }}
                onApply={recipeClick}
                onRemove={removeRecipe}
                onIntensity={(i) => change((a) => ({ ...a, intensity: i }), `Intensity: ${INTENSITIES.find((x) => x.key === i)?.label}`)}
                onLock={(on) => change((a) => ({ ...a, readableLock: on }), on ? "Keep details readable" : "Let details move")}
                onPick={(id) => {
                  const n = scene.nodes.find((x) => x.id === id);
                  setSelected(id);
                  if (n) setTab(tabFor(n));
                }}
                onRemoveItem={removeItem}
                onClearAll={clearAll}
              />
              </div>
            ) : !sel ? (
              <p className={cn("min-h-0 flex-1 overflow-y-auto px-4 pb-4 text-sm", T.muted)}>Pick a layer (in Layers or on the flyer) to see the effects that suit it.</p>
            ) : locked(sel.id) ? (
              <div className="px-4 pb-4 text-sm">
                <p className="flex items-center gap-2">
                  <Lock size={14} /> {sel.name} is locked in Animate.
                </p>
                <button className={cn(T.btn, "mt-2")} onClick={() => setLayer(sel.id, (l) => ({ ...l, locked: false }), "Unlock layer")}>
                  Unlock
                </button>
              </div>
            ) : (
              <>
                {/* Effect tiles scroll on their own; the picked effect's controls stay in view below. */}
                <div className="min-h-[118px] flex-1 overflow-y-auto px-4 pb-3 [@media(min-height:900px)]:min-h-[212px]">
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Effects">
                  {libPresets.map((p) => {
                    const fits = presetFits(p, sel, selRole!, anim.readableLock);
                    const on = item?.preset === p.id;
                    const added = !!selLayer?.stack.some((x) => x.preset === p.id);
                    return (
                      <li key={p.id}>
                        <button
                          disabled={fits !== true || (!added && (selLayer?.stack.length ?? 0) >= MAX_STACK)}
                          title={fits !== true ? fits : `${p.description}. Point to preview, click to add.`}
                          onClick={() => pickEffect(p.id)}
                          onMouseEnter={() => fits === true && !added && tryPreset(p.id)}
                          onMouseLeave={() => tryPreset(null)}
                          onFocus={() => fits === true && !added && tryPreset(p.id)}
                          onBlur={() => tryPreset(null)}
                          className={cn(
                            "motion-card group relative flex h-[96px] w-full flex-col items-center justify-end overflow-hidden rounded-[12px] border bg-[#1b1c18] px-1 pb-2.5 text-[14px] disabled:opacity-35",
                            on ? "border-[#c6f432] ring-1 ring-[#c6f432]" : "border-[#2a2b26] hover:border-[#55574f] focus-visible:border-[#c6f432] focus-visible:outline-none"
                          )}
                          data-preset={p.id}
                          aria-pressed={added}
                        >
                          <span className="absolute inset-x-1 bottom-8 top-2 flex items-center justify-center overflow-hidden" aria-hidden>
                            <Thumb id={p.id} text={sample} font={sampleFont} />
                          </span>
                          <span className="relative truncate">{p.name}</span>
                          {added && <Check size={13} className="absolute right-2 top-2 text-[#c6f432]" aria-label="On this layer" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {PLANNED.some((p) => p.id.startsWith(tab)) && (
                  <details className={cn("mt-3 text-[11px]", T.muted)}>
                    <summary className="cursor-pointer">Not available yet ({PLANNED.filter((p) => p.id.startsWith(tab)).length})</summary>
                    <ul className="mt-1 list-disc pl-4">
                      {PLANNED.filter((p) => p.id.startsWith(tab)).map((p) => (
                        <li key={p.id}>
                          {p.name}: {p.why}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                </div>
                {selLayer && selLayer.stack.length > 0 && (
                  <div className={cn("flex shrink-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap border-t px-4 py-2 text-xs", T.line)} aria-label={`Effects on ${sel.name}`}>
                    <span className={T.muted}>On this layer:</span>
                    {selLayer.stack.map((x, i) => (
                      <span key={x.id} className={cn("inline-flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1", item?.id === x.id ? "border-[#c6f432] text-[#c6f432]" : "border-[#2e2f29]")}>
                        <button onClick={() => (setSelectedItem(x.id), setSelectedKey(null))}>
                          {i + 1}. {PRESET_BY_ID.get(x.preset)?.name}
                        </button>
                        {i > 0 && (
                          <button
                            className={T.muted}
                            title="Run earlier"
                            aria-label={`Move ${PRESET_BY_ID.get(x.preset)?.name} earlier`}
                            onClick={() =>
                              setLayer(sel.id, (l) => {
                                const s = [...l.stack];
                                [s[i - 1], s[i]] = [s[i], s[i - 1]];
                                return { ...l, stack: s };
                              }, "Reorder effects")
                            }
                          >
                            ‹
                          </button>
                        )}
                        <button className="rounded-full p-0.5 text-[#8e9087] hover:text-[#ff8a8a]" onClick={() => removeItem(sel.id, x.id)} aria-label={`Remove ${PRESET_BY_ID.get(x.preset)?.name}`}>
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    <span className="ml-auto flex shrink-0 gap-1">
                      <button className={cn(T.btn, "h-7")} onClick={() => setClip({ stack: selLayer.stack, keys: selLayer.keys, window: selLayer.window })} title="Copy this layer's motion">
                        Copy
                      </button>
                      <button
                        className={cn(T.btn, "h-7")}
                        disabled={!clip}
                        onClick={() => clip && setLayer(sel.id, (l) => ({ ...l, stack: clip.stack.map((x) => ({ ...x, id: newItemId() })), keys: clip.keys?.map((k) => ({ ...k, id: newItemId() })), window: clip.window }), "Paste motion")}
                        title="Paste motion onto this layer"
                      >
                        Paste
                      </button>
                    </span>
                  </div>
                )}
                <div className="shrink-0 overflow-y-auto lg:max-h-[46%]">
                {selectedKey && selLayer?.keys?.some((k) => k.id === selectedKey) ? (
                  <KeyInspector layer={selLayer} keyId={selectedKey} duration={anim.duration} fps={anim.fps} onChange={(fn, label, key) => setLayer(sel.id, fn, label, key)} onClose={() => setSelectedKey(null)} />
                ) : item ? (
                  <EffectControls
                    item={item}
                    duration={anim.duration}
                    layerName={sel.name}
                    onChange={(p, key) => setLayer(sel.id, (l) => ({ ...l, stack: l.stack.map((x) => (x.id === item.id ? { ...x, ...p } : x)) }), "Adjust effect", `item:${item.id}:${key}`)}
                    onRemove={() => removeItem(sel.id, item.id)}
                  />
                ) : null}
                {selLayer && (
                  <div className={cn("border-t px-4 py-3 text-xs", T.line)}>
                    <label className="flex items-center gap-2">
                      <span className={T.muted}>Role</span>
                      <select value={selRole!} onChange={(e) => setLayer(sel.id, (l) => ({ ...l, role: e.target.value === sel.role ? undefined : (e.target.value as Role) }), "Change role")} className={T.input}>
                        {(Object.keys(ROLES) as Role[]).map((r) => (
                          <option key={r} value={r}>
                            {ROLES[r]}
                            {r === sel.role ? " (from the template)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    {anim.readableLock && isProtected(sel, selRole!) && (
                      <p className={cn("mt-1.5 flex items-center gap-1", T.muted)}>
                        <Lock size={11} /> Kept readable: no disappearing or glitch, movement is limited.
                      </p>
                    )}
                    {selLayer.stack.length > 0 && (
                      <form
                        className="mt-2 flex gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const name = String(new FormData(form).get("name") ?? "").trim().slice(0, 40);
                          if (!name) return;
                          const next = [{ name, stack: selLayer.stack.map((s) => ({ ...s, id: newItemId() })) }, ...custom.filter((c) => c.name !== name)].slice(0, 30);
                          setCustom(next);
                          try {
                            localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
                          } catch {
                            // private window: kept for this visit only
                          }
                          form.reset();
                        }}
                      >
                        <input name="name" placeholder="Save as my preset…" aria-label="Preset name" className={cn(T.input, "min-w-0 flex-1")} />
                        <button className={cn(T.btn, "h-7")}>Save</button>
                      </form>
                    )}
                    {custom.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <span className={T.muted}>My presets:</span>
                        {custom.map((c) => (
                          <button key={c.name} className="rounded-full border border-[#2e2f29] px-2 py-0.5 hover:border-[#c6f432]" onClick={() => setLayer(sel.id, (l) => ({ ...l, stack: c.stack.filter((x) => PRESET_BY_ID.has(x.preset)).slice(0, MAX_STACK).map((x) => ({ ...x, id: newItemId() })) }), `Use preset ${c.name}`)}>
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Timeline */}
        <div className="order-4 min-w-0 lg:order-none lg:col-span-3">
          <Timeline
            nodes={nodes}
            anim={anim}
            frame={frame % N}
            N={N}
            selected={selected}
            selectedKey={selectedKey}
            onSelect={(id) => {
              setSelected(id);
              setSelectedItem(null);
            }}
            onSelectKey={setSelectedKey}
            onSeek={(f) => {
              setPlaying(false);
              setFrame(((f % N) + N) % N);
            }}
            setLayer={setLayer}
            undo={undo}
            redo={redo}
            undoLabel={undoLabel}
            redoLabel={redoLabel}
            compact={mode === "simple"}
          />
        </div>
      </div>

      {loopOpen && <LoopCheck scene={scene} ctx={ctx} anim={anim} reduced={reduced} onClose={() => setLoopOpen(false)} onPlay={() => (setFrame(0), setPlaying(true))} />}
      {exportOpen && <ExportQueue designId={source.kind === "design" ? source.id : null} scene={scene} ctx={ctx} anim={anim} title={title} onClose={() => setExportOpen(false)} onFormats={(f) => change((a) => ({ ...a, formats: f }), "Change video sizes", "formats")} />}
      <style>{CSS}</style>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn("fixed inset-0 z-[60] flex flex-col overflow-hidden", T.bg, T.text)}
      style={{ fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
      role="dialog"
      aria-modal="true"
      aria-label="Animate"
    >
      {children}
    </div>
  );
}

/** A layer in the Layers panel: drag handle, type, name (double-click to rename), eye. */
function LayerRow({
  n,
  index,
  count,
  l,
  lockOn,
  selected,
  canMove,
  onSelect,
  onRename,
  onMove,
  onDropLayer,
  onToggleHidden
}: {
  n: FlyerNode;
  index: number;
  count: number;
  l: LayerMotion;
  lockOn: boolean;
  selected: boolean;
  canMove: boolean;
  onSelect: () => void;
  onRename: (v: string) => void;
  onMove: (to: number) => void;
  onDropLayer: (id: string) => void;
  onToggleHidden: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(n.name);
  const [over, setOver] = useState(false);
  return (
    <li
      className={cn("mb-1 flex items-center gap-3 rounded-[10px] border px-3 py-2.5", selected ? "border-[#c6f432] bg-[#c6f432]/15" : "border-transparent hover:bg-[#1b1c18]", over && "border-dashed border-[#c6f432]/70")}
      draggable={canMove && !editing}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/x-layer", n.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("text/x-layer")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = e.dataTransfer.getData("text/x-layer");
        if (id && id !== n.id) {
          e.preventDefault();
          onDropLayer(id);
        }
      }}
      onClick={onSelect}
    >
      <button
        data-grip
        className={cn("cursor-grab text-[#8e9087]", !canMove && "cursor-not-allowed opacity-30")}
        aria-label={`Reorder ${n.name} (arrow keys)`}
        title={canMove ? "Drag to reorder, or focus and use the arrow keys" : "Locked"}
        disabled={!canMove}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" && index > 0) {
            e.preventDefault();
            onMove(index - 1);
          }
          if (e.key === "ArrowDown" && index < count - 1) {
            e.preventDefault();
            onMove(index + 1);
          }
        }}
      >
        <GripVertical size={18} />
      </button>
      <span className="text-[#dcded3]">
        <KindIcon n={n} size={24} />
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={v}
            maxLength={60}
            aria-label={`Rename ${n.name}`}
            onChange={(e) => setV(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => {
              if (v.trim()) onRename(v);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setV(n.name);
                setEditing(false);
              }
            }}
            className={cn(T.input, "w-full text-[15px]")}
          />
        ) : (
          <button
            className="block w-full truncate text-left text-[16px] font-medium"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setV(n.name);
              setEditing(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "F2") {
                setV(n.name);
                setEditing(true);
              }
            }}
            title="Double-click (or F2) to rename"
          >
            {n.name}
          </button>
        )}
        <span className="flex items-center gap-1.5 text-[13px] text-[#a6a89e]">
          {kindLabel(n)}
          {l.stack.length > 0 && <span className="rounded-full bg-[#c6f432]/20 px-1.5 text-[10px] font-semibold text-[#c6f432]">{l.stack.length} fx</span>}
          {(l.keys?.length ?? 0) > 0 && <span className="text-[10px]">◆ {l.keys!.length}</span>}
          {lockOn && <Lock size={11} aria-label="Kept readable" />}
          {l.locked && <span className="text-[10px] text-[#c6f432]">locked</span>}
        </span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleHidden();
        }}
        aria-label={`${l.hidden ? "Show" : "Hide"} ${n.name} in the video`}
        title={l.hidden ? "Hidden in the video" : "Shown in the video"}
        className={l.hidden ? "text-[#6a6c64]" : "text-[#ecede4]"}
      >
        {l.hidden ? <EyeOff size={21} /> : <Eye size={21} />}
      </button>
    </li>
  );
}

/** Simple mode in the library panel: motion styles, intensity, readability, and what's moving now. */
function StylesPanel({
  anim,
  scene,
  nodes,
  confirmRecipe,
  ctxValues,
  onPreview,
  onApply,
  onRemove,
  onIntensity,
  onLock,
  onPick,
  onRemoveItem,
  onClearAll
}: {
  anim: Animation;
  scene: Scene;
  nodes: FlyerNode[];
  confirmRecipe: string | null;
  ctxValues: Record<string, string | null | undefined>;
  onPreview: (r: (typeof RECIPES)[number]) => void;
  onApply: (id: string) => void;
  onRemove: (id: string) => void;
  onIntensity: (i: Intensity) => void;
  onLock: (on: boolean) => void;
  onPick: (id: string) => void;
  onRemoveItem: (layerId: string, itemId: string) => void;
  onClearAll: () => void;
}) {
  const rows = nodes.filter((n) => anim.layers[n.id]?.stack.length);
  const details: [string, string | null | undefined][] = [
    ["Venue", ctxValues.venue_name],
    ["Date", ctxValues.event_date],
    ["Time", ctxValues.event_time_range ?? ctxValues.start_time]
  ];
  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <section data-tour="animate-styles">
        <h3 className="mb-2 text-sm font-semibold">Motion style</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {RECIPES.map((r) => {
            const names = Object.keys(planRecipe(r, scene.nodes, anim))
              .map((id) => scene.nodes.find((n) => n.id === id)?.name)
              .filter(Boolean);
            const on = anim.recipe === r.id;
            return (
              <li key={r.id} className={cn("rounded-[12px] border p-3", on ? "border-[#c6f432] bg-[#c6f432]/5" : "border-[#2a2b26] bg-[#1b1c18]")}>
                <p className="text-sm font-semibold">
                  {r.name} {on && <span className="text-[11px] font-normal text-[#c6f432]">· applied</span>}
                </p>
                <p className={cn("text-xs", T.muted)}>{r.blurb}</p>
                <p className={cn("mt-1 text-[11px]", T.muted)}>{names.length ? `Animates: ${names.join(", ")}` : "No matching layers."}</p>
                {confirmRecipe === r.id && <p className="mt-1 text-[11px] text-[#f5a524]">Some of these layers already move. Apply again to replace their motion (you can undo).</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button className={cn(T.btn, "h-7")} disabled={!names.length} onClick={() => onPreview(r)}>
                    Preview
                  </button>
                  <button className={cn(T.btn, "h-7 border-[#c6f432]/70 text-[#c6f432]")} disabled={!names.length} onClick={() => onApply(r.id)}>
                    {confirmRecipe === r.id ? "Replace and apply" : on ? "Apply again" : "Apply"}
                  </button>
                  {on && (
                    <button className={cn(T.btn, "h-7 text-[#ff8a8a]")} onClick={() => onRemove(r.id)}>
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section data-tour="animate-intensity">
        <h3 className="mb-2 text-sm font-semibold">Intensity</h3>
        <div className="grid grid-cols-3 gap-1 rounded-[10px] border border-[#2e2f29] p-1" role="radiogroup" aria-label="Overall intensity">
          {INTENSITIES.map((i) => (
            <button key={i.key} role="radio" aria-checked={anim.intensity === i.key} onClick={() => onIntensity(i.key)} className={cn("rounded-[8px] py-1.5 text-xs", anim.intensity === i.key ? "bg-[#c6f432] font-semibold text-[#10120a]" : "text-[#c9cbc0]")}>
              {i.label}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" className={cn("mt-1", T.range)} checked={anim.readableLock} onChange={(e) => onLock(e.target.checked)} />
          <span>
            Keep event details readable
            <span className={cn("block text-[11px]", T.muted)}>{details.map(([k, v]) => `${k}: ${v || "not set"}`).join(" · ")}. These stay on screen and steady; decorative layers can move freely.</span>
          </span>
        </label>
      </section>
      {rows.length > 0 && (
        <section className="rounded-[12px] border border-[#2a2b26] p-3" data-tour="animate-summary">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold">Moving on this flyer now</h3>
            <button className="text-[11px] text-[#ff8a8a] underline" onClick={onClearAll}>
              Remove all motion
            </button>
          </div>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {rows.map((n) => (
              <li key={n.id} className="text-xs">
                <button className="font-medium hover:text-[#c6f432] hover:underline" onClick={() => onPick(n.id)} title="Change this layer's effects">
                  {n.name}
                </button>
                <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                  {anim.layers[n.id].stack.map((it) => (
                    <span key={it.id} className="inline-flex items-center gap-0.5 rounded-full bg-[#22231e] py-0.5 pl-2 pr-1 text-[11px]">
                      {PRESET_BY_ID.get(it.preset)?.name}
                      <button onClick={() => onRemoveItem(n.id, it.id)} aria-label={`Remove ${PRESET_BY_ID.get(it.preset)?.name} from ${n.name}`} className="rounded-full p-0.5 text-[#8e9087] hover:text-[#ff8a8a]">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className={cn("mt-1.5 text-[11px]", T.muted)}>Click a layer name to change its effects. Undo is in the Timeline bar.</p>
        </section>
      )}
    </div>
  );
}

/**
 * Library thumbnails: what each effect does, drawn on the layer's own word
 * (or "TEXT"). They hold still until you point at them or tab to them.
 */
function Thumb({ id, text, font }: { id: string; text: string; font: { family: string; style: string } | null }) {
  const k = id.split(".")[1];
  // Shrinks long words so the whole word shows on the card.
  const size = Math.max(16, Math.min(36, Math.round(230 / Math.max(4, text.length * (k === "letter-reveal" || k === "word-reveal" ? 1.7 : 1)))));
  const style = { fontFamily: font ? `${font.family}, Impact, sans-serif` : "Impact, 'Arial Black', sans-serif", fontWeight: 800, fontSize: size } as React.CSSProperties;
  return (
    <span className={cn("th relative inline-block whitespace-nowrap italic leading-none tracking-tight", `th-${k}`)} style={style}>
      {k === "letter-reveal" || k === "word-reveal" ? (
        <span className="not-italic tracking-[0.3em]">
          {text}
          <span className="ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[0.08em] bg-[#c6f432]" />
        </span>
      ) : (
        text
      )}
      {k === "slide" && <span className="absolute -bottom-2 left-1/4 right-1/4 h-[2px] bg-[#c6f432]" />}
    </span>
  );
}

const CSS = `
.anim-range { -webkit-appearance: none; appearance: none; border-radius: 999px; cursor: pointer; }
.anim-range::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 999px; background: #c6f432; border: 0; box-shadow: 0 0 0 3px rgba(198,244,50,.18); }
.anim-range::-moz-range-thumb { width: 18px; height: 18px; border-radius: 999px; background: #c6f432; border: 0; }
.th { color: #e4e1d8; }
.th-fade { opacity: .55; -webkit-mask-image: linear-gradient(90deg, #000 30%, transparent 95%); mask-image: linear-gradient(90deg, #000 30%, transparent 95%); }
.th-slide { text-shadow: -10px 0 0 rgba(228,225,216,.18), -20px 0 0 rgba(228,225,216,.08); }
.th-shine, .th-light { background: linear-gradient(100deg, #9a978d 35%, #fff 48%, #9a978d 60%); background-size: 220% 100%; background-position: 60% 0; -webkit-background-clip: text; background-clip: text; color: transparent; }
.th-pulse { color: #c6f432; text-shadow: 0 0 14px rgba(198,244,50,.55); }
.th-zoom { transform: scale(1.08); }
.th-shadow { text-shadow: 4px 5px 0 rgba(0,0,0,.9), 6px 8px 10px rgba(0,0,0,.6); }
.th-tracking { letter-spacing: .12em; }
.th-float { transform: translateY(-3px); text-shadow: 0 10px 8px rgba(0,0,0,.6); }
.th-reveal { -webkit-mask-image: linear-gradient(90deg, #000 55%, transparent 75%); mask-image: linear-gradient(90deg, #000 55%, transparent 75%); }
.th-digital-slice { clip-path: polygon(0 0,100% 0,100% 38%,92% 38%,92% 55%,100% 55%,100% 100%,0 100%,0 62%,8% 62%,8% 45%,0 45%); text-shadow: 3px 0 #ff2a6d, -3px 0 #2ad4ff; }
.th-rgb-signal { text-shadow: -4px 0 #ff2a6d, 4px 0 #2ad4ff; }
.th-vhs { text-shadow: -2px 0 rgba(255,60,90,.8), 2px 0 rgba(60,200,255,.8); opacity: .9; }
.th-grain { filter: contrast(1.2); text-shadow: 1px 1px 0 rgba(255,255,255,.15); }
.th-vignette { text-shadow: 0 0 24px #000, 0 0 2px #000; opacity: .85; }
.th-pan { text-shadow: 12px 0 0 rgba(228,225,216,.12); }
.th-sparkle::after { content: "✦"; position: absolute; right: -12px; top: -6px; font-size: 14px; color: #fff; font-style: normal; }
.th-dust::after { content: "·  ·   ·"; position: absolute; left: 0; top: -8px; font-size: 18px; color: #f6ead2; letter-spacing: 6px; font-style: normal; }
.th-leak { text-shadow: 12px -6px 22px rgba(255,122,46,.9); }
@media (prefers-reduced-motion: no-preference) {
  .motion-card:hover .th, .motion-card:focus-visible .th { animation: 1.6s ease-in-out infinite; }
  .motion-card:hover .th-fade, .motion-card:focus-visible .th-fade { animation-name: thFade; }
  .motion-card:hover .th-slide, .motion-card:focus-visible .th-slide, .motion-card:hover .th-float, .motion-card:hover .th-pan, .motion-card:hover .th-shadow, .motion-card:hover .th-tracking { animation-name: thSlide; }
  .motion-card:hover .th-pulse, .motion-card:focus-visible .th-pulse, .motion-card:hover .th-zoom { animation-name: thPulse; }
  .motion-card:hover .th-shine, .motion-card:focus-visible .th-shine, .motion-card:hover .th-light { animation-name: thShine; }
  .motion-card:hover .th-digital-slice, .motion-card:focus-visible .th-digital-slice { animation: thSlice .9s steps(2) infinite; }
  .motion-card:hover .th-rgb-signal, .motion-card:focus-visible .th-rgb-signal, .motion-card:hover .th-vhs { animation-name: thRgb; }
  .motion-card:hover .th-reveal, .motion-card:hover .th-fade { animation-name: thFade; }
}
@keyframes thFade { 50% { opacity: .15 } }
@keyframes thSlide { 50% { transform: translateX(8px) } }
@keyframes thPulse { 50% { transform: scale(1.12) } }
@keyframes thShine { from { background-position: 120% 0 } to { background-position: -20% 0 } }
@keyframes thSlice { 0% { transform: none } 50% { transform: translateX(4px) } }
@keyframes thRgb { 50% { text-shadow: 4px 0 #ff2a6d, -4px 0 #2ad4ff } }
`;
