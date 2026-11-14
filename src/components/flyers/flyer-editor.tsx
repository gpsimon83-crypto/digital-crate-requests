"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CloudOff,
  Download,
  Eye,
  Layers as LayersIcon,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  Redo2,
  Ruler,
  Save,
  SlidersHorizontal,
  Undo2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  commit,
  initHistory,
  redo as redoH,
  undo as undoH,
  type History,
} from "@/lib/flyers/history";
import {
  duplicateNodes,
  emptyScene,
  fillText,
  newImage,
  newText,
  reorder,
  uid,
  withGroup,
} from "@/lib/flyers/scene";
import {
  FORMATS,
  FORMAT_KEYS,
  type FlyerNode,
  type FormatKey,
  type ImageSource,
  type Perms,
  type PlaceholderValues,
  type Role,
  type Scene,
} from "@/lib/flyers/types";
import { ExportStage, FlyerStage, type NodePatch } from "./flyer-canvas";
import {
  FOCUS,
  LayersPanel,
  LibraryPanel,
  PropertiesPanel,
  iconBtn,
  inputCls,
  type Asset,
  type VenueOpt,
} from "./editor-panels";
import { loadSceneFonts, type SrcContext } from "./loaders";

export type Scenes = Partial<Record<FormatKey, Scene>>;
export type SaveResult =
  { ok: true } | { ok: false; error: string; conflict?: boolean };

export type FlyerEditorProps = {
  mode: "design" | "template";
  title: string;
  scenes: Scenes;
  format: FormatKey;
  /** Staff can change every layer; DJs only what the template allows. */
  staff: boolean;
  owner: { id: string; display_name: string; has_photo: boolean } | null;
  uploads: Asset[];
  shared: Asset[];
  venues: VenueOpt[];
  backHref: string;
  backLabel: string;
  save: (scenes: Scenes, title: string) => Promise<SaveResult>;
  upload: (file: File, kind: string) => Promise<Asset>;
  deleteUpload?: (id: string) => Promise<void>;
  /** Template mode: a real DJ whose photo previews the photo slot (never saved into the template). */
  previewDjs?: { id: string; display_name: string; has_photo: boolean }[];
  sampleValues?: PlaceholderValues;
  headerExtra?: React.ReactNode;
  templatesSlot?: React.ReactNode;
  subtitle?: string;
  /** Lets the page save right now (e.g. before publishing). Resolves true when everything is saved. */
  onSaveReady?: (saveNow: () => Promise<boolean>) => void;
};

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(pointer: coarse)");
    const on = () => setCoarse(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return coarse;
}

function useIsDesktop() {
  const [desk, setDesk] = useState(true);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesk(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return desk;
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.isContentEditable)
  );
};

export function FlyerEditor(props: FlyerEditorProps) {
  const { mode, staff } = props;
  const [hist, setHist] = useState<History<Scenes>>(() =>
    initHistory(props.scenes),
  );
  const [active, setActive] = useState<FormatKey>(props.format);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState(props.title);
  const [zoomMode, setZoomMode] = useState<"fit" | number>("fit");
  const [fitZoom, setFitZoom] = useState(0.4);
  const [fontsKey, setFontsKey] = useState(0);
  const [showGuides, setShowGuides] = useState(true);
  const [savedKey, setSavedKey] = useState(() =>
    JSON.stringify({ s: props.scenes, t: props.title }),
  );
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<{ key: string; msg: string } | null>(
    null,
  );
  const saveError = saveErr?.msg ?? null;
  const [drawer, setDrawer] = useState<
    null | "add" | "layers" | "props" | "more"
  >(null);
  const [leftTab, setLeftTab] = useState(
    props.templatesSlot
      ? "templates"
      : mode === "template"
        ? "assets"
        : "photos",
  );
  const [replacing, setReplacing] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Asset[]>(props.uploads);
  const [shared, setShared] = useState<Asset[]>(props.shared);
  const [exportJob, setExportJob] = useState<{
    mime: "image/png" | "image/jpeg";
    purpose: "download" | "preview";
  } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewDjId, setPreviewDjId] = useState<string | null>(
    props.previewDjs?.find((d) => d.has_photo)?.id ?? null,
  );
  const [sampleText, setSampleText] = useState(mode === "template");
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const coarse = useCoarsePointer();
  const desktop = useIsDesktop();

  const scenes = hist.present;
  const scene = scenes[active] ?? emptyScene(active);
  const zoom = zoomMode === "fit" ? fitZoom : zoomMode;
  const ctx: SrcContext = useMemo(
    () => ({ previewDjId: mode === "template" ? previewDjId : null }),
    [mode, previewDjId],
  );

  /* ---- permissions ---- */
  const can = useCallback(
    (n: FlyerNode, a: keyof Perms) =>
      mode === "template" || staff || n.perms[a],
    [mode, staff],
  );
  const canMove = useCallback((n: FlyerNode) => can(n, "move"), [can]);

  /* ---- fonts: load what's used, then redraw text ---- */
  const fontSig = scene.nodes.map((n) => (n.kind === "text" ? `${n.font}${n.weight}${n.italic}` : "")).join("|");
  const sceneForFonts = useRef(scene);
  useEffect(() => {
    sceneForFonts.current = scene;
  });
  useEffect(() => {
    let live = true;
    loadSceneFonts([sceneForFonts.current]).then(() => live && setFontsKey((k) => k + 1));
    return () => {
      live = false;
    };
  }, [fontSig]);

  /* ---- fit to screen ---- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const pad = desktop ? 48 : 24;
      const z = Math.min(
        (el.clientWidth - pad) / scene.width,
        (el.clientHeight - pad) / scene.height,
      );
      setFitZoom(Math.max(0.05, Math.min(2, z)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scene.width, scene.height, desktop]);

  /* ---- pinch to zoom (two fingers anywhere on the canvas area) ---- */
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let last: number | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const move = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const d = dist(e.touches);
      if (last) setZoomMode(Math.max(0.05, Math.min(3, zoomRef.current * (d / last))));
      last = d;
    };
    const end = (e: TouchEvent) => {
      if (e.touches.length < 2) last = null;
    };
    el.addEventListener("touchmove", move, { passive: false, capture: true });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchmove", move, { capture: true });
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, []);

  /* ---- editing ---- */
  const setScene = useCallback(
    (fn: (s: Scene) => Scene, key: string | null = null) => {
      setHist((h) => {
        const cur = h.present[active] ?? emptyScene(active);
        const next = fn(cur);
        if (next === cur) return h;
        return commit(h, { ...h.present, [active]: next }, key);
      });
    },
    [active],
  );

  const applyPatches = useCallback(
    (patches: NodePatch[], key: string) =>
      setScene(
        (s) => ({
          ...s,
          nodes: s.nodes.map((n) => {
            const p = patches.find((x) => x.id === n.id);
            return p ? ({ ...n, ...p.patch } as FlyerNode) : n;
          }),
        }),
        key,
      ),
    [setScene],
  );
  const update = useCallback(
    (id: string, patch: Partial<FlyerNode>, key: string) =>
      applyPatches([{ id, patch }], key),
    [applyPatches],
  );

  const select = useCallback(
    (id: string, additive: boolean) => {
      const ids = withGroup(scene.nodes, id);
      setSelected((cur) =>
        additive
          ? ids.every((x) => cur.includes(x))
            ? cur.filter((x) => !ids.includes(x))
            : [...new Set([...cur, ...ids])]
          : ids,
      );
      setReplacing(null);
    },
    [scene.nodes],
  );

  const selNodes = scene.nodes.filter((n) => selected.includes(n.id));
  const single = selNodes.length === 1 ? selNodes[0] : null;

  function addNode(n: FlyerNode) {
    setScene(
      (s) => ({
        ...s,
        nodes: n.role === "background" ? [n, ...s.nodes] : [...s.nodes, n],
      }),
      null,
    );
    setSelected([n.id]);
    if (!desktop) setDrawer("props");
  }

  function addText(role: Role) {
    const n = newText(role, scene);
    if (mode === "design") {
      // DJs get real words, not placeholders.
      const v = props.sampleValues ?? {};
      const fill: Partial<Record<Role, string | null | undefined>> = {
        title: v.event_title ?? "Event title",
        dj_name: props.owner?.display_name ?? "DJ name",
        date: v.event_date ?? "Date",
        time: v.start_time
          ? `${v.start_time}${v.end_time ? ` – ${v.end_time}` : ""}`
          : "Time",
        venue: v.venue_name ?? "Venue",
        address: v.venue_address ?? "Address",
        details: "Details",
      };
      n.text = fill[role] ?? "Your text";
    }
    n.y = Math.round(scene.height / 2 - 60);
    addNode(n);
    setTimeout(() => textRef.current?.focus(), 60);
  }

  function placeImageSource(source: ImageSource, role: Role, asset?: Asset) {
    const target = replacing
      ? scene.nodes.find((n) => n.id === replacing)
      : null;
    if (target && target.kind === "image") {
      // Replace keeps the frame, position, size and effects; only the picture and its crop change.
      update(
        target.id,
        { source, crop: { zoom: 1, x: 0, y: 0 } },
        `${target.id}:replace`,
      );
      setReplacing(null);
      setSelected([target.id]);
      setNotice("Image replaced. Use Crop to reposition it in the frame.");
      return;
    }
    let width: number | undefined;
    let height: number | undefined;
    if (asset && role !== "background") {
      const max = role === "logo" ? scene.width * 0.3 : scene.width * 0.6;
      const s = Math.min(max / asset.width, max / asset.height, 1.5);
      width = Math.round(asset.width * s);
      height = Math.round(asset.height * s);
    }
    const n = newImage(role, source, scene, {
      ...(width
        ? {
            width,
            height,
            x: Math.round((scene.width - width) / 2),
            y: Math.round((scene.height - (height ?? 0)) / 2),
          }
        : {}),
      ...(asset?.has_alpha && role === "portrait"
        ? { fit: "contain" as const }
        : {}),
    });
    addNode(n);
  }

  function removeSelected() {
    const removable = selNodes.filter((n) => can(n, "remove"));
    if (!removable.length)
      return setNotice(
        "This layer is part of the template and can't be deleted.",
      );
    const ids = removable.map((n) => n.id);
    setScene(
      (s) => ({ ...s, nodes: s.nodes.filter((n) => !ids.includes(n.id)) }),
      null,
    );
    setSelected([]);
    if (removable.length < selNodes.length)
      setNotice("Some layers are part of the template and were kept.");
  }

  function duplicateSelected() {
    if (!selNodes.length) return;
    let newIds: string[] = [];
    setScene((s) => {
      const r = duplicateNodes(s.nodes, selected);
      newIds = r.newIds;
      return { ...s, nodes: r.nodes };
    }, null);
    setTimeout(() => setSelected(newIds), 0);
  }

  function reorderSel(dir: "up" | "down" | "top" | "bottom") {
    if (!selNodes.length) return;
    setScene((s) => {
      let nodes = s.nodes;
      const order =
        dir === "up" || dir === "top" ? [...selected].reverse() : selected;
      for (const id of order) nodes = reorder(nodes, id, dir);
      return { ...s, nodes };
    }, null);
  }

  function nudge(dx: number, dy: number) {
    const movable = selNodes.filter((n) => !n.locked && can(n, "move"));
    if (!movable.length) return;
    applyPatches(
      movable.map((n) => ({ id: n.id, patch: { x: n.x + dx, y: n.y + dy } })),
      `nudge:${selected.join(",")}`,
    );
  }

  function groupSel() {
    if (selNodes.length < 2) return;
    const g = uid();
    applyPatches(
      selNodes.map((n) => ({ id: n.id, patch: { groupId: g } })),
      "group",
    );
  }
  function ungroupSel() {
    applyPatches(
      selNodes.map((n) => ({ id: n.id, patch: { groupId: null } })),
      "ungroup",
    );
  }

  const undo = useCallback(() => setHist((h) => undoH(h)), []);
  const redo = useCallback(() => setHist((h) => redoH(h)), []);

  /* ---- saving: autosave a moment after each change ---- */
  const currentKey = useMemo(
    () => JSON.stringify({ s: hist.present, t: title }),
    [hist.present, title],
  );
  const dirty = currentKey !== savedKey;
  const doSave = useCallback(async (): Promise<boolean> => {
    if (currentKey === savedKey) return true;
    if (inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    const snapshot = currentKey;
    const r = await props.save(hist.present, title);
    inFlight.current = false;
    setSaving(false);
    if (r.ok) {
      setSavedKey(snapshot);
      setSaveErr(null);
      return true;
    }
    setSaveErr({ key: snapshot, msg: r.error });
    return false;
  }, [currentKey, savedKey, hist.present, title, props]);

  const onSaveReady = props.onSaveReady;
  useEffect(() => {
    onSaveReady?.(doSave);
  }, [doSave, onSaveReady]);

  useEffect(() => {
    // After a failed save, wait for the next change (or the Save button) before trying again.
    if (!dirty || saveErr?.key === currentKey) return;
    const t = setTimeout(() => void doSave(), 1500);
    return () => clearTimeout(t);
  }, [dirty, doSave, saveErr, currentKey]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void doSave();
        return;
      }
      if (isTyping(e.target)) return;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selected.length
      ) {
        e.preventDefault();
        removeSelected();
      } else if (e.key.startsWith("Arrow") && selected.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        nudge(
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0,
        );
      } else if (e.key === "Escape") {
        setSelected([]);
        setReplacing(null);
        setPreview(null);
      } else if (
        e.key === "Tab" &&
        wrapRef.current?.contains(document.activeElement)
      ) {
        // Tab through layers from the canvas.
        e.preventDefault();
        const list = scene.nodes.filter((n) => n.visible);
        if (!list.length) return;
        const i = list.findIndex((n) => n.id === selected[0]);
        const next =
          list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length];
        setSelected(withGroup(scene.nodes, next.id));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  /* ---- export ---- */
  function finishExport(blob: Blob | null, error?: string) {
    const job = exportJob;
    setExportJob(null);
    if (!blob || !job) return setNotice(error ?? "Export failed.");
    const url = URL.createObjectURL(blob);
    if (job.purpose === "preview") {
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      return;
    }
    const a = document.createElement("a");
    const safe =
      (title || "flyer")
        .replace(/[^\w -]+/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 60) || "flyer";
    a.href = url;
    a.download = `${safe}-${scene.width}x${scene.height}.${job.mime === "image/png" ? "png" : "jpg"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setNotice(
      `Exported ${scene.width} × ${scene.height} ${job.mime === "image/png" ? "PNG" : "JPEG"}.`,
    );
  }

  // Template mode shows sample wording in place of placeholders (display only).
  const displayScene = useMemo(() => {
    if (mode !== "template" || !sampleText || !props.sampleValues) return scene;
    return {
      ...scene,
      nodes: scene.nodes.map((n) =>
        n.kind === "text"
          ? { ...n, text: fillText(n.text, props.sampleValues!) }
          : n,
      ),
    };
  }, [scene, mode, sampleText, props.sampleValues]);

  /* ---- template sizes ---- */
  function addFormat(f: FormatKey, copyFrom: FormatKey | null) {
    setHist((h) => {
      const src = copyFrom ? h.present[copyFrom] : null;
      let next: Scene = emptyScene(f);
      if (src) {
        // A starting point only: positions move proportionally, nothing is stretched; full-bleed backgrounds refit.
        const target = FORMATS[f];
        const ky = target.height / src.height;
        next = {
          ...next,
          background: src.background,
          safeMargin: src.safeMargin,
          nodes: src.nodes.map((n) => {
            const copy = { ...structuredClone(n), id: uid() } as FlyerNode;
            if (n.role === "background")
              return {
                ...copy,
                x: 0,
                y: 0,
                width: target.width,
                height: target.height,
              };
            return {
              ...copy,
              y: Math.round(n.y * ky + (n.height * ky - n.height) / 2),
            };
          }),
        };
      }
      return commit(h, { ...h.present, [f]: next }, null);
    });
    setActive(f);
    setSelected([]);
  }
  function removeFormat(f: FormatKey) {
    const left = FORMAT_KEYS.filter((k) => k !== f && scenes[k]);
    if (!left.length) return;
    setHist((h) => {
      const rest = { ...h.present };
      delete rest[f];
      return commit(h, rest, null);
    });
    setActive(left[0]);
    setSelected([]);
  }

  /* ---- panels ---- */
  const sceneControls = (
    <div className="flex flex-col gap-3">
      {mode === "design" && (
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
            Flyer name
          </span>
          <input
            className={inputCls}
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
          Background color (behind every layer)
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Background color"
            className={cn(
              "h-9 w-10 rounded border border-black/12 bg-white p-0.5",
              FOCUS,
            )}
            value={scene.background.length === 7 ? scene.background : "#000000"}
            onChange={(e) =>
              setScene((s) => ({ ...s, background: e.target.value }), "bg")
            }
          />
          <span className="font-mono text-xs text-muted">
            {scene.background}
          </span>
        </div>
      </label>
      {mode === "template" && (
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
            Safe margin
          </span>
          <input
            type="number"
            className={inputCls}
            min={0}
            max={300}
            value={scene.safeMargin}
            onChange={(e) =>
              setScene(
                (s) => ({
                  ...s,
                  safeMargin: Math.max(
                    0,
                    Math.min(300, parseInt(e.target.value, 10) || 0),
                  ),
                }),
                "margin",
              )
            }
          />
        </label>
      )}
      <p className="text-xs text-muted">
        {FORMATS[active].label} · {scene.width} × {scene.height} px ·{" "}
        {scene.nodes.length} layers
      </p>
    </div>
  );

  const propsPanel = (
    <PropertiesPanel
      scene={scene}
      node={single}
      multi={selNodes.length}
      sceneControls={sceneControls}
      api={{
        mode,
        can,
        update,
        remove: removeSelected,
        duplicate: duplicateSelected,
        reorder: reorderSel,
        openReplace: (id) => {
          setReplacing(id);
          setLeftTab(mode === "template" ? "assets" : "photos");
          if (!desktop) setDrawer("add");
        },
      }}
      textRef={textRef}
    />
  );

  const layersPanel = (
    <LayersPanel
      scene={scene}
      selected={selected}
      onSelect={select}
      update={update}
      reorderOne={(id, dir) =>
        setScene((s) => ({ ...s, nodes: reorder(s.nodes, id, dir) }), null)
      }
      group={groupSel}
      ungroup={ungroupSel}
      can={can}
    />
  );

  const library = (
    <LibraryPanel
      tab={leftTab}
      setTab={setLeftTab}
      owner={props.owner}
      uploads={uploads}
      shared={shared}
      venues={props.venues}
      templatesSlot={props.templatesSlot}
      api={{
        mode,
        addText,
        placeImage: (src, role, asset) => {
          placeImageSource(src, role, asset);
          if (!desktop) setDrawer(null);
        },
        upload: async (file, kind) => {
          const a = await props.upload(file, kind);
          if (mode === "template") setShared((s) => [a, ...s]);
          else setUploads((u) => [a, ...u]);
          setNotice("Uploaded. Tap it to put it on the flyer.");
        },
        deleteUpload: props.deleteUpload
          ? async (id) => {
              if (
                !window.confirm(
                  "Delete this upload? Flyers using it will show an empty frame.",
                )
              )
                return;
              await props.deleteUpload!(id);
              setUploads((u) => u.filter((x) => x.id !== id));
            }
          : undefined,
        replacing,
        cancelReplace: () => setReplacing(null),
      }}
    />
  );

  const saveBadge = saving ? (
    <span className="flex items-center gap-1 text-xs text-muted" role="status">
      <Loader2 size={13} className="animate-spin" /> Saving…
    </span>
  ) : saveError ? (
    <span
      className="flex items-center gap-1 text-xs text-status-declined"
      role="alert"
      title={saveError}
    >
      <CloudOff size={13} />{" "}
      <span className="max-w-[220px] truncate">{saveError}</span>
    </span>
  ) : dirty ? (
    <span
      className="flex items-center gap-1 text-xs text-status-pending"
      role="status"
    >
      <span className="h-2 w-2 rounded-full bg-status-pending" /> Unsaved
      changes
    </span>
  ) : (
    <span
      className="flex items-center gap-1 text-xs text-status-approved"
      role="status"
    >
      <Check size={13} /> Saved
    </span>
  );

  const exportBtns = (
    <>
      <button
        className={iconBtn}
        onClick={() => setExportJob({ mime: "image/png", purpose: "preview" })}
        disabled={!!exportJob}
      >
        <Eye size={15} /> Preview
      </button>
      <button
        className={cn(
          iconBtn,
          "border-gold bg-gold font-semibold text-[#1a140b]",
        )}
        onClick={() => setExportJob({ mime: "image/png", purpose: "download" })}
        disabled={!!exportJob}
      >
        <Download size={15} /> PNG
      </button>
      <button
        className={iconBtn}
        onClick={() =>
          setExportJob({ mime: "image/jpeg", purpose: "download" })
        }
        disabled={!!exportJob}
      >
        <Download size={15} /> JPEG
      </button>
    </>
  );

  return (
    <div className="flex h-dvh flex-col bg-[#ece7dd] text-foreground">
      {/* Top toolbar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-black/10 bg-[var(--card)] px-3 py-2">
        <Link
          href={props.backHref}
          className={cn(iconBtn, "border-transparent")}
          aria-label={props.backLabel}
        >
          <ArrowLeft size={16} />{" "}
          <span className="hidden sm:inline">{props.backLabel}</span>
        </Link>
        <div className="min-w-0 flex-1">
          <input
            aria-label={mode === "template" ? "Template name" : "Flyer name"}
            className={cn(
              "w-full max-w-sm truncate rounded-[6px] border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold hover:border-black/10",
              FOCUS,
            )}
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
          />
          {props.subtitle && (
            <p className="truncate px-1.5 text-[11px] text-muted">
              {props.subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className={iconBtn}
            onClick={undo}
            disabled={!hist.past.length}
            aria-label="Undo"
            title="Undo (Ctrl/⌘ Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            className={iconBtn}
            onClick={redo}
            disabled={!hist.future.length}
            aria-label="Redo"
            title="Redo (Ctrl/⌘ Shift Z)"
          >
            <Redo2 size={15} />
          </button>
          <span className="mx-1 hidden sm:block">{saveBadge}</span>
          <button
            className={cn(iconBtn, "hidden sm:inline-flex")}
            onClick={() => void doSave()}
            disabled={saving}
            title="Save (Ctrl/⌘ S)"
          >
            <Save size={15} /> Save
          </button>
          <div className="hidden items-center gap-1.5 lg:flex">
            {exportBtns}
          </div>
          {props.headerExtra}
        </div>
      </header>

      {mode === "template" && (
        <div className="flex flex-wrap items-center gap-2 border-b border-black/10 bg-[var(--card)] px-3 py-1.5 text-xs">
          <span className="font-semibold text-muted">Sizes:</span>
          {FORMAT_KEYS.filter((k) => scenes[k]).map((k) => (
            <span key={k} className="flex items-center">
              <button
                className={cn(
                  "rounded-l-full border px-3 py-1",
                  FOCUS,
                  k === active
                    ? "border-gold bg-gold-soft font-semibold"
                    : "border-black/10 bg-white",
                )}
                onClick={() => (setActive(k), setSelected([]))}
                aria-pressed={k === active}
              >
                {FORMATS[k].label} {FORMATS[k].size}
              </button>
              <button
                className={cn(
                  "rounded-r-full border border-l-0 border-black/10 bg-white px-1.5 py-1 text-muted hover:text-status-declined",
                  FOCUS,
                )}
                aria-label={`Remove ${FORMATS[k].label} size`}
                disabled={FORMAT_KEYS.filter((x) => scenes[x]).length < 2}
                onClick={() =>
                  window.confirm(
                    `Remove the ${FORMATS[k].label} layout from this template?`,
                  ) && removeFormat(k)
                }
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {FORMAT_KEYS.filter((k) => !scenes[k]).map((k) => (
            <span key={k} className="flex items-center gap-1">
              <button
                className={cn(
                  "rounded-full border border-dashed border-black/20 px-3 py-1 text-muted hover:border-gold hover:text-foreground",
                  FOCUS,
                )}
                onClick={() => addFormat(k, active)}
              >
                + {FORMATS[k].label} (start from this layout)
              </button>
              <button
                className={cn(
                  "rounded-full px-2 py-1 text-muted underline",
                  FOCUS,
                )}
                onClick={() => addFormat(k, null)}
              >
                blank
              </button>
            </span>
          ))}
          <span className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="accent-[#c99428]"
                checked={sampleText}
                onChange={(e) => setSampleText(e.target.checked)}
              />{" "}
              Show sample text
            </label>
            {props.previewDjs && (
              <label className="flex items-center gap-1.5">
                Photo preview
                <select
                  className={cn(inputCls, "w-auto py-1 text-xs")}
                  value={previewDjId ?? ""}
                  onChange={(e) => setPreviewDjId(e.target.value || null)}
                >
                  <option value="">Empty slot</option>
                  {props.previewDjs
                    .filter((d) => d.has_photo)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.display_name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {desktop && (
          <aside className="flex w-[300px] shrink-0 flex-col border-r border-black/10 bg-[var(--card)]">
            {library}
          </aside>
        )}

        {/* Canvas */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <div
              ref={wrapRef}
              tabIndex={0}
              aria-label={`Flyer canvas, ${scene.width} by ${scene.height}. Click a layer to select it. Arrow keys move the selection, Shift for bigger steps; Tab cycles through layers; Delete removes; Ctrl or Command Z undoes.`}
              className={cn(
                "absolute inset-0 overflow-auto bg-[radial-gradient(#d9d2c4_1px,transparent_1px)] [background-size:18px_18px]",
                FOCUS,
              )}
            >
              <div className="flex min-h-full min-w-full items-center justify-center p-3 lg:p-6">
                <div
                  className="shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
                  style={{
                    width: Math.round(scene.width * zoom),
                    height: Math.round(scene.height * zoom),
                  }}
                >
                  <FlyerStage
                    scene={displayScene}
                    zoom={zoom}
                    selected={selected}
                    ctx={ctx}
                    fontsKey={fontsKey}
                    showGuides={showGuides}
                    canMove={canMove}
                    onSelect={select}
                    onClear={() => setSelected([])}
                    onChange={(p, key) => applyPatches(p, key)}
                    onEditText={(id) => {
                      setSelected([id]);
                      if (!desktop) setDrawer("props");
                      setTimeout(() => textRef.current?.focus(), 80);
                    }}
                    coarse={coarse}
                  />
                </div>
              </div>
            </div>
            {/* Zoom bar */}
            <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 lg:bottom-4">
              <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/10 bg-white/95 p-1 shadow">
                <button
                  className={cn(iconBtn, "h-8 min-w-8 rounded-full border-0")}
                  aria-label="Zoom out"
                  onClick={() =>
                    setZoomMode(Math.max(0.05, +(zoom / 1.2).toFixed(3)))
                  }
                >
                  <Minus size={14} />
                </button>
                <span
                  className="w-12 text-center text-xs tabular-nums"
                  aria-live="polite"
                >
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  className={cn(iconBtn, "h-8 min-w-8 rounded-full border-0")}
                  aria-label="Zoom in"
                  onClick={() =>
                    setZoomMode(Math.min(3, +(zoom * 1.2).toFixed(3)))
                  }
                >
                  <Plus size={14} />
                </button>
                <button
                  className={cn(
                    iconBtn,
                    "h-8 rounded-full border-0",
                    zoomMode === "fit" && "bg-gold-soft",
                  )}
                  onClick={() => setZoomMode("fit")}
                  aria-pressed={zoomMode === "fit"}
                >
                  <Maximize2 size={13} /> Fit
                </button>
                <button
                  className={cn(
                    iconBtn,
                    "h-8 rounded-full border-0",
                    showGuides && "bg-gold-soft",
                  )}
                  onClick={() => setShowGuides((v) => !v)}
                  aria-pressed={showGuides}
                  title="Safe margins and snapping"
                >
                  <Ruler size={13} />{" "}
                  <span className="hidden sm:inline">Guides</span>
                </button>
              </div>
            </div>
            {notice && (
              <div
                role="status"
                className="absolute left-1/2 top-3 z-10 max-w-[90%] -translate-x-1/2 rounded-full bg-[#1a140b] px-4 py-2 text-center text-xs text-white shadow-lg"
              >
                {notice}
              </div>
            )}
          </div>

          {/* Mobile bottom bar */}
          {!desktop && (
            <nav
              className="grid grid-cols-5 border-t border-black/10 bg-[var(--card)] pb-[env(safe-area-inset-bottom)]"
              aria-label="Editor tools"
            >
              {(
                [
                  ["add", "Add", Plus],
                  ["layers", "Layers", LayersIcon],
                  ["props", "Edit", SlidersHorizontal],
                  ["more", "Export", Download],
                ] as const
              ).map(([k, l, Icon]) => (
                <button
                  key={k}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                    FOCUS,
                    drawer === k ? "text-gold-dim" : "text-muted",
                  )}
                  aria-expanded={drawer === k}
                  onClick={() => setDrawer(drawer === k ? null : k)}
                >
                  <Icon size={18} /> {l}
                </button>
              ))}
              <div className="flex flex-col items-center justify-center">
                {saveBadge}
              </div>
            </nav>
          )}
        </main>

        {desktop && (
          <aside className="flex w-[320px] shrink-0 flex-col border-l border-black/10 bg-[var(--card)]">
            <div className="min-h-0 flex-[3] overflow-y-auto">{propsPanel}</div>
            <div className="min-h-0 flex-[2] overflow-y-auto border-t border-black/10">
              {layersPanel}
            </div>
          </aside>
        )}
      </div>

      {/* Mobile drawer */}
      {!desktop && drawer && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 flex max-h-[62dvh] flex-col rounded-t-[18px] border-t border-black/10 bg-[var(--card)] shadow-[0_-12px_40px_rgba(0,0,0,0.25)]"
          role="dialog"
          aria-label={
            drawer === "add"
              ? "Add to flyer"
              : drawer === "layers"
                ? "Layers"
                : drawer === "props"
                  ? "Edit layer"
                  : "Export"
          }
          style={{ bottom: "calc(56px + env(safe-area-inset-bottom))" }}
        >
          <div className="relative z-20 flex shrink-0 items-center justify-end border-b border-black/8 px-2 py-1">
            <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-black/15" aria-hidden />
            <button className={cn(iconBtn, "h-10 min-w-10 border-0")} aria-label="Close" onClick={() => setDrawer(null)}>
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {drawer === "add" && library}
            {drawer === "layers" && layersPanel}
            {drawer === "props" && propsPanel}
            {drawer === "more" && (
              <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap gap-2">{exportBtns}</div>
                <button className={iconBtn} onClick={() => void doSave()}>
                  <Save size={15} /> Save now
                </button>
                <p className="text-xs text-muted">
                  Exports are {scene.width} × {scene.height} px images. Your
                  editable flyer (every layer) stays saved here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Flyer preview"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview of the exported flyer"
            className="max-h-[85dvh] max-w-full rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="self-center text-xs text-white/70">
              Exactly what the export looks like · {scene.width} ×{" "}
              {scene.height}
            </span>
            <button
              autoFocus
              className={cn(iconBtn)}
              onClick={() => setPreview(null)}
            >
              <X size={15} /> Close
            </button>
          </div>
        </div>
      )}
      {exportJob && (
        <>
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/30"
            role="status"
            aria-live="polite"
          >
            <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow">
              <Loader2 size={15} className="animate-spin" />{" "}
              {exportJob.purpose === "preview"
                ? "Rendering preview…"
                : "Exporting…"}
            </span>
          </div>
          <ExportStage
            scene={displayScene}
            ctx={ctx}
            mime={exportJob.mime}
            quality={0.92}
            onDone={finishExport}
          />
        </>
      )}
    </div>
  );
}
