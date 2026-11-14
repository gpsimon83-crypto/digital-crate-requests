import { z } from "zod";
import { DEFAULT_FONT, FLYER_FONTS } from "./fonts";
import {
  FORMATS,
  PLACEHOLDERS,
  ROLES,
  type FlyerNode,
  type FormatKey,
  type ImageNode,
  type ImageSource,
  type Perms,
  type PlaceholderValues,
  type Role,
  type Scene,
  type Shadow,
  type TemplateContent,
  type TextNode
} from "./types";

export const MAX_NODES = 80;
export const MAX_TEXT = 500;
export const MAX_SCENE_BYTES = 400_000;

export const FULL_PERMS: Perms = { move: true, edit: true, style: true, remove: true };
export const LOCKED_PERMS: Perms = { move: false, edit: false, style: false, remove: false };
export const NO_SHADOW: Shadow = { enabled: false, color: "#000000", blur: 12, offsetX: 0, offsetY: 6, opacity: 0.5 };

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

export function emptyScene(format: FormatKey): Scene {
  const f = FORMATS[format];
  return { version: 1, format, width: f.width, height: f.height, background: "#0b0910", safeMargin: 60, nodes: [] };
}

export function newText(role: Role, scene: Pick<Scene, "width" | "height">, patch: Partial<TextNode> = {}): TextNode {
  const width = Math.round(scene.width * 0.8);
  return {
    id: uid(),
    kind: "text",
    name: ROLES[role],
    role,
    x: Math.round((scene.width - width) / 2),
    y: Math.round(scene.height * 0.4),
    width,
    height: 120,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    groupId: null,
    perms: { ...FULL_PERMS },
    text: role === "text" ? "Your text" : `{{${role === "title" ? "event_title" : role === "dj_name" ? "dj_name" : role === "date" ? "event_date" : role === "time" ? "start_time" : role === "venue" ? "venue_name" : role === "address" ? "venue_address" : "event_title"}}}`,
    font: DEFAULT_FONT,
    weight: 800,
    italic: false,
    fontSize: 72,
    lineHeight: 1.1,
    letterSpacing: 0,
    align: "center",
    uppercase: false,
    fill: "#ffffff",
    stroke: { enabled: false, color: "#000000", width: 4 },
    shadow: { ...NO_SHADOW },
    ...patch
  };
}

export function newImage(role: Role, source: ImageSource, scene: Pick<Scene, "width" | "height">, patch: Partial<ImageNode> = {}): ImageNode {
  const full = role === "background";
  const width = full ? scene.width : Math.round(scene.width * 0.5);
  const height = full ? scene.height : role === "logo" ? Math.round(scene.width * 0.25) : Math.round(scene.width * 0.6);
  return {
    id: uid(),
    kind: "image",
    name: ROLES[role],
    role,
    x: full ? 0 : Math.round((scene.width - width) / 2),
    y: full ? 0 : Math.round((scene.height - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    groupId: null,
    perms: { ...FULL_PERMS },
    source,
    fit: role === "logo" || role === "overlay" ? "contain" : "cover",
    crop: { zoom: 1, x: 0, y: 0 },
    flipX: false,
    flipY: false,
    frame: { enabled: false, color: "#e5b647", width: 6, radius: 0 },
    shadow: { ...NO_SHADOW },
    ...patch
  };
}

/* ---------------- validation ---------------- */

const num = (min: number, max: number, dflt: number) =>
  z.preprocess((v) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt), z.number());
const color = (dflt: string) => z.preprocess((v) => (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v) ? v : dflt), z.string());
const bool = (dflt: boolean) => z.preprocess((v) => (typeof v === "boolean" ? v : dflt), z.boolean());
const str = (max: number, dflt = "") => z.preprocess((v) => (typeof v === "string" ? v.slice(0, max) : dflt), z.string());

const shadowSchema = z.preprocess(
  (v) => (v && typeof v === "object" ? v : {}),
  z.object({ enabled: bool(false), color: color("#000000"), blur: num(0, 120, 12), offsetX: num(-200, 200, 0), offsetY: num(-200, 200, 6), opacity: num(0, 1, 0.5) })
);
const strokeSchema = z.preprocess((v) => (v && typeof v === "object" ? v : {}), z.object({ enabled: bool(false), color: color("#000000"), width: num(0, 60, 4) }));
const permsSchema = z.preprocess(
  (v) => (v && typeof v === "object" ? v : {}),
  z.object({ move: bool(true), edit: bool(true), style: bool(true), remove: bool(true) })
);
const roleSchema = z.preprocess((v) => (typeof v === "string" && v in ROLES ? v : "image"), z.enum(Object.keys(ROLES) as [Role, ...Role[]]));
const idSchema = z.preprocess((v) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : uid()), z.string());
const groupSchema = z.preprocess((v) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : null), z.string().nullable());

const base = {
  id: idSchema,
  name: str(60, "Layer"),
  role: roleSchema,
  x: num(-8000, 8000, 0),
  y: num(-8000, 8000, 0),
  width: num(4, 8000, 200),
  height: num(4, 8000, 200),
  rotation: num(-360, 360, 0),
  opacity: num(0, 1, 1),
  visible: bool(true),
  locked: bool(false),
  groupId: groupSchema,
  perms: permsSchema
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const STATIC_SRC = /^\/flyers\/[a-z0-9/_-]+\.(png|jpe?g|webp)$/i;

function cleanSource(v: unknown): ImageSource {
  const s = (v ?? {}) as Record<string, unknown>;
  if (s.type === "asset" && typeof s.assetId === "string" && UUID.test(s.assetId)) return { type: "asset", assetId: s.assetId };
  if (s.type === "static" && typeof s.src === "string" && STATIC_SRC.test(s.src) && !s.src.includes("..")) return { type: "static", src: s.src };
  if (s.type === "dj_photo") return { type: "dj_photo", djId: typeof s.djId === "string" && UUID.test(s.djId) ? s.djId : null };
  if (s.type === "venue_logo") return { type: "venue_logo", venueId: typeof s.venueId === "string" && UUID.test(s.venueId) ? s.venueId : null };
  return { type: "none" };
}

const imageSchema = z.object({
  ...base,
  kind: z.literal("image"),
  source: z.preprocess(cleanSource, z.custom<ImageSource>()),
  fit: z.preprocess((v) => (v === "contain" ? "contain" : "cover"), z.enum(["cover", "contain"])),
  crop: z.preprocess((v) => (v && typeof v === "object" ? v : {}), z.object({ zoom: num(1, 6, 1), x: num(-1, 1, 0), y: num(-1, 1, 0) })),
  flipX: bool(false),
  flipY: bool(false),
  frame: z.preprocess((v) => (v && typeof v === "object" ? v : {}), z.object({ enabled: bool(false), color: color("#e5b647"), width: num(0, 80, 6), radius: num(0, 2000, 0) })),
  shadow: shadowSchema
});

const fontKeys = FLYER_FONTS.map((f) => f.key);
const textSchema = z.object({
  ...base,
  kind: z.literal("text"),
  text: str(MAX_TEXT, ""),
  font: z.preprocess((v) => (typeof v === "string" && fontKeys.includes(v) ? v : DEFAULT_FONT), z.string()),
  weight: num(100, 900, 400),
  italic: bool(false),
  fontSize: num(6, 600, 48),
  lineHeight: num(0.6, 3, 1.15),
  letterSpacing: num(-20, 80, 0),
  align: z.preprocess((v) => (v === "left" || v === "right" ? v : "center"), z.enum(["left", "center", "right"])),
  uppercase: bool(false),
  fill: color("#ffffff"),
  stroke: strokeSchema,
  shadow: shadowSchema
});

const nodeSchema = z.preprocess(
  (v) => (v && typeof v === "object" && (v as { kind?: string }).kind === "text" ? v : v && typeof v === "object" ? { ...(v as object), kind: "image" } : null),
  z.discriminatedUnion("kind", [imageSchema, textSchema])
);

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Checks and cleans a scene from the browser: unknown fields dropped, numbers clamped, sources restricted. */
export function parseScene(raw: unknown, expectFormat?: FormatKey): ParseResult<Scene> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Missing flyer data." };
  if (JSON.stringify(raw).length > MAX_SCENE_BYTES) return { ok: false, error: "This flyer is too large to save." };
  const r = raw as Record<string, unknown>;
  const format = (typeof r.format === "string" && r.format in FORMATS ? r.format : expectFormat) as FormatKey | undefined;
  if (!format) return { ok: false, error: "Unknown flyer size." };
  if (expectFormat && format !== expectFormat) return { ok: false, error: "The flyer size can't change." };
  const nodesRaw = Array.isArray(r.nodes) ? r.nodes : [];
  if (nodesRaw.length > MAX_NODES) return { ok: false, error: `A flyer can have up to ${MAX_NODES} layers.` };
  const nodes: FlyerNode[] = [];
  const seen = new Set<string>();
  for (const n of nodesRaw) {
    const p = nodeSchema.safeParse(n);
    if (!p.success) return { ok: false, error: "One of the layers couldn't be read." };
    const node = p.data as FlyerNode;
    if (seen.has(node.id)) node.id = uid();
    seen.add(node.id);
    nodes.push(node);
  }
  const f = FORMATS[format];
  return {
    ok: true,
    value: {
      version: 1,
      format,
      width: f.width,
      height: f.height,
      background: typeof r.background === "string" && /^#[0-9a-f]{3,8}$/i.test(r.background) ? r.background : "#0b0910",
      safeMargin: typeof r.safeMargin === "number" && Number.isFinite(r.safeMargin) ? Math.min(300, Math.max(0, Math.round(r.safeMargin))) : 60,
      nodes
    }
  };
}

export function parseTemplateContent(raw: unknown): ParseResult<TemplateContent> {
  const formats = ((raw ?? {}) as { formats?: Record<string, unknown> }).formats ?? {};
  const out: TemplateContent = { formats: {} };
  for (const key of Object.keys(FORMATS) as FormatKey[]) {
    if (!formats[key]) continue;
    const p = parseScene(formats[key], key);
    if (!p.ok) return { ok: false, error: `${FORMATS[key].label}: ${p.error}` };
    out.formats[key] = p.value;
  }
  return { ok: true, value: out };
}

/* ---------------- placeholders ---------------- */

const TOKEN = /\{\{\s*([a-z_]+)\s*(?:\|([^}]{0,80}))?\}\}/g;

/** Replaces {{dj_name}}-style placeholders. `{{event_title|Saturday Night}}` falls back to the text after the bar. */
export function fillText(text: string, values: PlaceholderValues, keepUnknown = true): string {
  return text.replace(TOKEN, (m, key: string, fallback?: string) => {
    const v = (values as Record<string, string | null | undefined>)[key];
    if (v) return v;
    if (fallback !== undefined) return fallback.trim();
    if (key in PLACEHOLDERS) return keepUnknown ? m : "";
    return m;
  });
}

export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(TOKEN)].map((m) => m[1]);
}

/**
 * A DJ's starting copy of a template layout: placeholders filled from the DJ
 * and booking, the portrait pointed at this DJ's own photo, the venue logo at
 * the booking's (or template's) venue. Text with nothing to fill keeps a
 * readable label instead of raw braces.
 */
export function instantiate(scene: Scene, ctx: { values: PlaceholderValues; djId: string; venueId: string | null }): Scene {
  const labels = Object.fromEntries(Object.entries(PLACEHOLDERS).map(([k, label]) => [k, label]));
  const nodes = scene.nodes.map((n): FlyerNode => {
    if (n.kind === "text") {
      const filled = fillText(n.text, ctx.values);
      return { ...n, text: filled.replace(TOKEN, (_m, key: string) => labels[key] ?? "") };
    }
    if (n.source.type === "dj_photo") return { ...n, source: { type: "dj_photo", djId: ctx.djId } };
    if (n.source.type === "venue_logo") {
      const venueId = ctx.venueId ?? n.source.venueId ?? null;
      return { ...n, source: { type: "venue_logo", venueId }, visible: n.visible && !!venueId };
    }
    return n;
  });
  return { ...scene, nodes };
}

/** Booking fields as flyer text (Central time unless the booking says otherwise). */
export function bookingValues(
  e: { title?: string | null; starts_at?: string | null; ends_at?: string | null; timezone?: string | null; venue_name?: string | null; venue_address?: string | null } | null,
  djName: string
): PlaceholderValues {
  const tz = e?.timezone || "America/Chicago";
  const time = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).formatToParts(d);
    const h = parts.find((p) => p.type === "hour")?.value ?? "";
    const m = parts.find((p) => p.type === "minute")?.value ?? "00";
    const ap = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
    return `${h}${m === "00" ? "" : `:${m}`} ${ap}`.trim();
  };
  const date = e?.starts_at && !Number.isNaN(new Date(e.starts_at).getTime())
    ? new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(new Date(e.starts_at))
    : null;
  return {
    dj_name: djName,
    event_title: e?.title?.trim() || null,
    event_date: date,
    start_time: time(e?.starts_at),
    end_time: time(e?.ends_at),
    venue_name: e?.venue_name?.trim() || null,
    venue_address: e?.venue_address?.trim() || null
  };
}

/* ---------------- image placement (non-destructive crop) ---------------- */

/** Where the image is drawn inside its frame, given its natural size. Frame clips it. */
export function imageLayout(frame: { width: number; height: number }, natural: { width: number; height: number }, fit: "cover" | "contain", crop: { zoom: number; x: number; y: number }) {
  const nw = Math.max(1, natural.width);
  const nh = Math.max(1, natural.height);
  const base = fit === "cover" ? Math.max(frame.width / nw, frame.height / nh) : Math.min(frame.width / nw, frame.height / nh);
  const s = base * Math.max(1, crop.zoom);
  const width = nw * s;
  const height = nh * s;
  return {
    x: ((frame.width - width) / 2) * (1 + crop.x),
    y: ((frame.height - height) / 2) * (1 + crop.y),
    width,
    height
  };
}

/* ---------------- layer operations ---------------- */

/** Move a layer (and its group) up or down the stack. Index 0 = bottom. */
export function reorder(nodes: FlyerNode[], id: string, dir: "up" | "down" | "top" | "bottom"): FlyerNode[] {
  const i = nodes.findIndex((n) => n.id === id);
  if (i < 0) return nodes;
  const list = [...nodes];
  const [n] = list.splice(i, 1);
  const to = dir === "up" ? Math.min(list.length, i + 1) : dir === "down" ? Math.max(0, i - 1) : dir === "top" ? list.length : 0;
  list.splice(to, 0, n);
  return list;
}

export function duplicateNodes(nodes: FlyerNode[], ids: string[], offset = 24): { nodes: FlyerNode[]; newIds: string[] } {
  const groupMap = new Map<string, string>();
  const newIds: string[] = [];
  const copies = nodes
    .filter((n) => ids.includes(n.id))
    .map((n) => {
      const id = uid();
      newIds.push(id);
      const groupId = n.groupId ? (groupMap.get(n.groupId) ?? (groupMap.set(n.groupId, uid()), groupMap.get(n.groupId)!)) : null;
      return { ...structuredClone(n), id, groupId, name: `${n.name} copy`.slice(0, 60), x: n.x + offset, y: n.y + offset, locked: false, perms: { ...FULL_PERMS } } as FlyerNode;
    });
  const top = Math.max(...nodes.map((n, i) => (ids.includes(n.id) ? i : -1)));
  const list = [...nodes];
  list.splice(top + 1, 0, ...copies);
  return { nodes: list, newIds };
}

/** Ids that act together with this one (its group). */
export function withGroup(nodes: FlyerNode[], id: string): string[] {
  const n = nodes.find((x) => x.id === id);
  if (!n?.groupId) return n ? [n.id] : [];
  return nodes.filter((x) => x.groupId === n.groupId).map((x) => x.id);
}

/* ---------------- DJ permission check (server side) ---------------- */

const MOVE_KEYS = ["x", "y", "width", "height", "rotation"] as const;
const STYLE_KEYS_TEXT = ["font", "weight", "italic", "fontSize", "lineHeight", "letterSpacing", "align", "uppercase", "fill", "stroke", "shadow", "opacity"] as const;
const STYLE_KEYS_IMAGE = ["fit", "crop", "flipX", "flipY", "frame", "shadow", "opacity"] as const;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A DJ may only change what the template allows. Compares the saved scene
 * with the new one, layer by layer, using the permissions stored on the
 * previously saved layers (which the DJ can't change either).
 */
export function checkDjChanges(prev: Scene, next: Scene): string | null {
  const byId = new Map(next.nodes.map((n) => [n.id, n]));
  for (const p of prev.nodes) {
    const n = byId.get(p.id);
    if (!n) {
      if (!p.perms.remove) return `“${p.name}” is part of the template and can't be deleted.`;
      continue;
    }
    if (!same(p.perms, n.perms)) return `“${p.name}”: layer permissions are set by the template.`;
    if (n.kind !== p.kind) return `“${p.name}” can't change type.`;
    if (!p.perms.move && MOVE_KEYS.some((k) => Math.abs((n[k] as number) - (p[k] as number)) > 0.5)) return `“${p.name}” is fixed in place by the template.`;
    if (!p.perms.edit) {
      if (p.kind === "text" && n.kind === "text" && n.text !== p.text) return `The wording of “${p.name}” is set by the template.`;
      if (p.kind === "image" && n.kind === "image" && !same(n.source, p.source)) return `The image in “${p.name}” is set by the template.`;
      if (n.visible !== p.visible) return `“${p.name}” can't be hidden.`;
    }
    if (!p.perms.style) {
      const keys = p.kind === "text" ? STYLE_KEYS_TEXT : STYLE_KEYS_IMAGE;
      if (keys.some((k) => !same((n as Record<string, unknown>)[k], (p as Record<string, unknown>)[k]))) return `The style of “${p.name}” is set by the template.`;
    }
  }
  // New layers a DJ adds are always fully theirs.
  for (const n of next.nodes) if (!prev.nodes.some((p) => p.id === n.id) && !same(n.perms, FULL_PERMS)) return "New layers can't carry template permissions.";
  return null;
}
