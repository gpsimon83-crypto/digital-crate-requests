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
  Send,
  SlidersHorizontal,
  Undo2,
  X,
  Clapperboard,
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
  newImage,
  newShape,
  newText,
  reorder,
  uid,
  withGroup,
} from "@/lib/flyers/scene";
import {
  FORMATS,
  FORMAT_KEYS,
  type FlyerNode,
  type ImageNode,
  type FormatKey,
  type ImageSource,
  type Perms,
  type PlaceholderValues,
  type Role,
  type Scene,
} from "@/lib/flyers/types";
import { ExportStage, FlyerStage, textLayout, type NodePatch } from "./flyer-canvas";
import { linkedText, linkScene, preflight, resetNode, resolveScene, type Issue, type LinkContext } from "@/lib/flyers/links";
import { EventPanel, IssuesDialog, SendToVenueDialog } from "./editor-link-panel";
import { newBadge } from "@/lib/flyers/badges";
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
import type { PhotoEffects } from "@/lib/flyers/effects";
import { EffectsTab, type FxApi } from "./photo-effects-panel";
import { countNumbers, emptyMask, MAX_MASK_NUMBERS, MAX_MASK_STROKES, sanitizeMask, type ImageMask, type MaskFade, type MaskStroke } from "@/lib/flyers/mask";
import type { MaskEdit, MaskTool } from "./mask-tools";
import { MaskPanel, type MaskApi } from "./mask-panel";
import { importSvg } from "./svg-import";
import dynamic from "next/dynamic";

// Animate is loaded only when opened (it brings the video encoder with it).
const AnimateWorkspace = dynamic(() => import("./motion/animate-workspace").then((m) => m.AnimateWorkspace), { ssr: false });

export type Scenes = Partial<Record<FormatKey, Scene>>;
export type SaveResult =
  { ok: true } | { ok: false; error: string; conflict?: boolean };

/** Event data a flyer's linked layers fill from (from GET /api/flyers/designs/[id]). */
export type LinkData = {
  event: { id: string; title: string | null; starts_at: string | null; venue_id: string | null; venue_name: string | null } | null;
  venue: { id: string; name: string; has_logo: boolean } | null;
  eventDjs: FlyerDjInfo[];
  slots: (string | null)[];
  djs: FlyerDjInfo[];
  values: PlaceholderValues;
  drinkSpecials: { text: string | null; from: "night" | "venue" | null };
  hasEvent: boolean;
};
export type FlyerDjInfo = { id: string; display_name: string; has_photo: boolean; has_cutout: boolean; has_logo: boolean; role: string };
export type EventOpt = { id: string; title: string | null; starts_at: string | null; venue_id: string | null; venue_name: string | null; dj_id: string | null; source?: "event" | "calendar"; dj_name?: string | null };
export type LinkProps = {
  context: LinkData;
  events: EventOpt[];
  templates: { id: string; name: string; venue_id: string | null }[];
  currentTemplateId: string | null;
  activeTemplate: { templateId: string | null; via: string | null };
  allDjs: { id: string; display_name: string }[];
  /** Before migration 0052 the flyer can't store its links yet. */
  ready: boolean;
  /** Change what the flyer is linked to; resolves with fresh event data. */
  change: (body: { eventId?: string | null; venueId?: string | null; djSlots?: (string | null)[] | null }) => Promise<{ context?: LinkData; error?: string }>;
  /** Re-read the event data (e.g. after drink specials were edited). */
  refresh: () => Promise<LinkData | null>;
  /** Switch this flyer to another template's layout (the page reloads the flyer). */
  applyTemplate: (templateId: string) => Promise<string | null>;
  onExported?: () => void;
  /** This flyer's id (for its venue-portal copies). */
  designId: string;
  /** Upload the rendered PNG to the venue's portal. */
  sendToVenue?: (png: Blob, opts: { note: string; replace: boolean }) => Promise<{ ok: boolean; message: string }>;
};

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
  /** Full library page (folders, rename, bulk delete). */
  libraryHref?: string;
  /** Template mode: a real DJ whose photo previews the photo slot (never saved into the template). */
  previewDjs?: { id: string; display_name: string; has_photo: boolean }[];
  sampleValues?: PlaceholderValues;
  headerExtra?: React.ReactNode;
  templatesSlot?: React.ReactNode;
  subtitle?: string;
  /** Lets the page save right now (e.g. before publishing). Resolves true when everything is saved. */
  onSaveReady?: (saveNow: () => Promise<boolean>) => void;
  /** Flyers (design mode): the event / venue / DJs its linked layers follow. */
  link?: LinkProps;
  /** Template mode: preview with a real event / venue and chosen DJs (display only, never saved). */
  preview?: { values: PlaceholderValues; slots: (string | null)[]; venueId: string | null } | null;
  /** Template mode: the controls that choose that preview (shown in the sizes bar). */
  previewBar?: React.ReactNode;
};

const linkCtxOf = (c: LinkData): LinkContext => ({ values: c.values, slots: c.slots, venueId: c.venue?.id ?? null, hasEvent: c.hasEvent });
const resolveAll = (scenes: Scenes, c: LinkData | undefined): Scenes =>
  c ? (Object.fromEntries(Object.entries(scenes).map(([k, sc]) => [k, sc ? resolveScene(sc, linkCtxOf(c)) : sc])) as Scenes) : scenes;

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
  // Linked layers are refilled from the event as the flyer opens (then autosaved).
  const [linkData, setLinkData] = useState<LinkData | undefined>(props.link?.context);
  const [hist, setHist] = useState<History<Scenes>>(() =>
    initHistory(resolveAll(props.scenes, props.link?.context)),
  );
  const [active, setActive] = useState<FormatKey>(props.format);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState(props.title);
  const [zoomMode, setZoomMode] = useState<"fit" | number>("fit");
  const [fitZoom, setFitZoom] = useState(0.4);
  const [fontsKey, setFontsKey] = useState(0);
  const [animOpen, setAnimOpen] = useState(false);
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
    props.link ? "event" : props.templatesSlot
      ? "templates"
      : mode === "template"
        ? "assets"
        : "photos",
  );
  const [replacing, setReplacing] = useState<string | null>(null);
  // Photo Effects being adjusted (not in the history until Apply), and "View original" while held.
  // Effects being adjusted (not in the history until Apply), the layers they go on, and "View original" while held.
  const [fxDraft, setFxDraft] = useState<{ fx: PhotoEffects | null } | null>(null);
  const [fxTargets, setFxTargets] = useState<string[] | null>(null);
  const [fxHold, setFxHold] = useState(false);
  // Mask editing: its own step-by-step history until Apply (one undo step in the flyer), Cancel drops it.
  const [maskS, setMaskS] = useState<{ id: string; saved: ImageMask | null; draft: ImageMask | null; past: (ImageMask | null)[]; future: (ImageMask | null)[]; key: string | null; at: number } | null>(null);
  const [maskLive, setMaskLive] = useState<{ stroke?: MaskStroke | null; fade?: MaskFade | null } | null>(null);
  const [maskTool, setMaskTool] = useState<MaskTool>("hide");
  const [maskBrush, setMaskBrush] = useState({ size: 60, hardness: 0.6, opacity: 1 });
  const [maskFadeType, setMaskFadeType] = useState<"linear" | "radial">("linear");
  const [maskOverlay, setMaskOverlay] = useState(false);
  const [maskHold, setMaskHold] = useState(false);
  const [uploads, setUploads] = useState<Asset[]>(props.uploads);
  const [shared, setShared] = useState<Asset[]>(props.shared);
  const [exportJob, setExportJob] = useState<{
    mime: "image/png" | "image/jpeg";
    purpose: "download" | "preview" | "venue";
    /** 2 = high-resolution PNG (twice the pixels). */
    scale?: number;
  } | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const sendOpts = useRef<{ note: string; replace: boolean }>({ note: "", replace: true });
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
  // Template preview text: the sample wording, with real values from a chosen event / venue / DJs on top.
  const previewValues = useMemo(() => {
    if (mode !== "template" || !sampleText || !props.sampleValues) return undefined;
    const real = Object.fromEntries(Object.entries(props.preview?.values ?? {}).filter(([, v]) => v != null && v !== ""));
    return { ...props.sampleValues, ...real } as PlaceholderValues;
  }, [mode, sampleText, props.sampleValues, props.preview]);
  const ctx: SrcContext = useMemo(() => {
    const names: Record<string, string> = {};
    for (const d of props.previewDjs ?? []) names[d.id] = d.display_name;
    for (const d of linkData?.djs ?? []) names[d.id] = d.display_name;
    return {
      previewDjId: mode === "template" ? previewDjId : null,
      previewSlots: mode === "template" && props.preview ? props.preview.slots : undefined,
      previewVenueId: mode === "template" ? (props.preview?.venueId ?? null) : null,
      values: mode === "template" ? previewValues : linkData?.values,
      djNames: names,
      // Effects preview at about screen resolution (never more than the flyer's own size).
      fxScale: Math.min(1, Math.ceil(Math.max(0.35, zoom * (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1)) * 4) / 4)
    };
  }, [mode, previewDjId, linkData, previewValues, props.previewDjs, props.preview, zoom]);

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
            if (!p) return n;
            const patch = { ...p.patch } as Partial<FlyerNode> & { override?: boolean };
            // On a flyer, editing linked wording or replacing a linked picture overrides it for this flyer only.
            if (mode === "design" && !("override" in patch)) {
              if (n.kind === "text" && n.source != null && "text" in patch && (patch as { text?: string }).text !== n.text) patch.override = true;
              if (n.kind === "image" && n.linked && "source" in patch) patch.override = true;
            }
            // A new linked wording (e.g. the time's "Start – CLOSE"): fill it from the event straight away.
            if (mode === "design" && n.kind === "text" && typeof (patch as { source?: unknown }).source === "string" && !("text" in patch) && linkData)
              (patch as { text?: string }).text = linkedText((patch as { source: string }).source, linkCtxOf(linkData));
            return { ...n, ...patch } as FlyerNode;
          }),
        }),
        key,
      ),
    [setScene, mode, linkData],
  );
  const update = useCallback(
    (id: string, patch: Partial<FlyerNode>, key: string) =>
      applyPatches([{ id, patch }], key),
    [applyPatches],
  );

  // Groups (date badges): a press on any piece of an unselected group picks the
  // whole group, so dragging moves it as one. Pressing a group that's already
  // selected keeps it (drag still moves the group); releasing without dragging
  // then goes into the group and picks just that piece. Once inside, pressing
  // another piece of the same group picks that piece.
  const enterOnClick = useRef<string | null>(null);
  const select = useCallback(
    (id: string, additive: boolean, phase: "down" | "click" | "tap" = "down") => {
      const ids = withGroup(scene.nodes, id);
      if (phase === "click") {
        if (enterOnClick.current === id) setSelected([id]);
        enterOnClick.current = null;
        return;
      }
      setSelected((cur) => {
        if (additive) {
          enterOnClick.current = null;
          return ids.every((x) => cur.includes(x))
            ? cur.filter((x) => !ids.includes(x))
            : [...new Set([...cur, ...ids])];
        }
        const grouped = ids.length > 1;
        const wholeGroup = grouped && ids.every((x) => cur.includes(x)) && cur.every((x) => ids.includes(x));
        const insideGroup = grouped && cur.length > 0 && !wholeGroup && cur.every((x) => ids.includes(x));
        if (phase === "tap") {
          enterOnClick.current = null;
          return wholeGroup || insideGroup ? [id] : ids;
        }
        enterOnClick.current = wholeGroup ? id : null;
        if (wholeGroup) return cur;
        return insideGroup ? [id] : ids;
      });
      setReplacing(null);
    },
    [scene.nodes],
  );
  // The Layers list always picks exactly the layer clicked (a group's pieces included).
  const selectExact = useCallback((id: string, additive: boolean) => {
    setSelected((cur) => (additive ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id]));
    setReplacing(null);
  }, []);

  const selNodes = scene.nodes.filter((n) => selected.includes(n.id));
  const single = selNodes.length === 1 ? selNodes[0] : null;
  // The layer whose mask is being edited (if it went away — undone or deleted — mask mode simply ends).
  const maskNode = maskS ? (scene.nodes.find((n): n is ImageNode => n.id === maskS.id && n.kind === "image") ?? null) : null;
  const maskUndo = () =>
    setMaskS((st) => (st && st.past.length ? { ...st, draft: st.past[st.past.length - 1], past: st.past.slice(0, -1), future: [st.draft, ...st.future], key: null } : st));
  const maskRedo = () =>
    setMaskS((st) => (st && st.future.length ? { ...st, draft: st.future[0], past: [...st.past, st.draft], future: st.future.slice(1), key: null } : st));

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

  /** On a flyer linked to an event, new placeholder layers are linked and filled straight away. */
  function linkNew(nodes: FlyerNode[]): FlyerNode[] {
    if (mode !== "design" || !linkData) return nodes;
    return resolveScene(linkScene({ ...scene, nodes }), linkCtxOf(linkData)).nodes;
  }

  function addPreset(k: "specials" | "details" | "dj2") {
    const mid = Math.round(scene.height / 2 - 60);
    if (k === "specials") {
      const g = uid();
      const w = Math.round(scene.width * 0.7);
      const x = Math.round((scene.width - w) / 2);
      const head = newText("specials", scene, { name: "Specials heading", text: "DRINK SPECIALS", x, y: mid - 90, width: w, fontSize: 54, font: "anton", weight: 400, uppercase: true, fill: "#e5b647", groupId: g, link: { showWhen: "drink_specials" } });
      const body = newText("specials", scene, { name: "Drink specials", text: "{{event.drinkSpecials}}", x, y: mid, width: w, height: Math.round(scene.height * 0.18), fontSize: 40, weight: 700, lineHeight: 1.25, fitBox: true, minFontSize: 18, hideIfEmpty: true, groupId: g, panel: { enabled: true, color: "#000000", opacity: 0.55, padding: 24, radius: 16 } });
      const nodes = linkNew([head, body]);
      setScene((s) => ({ ...s, nodes: [...s.nodes, ...nodes] }), null);
      setSelected(nodes.map((n) => n.id));
      if (!desktop) setDrawer("props");
      if (mode === "design" && linkData && !linkData.drinkSpecials.text) setNotice("Added. It stays hidden until this night has drink specials.");
      return;
    }
    const n = newText(k === "dj2" ? "dj_name" : "details", scene, k === "dj2" ? { name: "DJ 2 name", text: "{{dj2.displayName}}", link: { showWhen: "dj2_name" } } : { name: "Event details", text: "{{event.details}}", fontSize: 44, weight: 600, hideIfEmpty: true });
    n.y = mid;
    if (mode === "design" && !linkData) n.text = k === "dj2" ? "DJ name" : "Details";
    addNode(linkNew([n])[0]);
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
      if (!linkData || role === "text") n.text = fill[role] ?? "Your text";
    }
    n.y = Math.round(scene.height / 2 - 60);
    addNode(linkNew([n])[0]);
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

  const undo = useCallback(() => {
    setFxDraft(null);
    setHist((h) => undoH(h));
  }, []);
  const redo = useCallback(() => {
    setFxDraft(null);
    setHist((h) => redoH(h));
  }, []);

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
      if (maskNode) {
        // Sliders and buttons don't take Ctrl+Z, so mask undo works right after moving one.
        const el = e.target as HTMLInputElement | null;
        const control = el?.tagName === "INPUT" && ["range", "checkbox", "radio", "button", "color"].includes(el.type);
        if (isTyping(e.target) && !control) return;
        if (control && !mod) return;
        // Mask mode: undo/redo step through brush strokes; other shortcuts wait until Apply or Cancel.
        if (mod && e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) maskRedo();
          else maskUndo();
        } else if (mod && e.key.toLowerCase() === "y") {
          e.preventDefault();
          maskRedo();
        } else if (!mod && (e.key === "[" || e.key === "]")) {
          setMaskBrush((b) => ({ ...b, size: Math.max(2, Math.min(800, Math.round(b.size * (e.key === "]" ? 1.15 : 1 / 1.15)))) }));
        } else if (e.key === "Delete" || e.key === "Backspace" || e.key.startsWith("Arrow") || (mod && e.key.toLowerCase() === "d")) e.preventDefault();
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

  /* ---- linked content (flyers): event, venue, DJ slots ---- */
  const [linkBusy, setLinkBusy] = useState(false);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [pendingJob, setPendingJob] = useState<{ mime: "image/png" | "image/jpeg"; purpose: "download" | "venue"; scale?: number } | null>(null);

  /** New event data in: refill linked layers (layout and overrides untouched). */
  function applyLinkData(c: LinkData, note?: string) {
    setLinkData(c);
    setHist((h) => {
      const next = resolveAll(h.present, c);
      return JSON.stringify(next) === JSON.stringify(h.present) ? h : commit(h, next, null);
    });
    if (note) setNotice(note);
  }
  async function changeLink(body: { eventId?: string | null; venueId?: string | null; djSlots?: (string | null)[] | null }) {
    if (!props.link) return;
    setLinkBusy(true);
    const r = await props.link.change(body);
    setLinkBusy(false);
    if (r.error) return setNotice(r.error);
    if (r.context) applyLinkData(r.context, "Filled from the event. The layout and your overrides didn't change.");
  }
  async function refreshLink() {
    if (!props.link) return;
    setLinkBusy(true);
    const c = await props.link.refresh();
    setLinkBusy(false);
    if (c) applyLinkData(c, "Refreshed from the event.");
  }
  function resetToEvent(id: string) {
    if (!linkData) return;
    const c = linkCtxOf(linkData);
    setScene((s) => ({ ...s, nodes: s.nodes.map((n) => (n.id === id ? resetNode(n, c) : n)) }), null);
    setNotice("Back to the event's data.");
  }
  /** Highest DJ slot the layout uses (pictures and {{dj2.displayName}}-style text). */
  const slotsUsed = useMemo(() => {
    let max = 1;
    for (const n of scene.nodes) {
      if (n.kind === "image") for (const src of [n.source, n.linked]) if (src && (src.type === "dj_photo" || src.type === "dj_logo")) max = Math.max(max, src.slot ?? 1);
      if (n.kind === "text") for (const m of (n.source ?? n.text).matchAll(/\{\{\s*dj(\d+)\./g)) max = Math.max(max, +m[1]);
    }
    return Math.min(8, max);
  }, [scene.nodes]);

  /** What to fix before exporting: missing photos / DJs / required content, and text that doesn't fit. */
  function exportIssues(): Issue[] {
    const list: Issue[] = linkData ? preflight(scene, { ...linkCtxOf(linkData), djs: linkData.djs }) : [];
    for (const n of scene.nodes) {
      if (n.kind !== "text" || !n.visible || (n.hideIfEmpty && !n.text.trim())) continue;
      const lay = textLayout(n, fontsKey > 0);
      if (lay.overflow) list.push({ nodeId: n.id, level: "error", message: `“${n.name}”: the text doesn't fit its box even at the smallest size.` });
      else if (n.text.trim() && n.y + (n.fitBox ? Math.min(lay.height, n.height) : lay.height) > scene.height + 2 && !n.rotation) list.push({ nodeId: n.id, level: "warning", message: `“${n.name}” runs off the bottom of the flyer.` });
    }
    return list;
  }
  function requestExport(mime: "image/png" | "image/jpeg", purpose: "download" | "venue" = "download", scale = 1) {
    const found = mode === "design" ? exportIssues() : [];
    if (found.length) {
      setIssues(found);
      setPendingJob({ mime, purpose, scale });
      return;
    }
    setExportJob({ mime, purpose, scale });
  }

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
    if (job.purpose === "venue") {
      // The same PNG an export makes, sent to the venue's portal.
      URL.revokeObjectURL(url);
      const send = props.link?.sendToVenue;
      if (!send) return;
      setNotice("Sending to the venue…");
      void send(blob, sendOpts.current).then((r) => setNotice(r.message));
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
    a.download = `${safe}-${scene.width * (job.scale ?? 1)}x${scene.height * (job.scale ?? 1)}.${job.mime === "image/png" ? "png" : "jpg"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    // Exported flyers are left alone when a newly activated template is applied to drafts.
    props.link?.onExported?.();
    setNotice(
      `Exported ${scene.width} × ${scene.height} ${job.mime === "image/png" ? "PNG" : "JPEG"}.`,
    );
  }

  // Template mode shows sample wording in place of placeholders (display only).
  // The layers Effects applies to: the ones ticked in the Effects tab, else the selection.
  const fxIds = (fxTargets ?? selected).filter((id) => scene.nodes.some((n) => n.id === id));
  const fxIdsKey = fxIds.join(",");
  const activeFx = fxDraft && fxIds.length ? { ...fxDraft, ids: fxIds } : null;
  const displayScene = useMemo(() => {
    const base =
      mode !== "template" || !previewValues
        ? scene
        : {
            ...scene,
            nodes: scene.nodes.map((n) =>
              n.kind === "text"
                ? { ...n, text: linkedText(n.text, { values: previewValues, slots: [], venueId: null, hasEvent: false }) }
                : n,
            ),
          };
    // The effects being adjusted show on the canvas; "View original" shows the photo without them.
    const holdIds = fxHold ? fxIds : [];
    if (!activeFx && !holdIds.length) return base;
    return {
      ...base,
      nodes: base.nodes.map((n) =>
        holdIds.includes(n.id) ? { ...n, effects: null } : activeFx?.ids.includes(n.id) ? { ...n, effects: activeFx.fx } : n,
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, mode, previewValues, fxDraft, fxHold, fxIdsKey]);

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

  const fxApi: FxApi = {
    ctx,
    editing: !!activeFx,
    draft: activeFx ? activeFx.fx : undefined,
    targets: fxIds,
    setTargets: (ids) => setFxTargets(ids),
    start: () => {
      // Start from the first chosen layer's current look.
      const n = scene.nodes.find((x) => x.id === fxIds[0]);
      setFxDraft({ fx: n?.effects ?? null });
    },
    change: (fx) => setFxDraft({ fx }),
    apply: () => {
      if (!activeFx) return;
      // One undo step for the whole adjustment, on every chosen layer, however many sliders moved.
      applyPatches(activeFx.ids.map((id) => ({ id, patch: { effects: activeFx.fx } })), `fx:${Date.now()}`);
      setFxDraft(null);
    },
    cancel: () => setFxDraft(null),
    hold: setFxHold,
    quick: (ids, fx) => applyPatches(ids.map((id) => ({ id, patch: { effects: fx } })), `fx:${Date.now()}`),
  };

  /* ---- mask ---- */
  /** One step in the mask's own history; slider moves in a row (same key) merge into one. */
  const maskStep = (fn: (m: ImageMask | null) => ImageMask | null, key: string | null = null) =>
    setMaskS((st) => {
      if (!st) return st;
      const next = fn(st.draft);
      if (next === st.draft) return st;
      const merge = key && st.key === key && Date.now() - st.at < 900;
      return { ...st, draft: next, past: merge ? st.past : [...st.past, st.draft].slice(-200), future: [], key, at: Date.now() };
    });
  const withMask = (m: ImageMask | null, patch: Partial<ImageMask>): ImageMask | null => {
    const next = { ...(m ?? emptyMask()), ...patch };
    return next.strokes.length || next.fade || next.feather > 0 ? next : null;
  };
  const openMask = (id: string) => {
    const n = scene.nodes.find((x) => x.id === id);
    if (!n || n.kind !== "image") return;
    setFxDraft(null);
    setFxTargets(null);
    setSelected([id]);
    setMaskS({ id, saved: n.mask ?? null, draft: n.mask ?? null, past: [], future: [], key: null, at: 0 });
    setMaskLive(null);
    setMaskHold(false);
    // A brush about a twelfth of the layer to start with.
    setMaskBrush((b) => ({ ...b, size: Math.max(6, Math.min(400, Math.round(Math.min(n.width, n.height) / 12))) }));
    if (!desktop) setDrawer(null);
  };
  const closeMask = () => {
    setMaskS(null);
    setMaskLive(null);
    setMaskHold(false);
  };
  const maskShown: ImageMask | null = useMemo(() => {
    if (!maskS) return null;
    const d = maskS.draft;
    if (!maskLive) return d;
    const base = d ?? emptyMask();
    return {
      ...base,
      strokes: maskLive.stroke ? [...base.strokes, maskLive.stroke] : base.strokes,
      fade: maskLive.fade !== undefined ? maskLive.fade : base.fade,
    };
  }, [maskS, maskLive]);
  const maskEdit: MaskEdit | null =
    maskS && maskNode
      ? {
          node: { ...maskNode, mask: maskShown },
          tool: maskTool,
          brush: maskBrush,
          fadeType: maskFadeType,
          fade: maskShown?.fade ?? null,
          onStroke: (st, phase) => {
            if (phase === "move") return setMaskLive({ stroke: st });
            setMaskLive(null);
            if (phase === "end" && st) {
              if (countNumbers(maskS.draft) + st.points.length > MAX_MASK_NUMBERS || (maskS.draft?.strokes.length ?? 0) >= MAX_MASK_STROKES) {
                setNotice("This mask has as much brush work as it can hold. Apply it, or Reset and use fewer, longer strokes.");
                return;
              }
              maskStep((m) => withMask(m, { strokes: [...(m?.strokes ?? []), st] }));
            }
          },
          onFade: (f, phase) => {
            if (phase === "move") return setMaskLive({ fade: f });
            setMaskLive(null);
            maskStep((m) => withMask(m, { fade: f }));
          },
        }
      : null;
  const maskApi: MaskApi | null =
    maskS && maskNode
      ? {
          name: maskNode.name,
          tool: maskTool,
          setTool: setMaskTool,
          brush: maskBrush,
          setBrush: (b) => setMaskBrush((o) => ({ ...o, ...b })),
          maxSize: Math.max(40, Math.round(Math.max(maskNode.width, maskNode.height) / 2)),
          fadeType: maskFadeType,
          setFadeType: setMaskFadeType,
          fade: maskS.draft?.fade ?? null,
          addFade: (t) =>
            // Linear: shown at 65% down the picture, gone at the bottom. Radial: shown in the middle, gone at the edge.
            maskStep((m) => withMask(m, { fade: t === "linear" ? { type: "linear", a: [0.5, 0.65], b: [0.5, 1], reverse: false } : { type: "radial", a: [0.5, 0.5], b: [0.5, 1], reverse: false } })),
          setFade: (f) => maskStep((m) => withMask(m, { fade: f })),
          feather: maskS.draft?.feather ?? 0,
          setFeather: (v) => maskStep((m) => withMask(m, { feather: v }), "feather"),
          overlay: maskOverlay,
          setOverlay: setMaskOverlay,
          hold: setMaskHold,
          canUndo: maskS.past.length > 0,
          canRedo: maskS.future.length > 0,
          undo: maskUndo,
          redo: maskRedo,
          // Clears every stroke and fade; the picture's own transparency (a PNG cut-out) is untouched.
          reset: () => maskStep(() => null),
          cancel: closeMask,
          apply: () => {
            const m = sanitizeMask(maskS.draft);
            if (JSON.stringify(m) !== JSON.stringify(sanitizeMask(maskS.saved))) update(maskS.id, { mask: m }, `mask:${maskS.id}:${maskS.at}`);
            closeMask();
          },
          dirty: JSON.stringify(maskS.draft) !== JSON.stringify(maskS.saved),
          hasEdits: !!maskS.draft,
        }
      : null;
  const maskCtx: SrcContext = useMemo(
    () => (maskS && maskNode ? { ...ctx, maskView: { id: maskS.id, overlay: maskOverlay, hold: maskHold, color: "#ff2d6f" } } : ctx),
    [ctx, maskS, maskNode, maskOverlay, maskHold],
  );
  // The canvas shows the mask being edited; exports and saves only ever see applied masks.
  const stageScene = useMemo(
    () => (maskS && maskNode ? { ...displayScene, nodes: displayScene.nodes.map((n) => (n.id === maskS.id && n.kind === "image" ? { ...n, mask: maskShown } : n)) } : displayScene),
    [displayScene, maskS, maskNode, maskShown],
  );

  const propsPanel = maskApi ? (
    <MaskPanel api={maskApi} />
  ) : (
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
        setLocked: (locked) =>
          applyPatches(
            selNodes.filter((n) => mode === "template" || can(n, "move")).map((n) => ({ id: n.id, patch: { locked } })),
            `lock:${selected.join(",")}`,
          ),
        selectionLocked: selNodes.length > 0 && selNodes.every((n) => n.locked),
        selectionIsGroup: selNodes.length > 1 && !!selNodes[0].groupId && selNodes.every((n) => n.groupId === selNodes[0].groupId),
        openReplace: (id) => {
          setReplacing(id);
          const target = scene.nodes.find((n) => n.id === id);
          // Open the tab with pictures of the right kind: DJ photos, logos, or art (badges, overlays, backgrounds).
          setLeftTab(mode === "template" ? "assets" : target?.role === "portrait" ? "photos" : target?.role === "logo" || target?.role === "dj_logo" ? "logos" : "assets");
          if (!desktop) setDrawer("add");
        },
        resetToEvent: props.link ? resetToEvent : undefined,
        openEffects: () => {
          setFxTargets(null);
          setLeftTab("effects");
          if (!desktop) setDrawer("add");
        },
        openMask,
      }}
      textRef={textRef}
    />
  );

  const layersPanel = (
    <LayersPanel
      scene={scene}
      selected={selected}
      onSelect={selectExact}
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
      setTab={(t) => {
        // Leaving Effects drops an unapplied adjustment and the layer choice.
        if (t !== "effects") {
          setFxDraft(null);
          setFxTargets(null);
        }
        setLeftTab(t);
      }}
      owner={props.owner}
      uploads={uploads}
      shared={shared}
      venues={props.venues}
      templatesSlot={props.templatesSlot}
      effectsSlot={
        <EffectsTab scene={scene} api={fxApi} canStyle={(n) => can(n, "style")} />
      }
      eventSlot={
        props.link && linkData ? (
          <EventPanel link={props.link} data={linkData} busy={linkBusy} staff={staff} slotsUsed={slotsUsed} onChange={(b) => void changeLink(b)} onRefresh={() => void refreshLink()} />
        ) : undefined
      }
      api={{
        mode,
        addText,
        addPreset,
        addBadge: (id) => {
          const nodes = linkNew(newBadge(id, scene));
          setScene((s) => ({ ...s, nodes: [...s.nodes, ...nodes] }), null);
          setSelected(nodes.map((n) => n.id));
          if (!desktop) setDrawer("props");
        },
        addShape: (k) => {
          addNode(newShape(k, scene));
          if (!desktop) setDrawer("props");
        },
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
        deleteAsset: async (a) => {
          if (!window.confirm(`Delete “${a.name ?? "this image"}” from the library?`)) return;
          let r = await fetch(`/api/flyers/assets/${a.id}`, { method: "DELETE" });
          let j = await r.json().catch(() => ({}));
          if (r.status === 409 && j.inUse) {
            const u = j.usage as { designs: number; templates: string[]; publishedVersions: number };
            const where = [u.designs ? `${u.designs} flyer${u.designs === 1 ? "" : "s"}` : null, u.templates.length ? `template ${u.templates.map((t) => `“${t}”`).join(", ")}` : null, u.publishedVersions && !u.templates.length ? "a published template" : null].filter(Boolean).join(" and ");
            if (!window.confirm(`It's used in ${where}. Delete anyway? Those spots will show an empty frame. This can't be undone.`)) return;
            r = await fetch(`/api/flyers/assets/${a.id}?force=1`, { method: "DELETE" });
            j = await r.json().catch(() => ({}));
          }
          if (!r.ok) return setNotice(j.error ?? "Couldn't delete.");
          setUploads((u) => u.filter((x) => x.id !== a.id));
          setShared((s) => s.filter((x) => x.id !== a.id));
          setNotice("Deleted.");
        },
        libraryHref: props.libraryHref,
        replacing,
        cancelReplace: () => setReplacing(null),
        // DJs get imported designs through templates; staff can also import straight into a flyer.
        importSvg: mode === "template" || staff ? async (file, placeholders) => {
          // Check the size first so nothing is uploaded for a file that can't go here.
          const head = await file.slice(0, 4000).text();
          const vb = head.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
          const fmtGuess = vb ? FORMAT_KEYS.reduce((b, k) => (Math.abs(FORMATS[k].height / FORMATS[k].width - +vb[2] / +vb[1]) < Math.abs(FORMATS[b].height / FORMATS[b].width - +vb[2] / +vb[1]) ? k : b), FORMAT_KEYS[0]) : active;
          if (mode === "design" && fmtGuess !== active) throw new Error(`That SVG is a ${FORMATS[fmtGuess].label.toLowerCase()}; this flyer is a ${FORMATS[active].label.toLowerCase()}. Start a flyer in that size to import it.`);
          const target = scenes[fmtGuess];
          if (target?.nodes.length && !window.confirm(`Replace the ${target.nodes.length} layers in the ${FORMATS[fmtGuess].label} layout with this SVG? (Undo brings them back.)`)) return;
          const r = await importSvg(file, { upload: props.upload, placeholders, onProgress: setNotice });
          setHist((h) => commit(h, { ...h.present, [r.scene.format]: { ...r.scene, safeMargin: h.present[r.scene.format]?.safeMargin ?? r.scene.safeMargin } }, null));
          setActive(r.scene.format);
          setSelected([]);
          setNotice(`Imported ${r.texts} text layer${r.texts === 1 ? "" : "s"} and ${r.images} image${r.images === 1 ? "" : "s"}.${r.warnings.length ? ` ${r.warnings[0]}` : ""}`);
          if (r.warnings.length > 1) window.setTimeout(() => setNotice(r.warnings.slice(1).join(" ")), 4000);
        } : undefined,
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
        onClick={() => requestExport("image/png")}
        disabled={!!exportJob}
      >
        <Download size={15} /> PNG
      </button>
      <button
        className={iconBtn}
        onClick={() => requestExport("image/png", "download", 2)}
        disabled={!!exportJob}
        title={`High resolution: ${scene.width * 2} × ${scene.height * 2} px`}
        data-tour="flyer-png2x"
      >
        <Download size={15} /> PNG 2×
      </button>
      <button
        className={iconBtn}
        onClick={() => requestExport("image/jpeg")}
        disabled={!!exportJob}
      >
        <Download size={15} /> JPEG
      </button>
      {props.link?.sendToVenue && (
        <button className={iconBtn} data-tour="flyer-send-venue" onClick={() => setSendOpen(true)} disabled={!!exportJob}>
          <Send size={15} /> Send to venue
        </button>
      )}
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
            onClick={maskNode ? maskUndo : undo}
            disabled={maskNode ? !maskS?.past.length : !hist.past.length}
            aria-label="Undo"
            title="Undo (Ctrl/⌘ Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            className={iconBtn}
            onClick={maskNode ? maskRedo : redo}
            disabled={maskNode ? !maskS?.future.length : !hist.future.length}
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
          {mode === "design" && props.link && (
            <button
              className={cn(iconBtn, "border-gold/60")}
              onClick={() => {
                if (currentKey !== savedKey) void doSave();
                setAnimOpen(true);
              }}
              data-tour="flyer-animate"
              title="Add motion and export a looping video"
            >
              <Clapperboard size={15} /> Animate
            </button>
          )}
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
            {props.previewBar}
            {props.previewDjs && !props.previewBar && (
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
                    scene={stageScene}
                    zoom={zoom}
                    selected={selected}
                    ctx={maskCtx}
                    maskEdit={maskEdit}
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

          {/* Mobile: mask controls take the place of the bottom bar while masking. */}
          {!desktop && maskApi && <MaskPanel api={maskApi} compact />}
          {/* Mobile bottom bar */}
          {!desktop && !maskApi && (
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
      {!desktop && drawer && !maskApi && (
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
      {animOpen && props.link && (
        <AnimateWorkspace
          designId={props.link.designId}
          scene={scene}
          ctx={{ ...ctx, maskView: null }}
          title={title}
          onClose={() => setAnimOpen(false)}
          canMove={canMove}
          canRemove={(n) => can(n, "remove")}
          onNodes={(nodes) => setScene((s) => ({ ...s, nodes }), null)}
        />
      )}
      {sendOpen && props.link && (
        <SendToVenueDialog
          designId={props.link.designId}
          venueName={linkData?.venue?.name ?? null}
          onClose={() => setSendOpen(false)}
          onSend={(o) => {
            sendOpts.current = o;
            setSendOpen(false);
            requestExport("image/png", "venue");
          }}
        />
      )}
      {issues && (
        <IssuesDialog
          issues={issues}
          onPick={(id) => {
            setIssues(null);
            setSelected([id]);
            if (!desktop) setDrawer("props");
          }}
          onCancel={() => setIssues(null)}
          onExport={() => {
            setIssues(null);
            if (pendingJob) setExportJob(pendingJob);
          }}
        />
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
                : exportJob.purpose === "venue"
                  ? "Preparing the flyer for the venue…"
                  : "Exporting…"}
            </span>
          </div>
          <ExportStage
            scene={displayScene}
            ctx={ctx}
            mime={exportJob.mime}
            quality={0.92}
            pixelRatio={exportJob.scale ?? 1}
            onDone={finishExport}
          />
        </>
      )}
    </div>
  );
}
