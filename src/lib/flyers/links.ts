/**
 * Linked content: how a flyer's layers follow its event.
 *
 * A template layer can be linked to event data: text through placeholders
 * ({{event.startTime}}), pictures through slots (DJ photo / DJ name logo for
 * DJ slot N, venue logo). On a flyer, linked layers are refilled whenever the
 * event, venue or DJs change, until someone overrides that layer for this
 * flyer. Overrides never write anything back to the event or DJ profile.
 */
import { canonicalKey, fillText, TOKEN_RE, tokenLabel } from "./scene";
import type { FlyerNode, ImageNode, ImageSource, PlaceholderValues, Scene, TextNode } from "./types";

export type LinkContext = {
  values: PlaceholderValues;
  /** DJ id for slot 1, 2, … (slot 1 = lead DJ). */
  slots: (string | null)[];
  venueId: string | null;
  /** With an event, empty fields stay empty (and get flagged); without one, they show a readable label. */
  hasEvent: boolean;
};

const hasTokens = (t: string) => new RegExp(TOKEN_RE.source).test(t);
const isLinkedSource = (s: ImageSource | null | undefined) => !!s && (s.type === "dj_photo" || s.type === "dj_logo" || s.type === "venue_logo");

/** Marks a template's placeholder text and slot pictures as linked (starting a flyer). */
export function linkScene(scene: Scene): Scene {
  return {
    ...scene,
    nodes: scene.nodes.map((n): FlyerNode => {
      if (n.kind === "text") return n.source == null && hasTokens(n.text) ? { ...n, source: n.text, override: false } : n;
      if (isLinkedSource(n.source) && !n.linked) return { ...n, linked: n.source, override: false };
      return n;
    })
  };
}

export const isLinked = (n: FlyerNode) => (n.kind === "text" ? n.source != null : !!n.linked);
export const isOverridden = (n: FlyerNode) => isLinked(n) && !!n.override;

/** Fills one linked text from the values. */
export function linkedText(source: string, ctx: LinkContext): string {
  const filled = fillText(source, ctx.values);
  // Placeholders with nothing to fill: a readable label without an event, empty with one.
  return filled.replace(new RegExp(TOKEN_RE.source, "g"), (_m, token: string) => (ctx.hasEvent ? "" : tokenLabel(token))).replace(/[ \t]+$/gm, "");
}

function linkedImage(src: ImageSource, ctx: LinkContext): ImageSource {
  if (src.type === "dj_photo" || src.type === "dj_logo") {
    const slot = Math.max(1, src.slot ?? 1);
    return { type: src.type, slot, djId: ctx.slots[slot - 1] ?? null };
  }
  if (src.type === "venue_logo") return { type: "venue_logo", venueId: ctx.venueId ?? null };
  return src;
}

/** Refills every linked, not-overridden layer from the event data. Layout is never touched. */
export function resolveScene(scene: Scene, ctx: LinkContext): Scene {
  return {
    ...scene,
    nodes: scene.nodes.map((n): FlyerNode => {
      if (n.kind === "text") {
        if (n.source == null || n.override) return n;
        return { ...n, text: linkedText(n.source, ctx) };
      }
      if (!n.linked || n.override) return n;
      return { ...n, source: linkedImage(n.linked, ctx) };
    })
  };
}

/** "Reset to event data": drop this flyer's override and refill from the event. */
export function resetNode(n: FlyerNode, ctx: LinkContext): FlyerNode {
  if (n.kind === "text") return n.source == null ? n : { ...n, override: false, text: linkedText(n.source, ctx) };
  if (!n.linked) return n;
  return { ...n, override: false, source: linkedImage(n.linked, ctx), crop: { zoom: 1, x: 0, y: 0 } };
}

/** Value key a layer depends on (for "only show when…" and required checks). */
export function keysIn(n: FlyerNode): string[] {
  if (n.kind === "text") return n.source ? [...n.source.matchAll(new RegExp(TOKEN_RE.source, "g"))].map((m) => canonicalKey(m[1])) : [];
  return [];
}

/** Is the layer shown, after "only show when" and "hide when empty"? */
export function shownByData(n: FlyerNode, values: PlaceholderValues | undefined): boolean {
  if (!n.visible) return false;
  const when = n.link?.showWhen;
  if (when && values && !(values[canonicalKey(when)] ?? "").toString().trim()) return false;
  if (n.kind === "text" && n.hideIfEmpty && !n.text.trim()) return false;
  return true;
}

/**
 * Applying a (newly activated) template to an existing draft: the new
 * layout, with this flyer's overrides carried over to the matching layers
 * (same placeholder wording, or same picture slot, or same layer type).
 */
export function applyTemplateKeepingOverrides(oldScene: Scene, template: Scene, ctx: LinkContext): Scene {
  const next = resolveScene(linkScene(template), ctx);
  const overridden = oldScene.nodes.filter(isOverridden);
  const used = new Set<string>();
  const nodes = next.nodes.map((n): FlyerNode => {
    const match = overridden.find((o) => {
      if (used.has(o.id) || o.kind !== n.kind) return false;
      if (n.kind === "text" && o.kind === "text") return o.source === n.source || o.role === n.role;
      if (n.kind === "image" && o.kind === "image") return JSON.stringify(o.linked) === JSON.stringify(n.linked) || (o.role === n.role && n.role !== "background");
      return false;
    });
    if (!match) return n;
    used.add(match.id);
    if (n.kind === "text" && match.kind === "text") return { ...n, text: match.text, override: true };
    if (n.kind === "image" && match.kind === "image") return { ...n, source: match.source, crop: match.crop, override: true };
    return n;
  });
  return { ...next, nodes };
}

/* ---------- checks before export ---------- */

export type Issue = { nodeId: string | null; level: "error" | "warning"; message: string };

/**
 * What to fix before exporting: required content that's empty, DJ photos
 * that are missing. (Text that doesn't fit is measured in the browser and
 * added by the editor.)
 */
export function preflight(scene: Scene, ctx: LinkContext & { djs: { id: string; display_name: string; has_photo: boolean }[] }): Issue[] {
  const issues: Issue[] = [];
  for (const n of scene.nodes) {
    if (!shownByData(n, ctx.values)) continue;
    if (n.kind === "image" && n.source.type === "dj_photo") {
      const slot = n.source.slot ?? 1;
      const djId = n.source.djId;
      const dj = ctx.djs.find((d) => d.id === djId);
      if (!djId) issues.push({ nodeId: n.id, level: "error", message: `“${n.name}”: no DJ is assigned to DJ slot ${slot}.` });
      else if (!dj?.has_photo) issues.push({ nodeId: n.id, level: "error", message: `“${n.name}”: ${dj?.display_name ?? "this DJ"} has no approved cutout or profile photo.` });
    }
    if (n.kind === "image" && n.source.type === "dj_logo" && !n.source.djId) issues.push({ nodeId: n.id, level: "error", message: `“${n.name}”: no DJ is assigned to DJ slot ${n.source.slot ?? 1}.` });
    if (n.kind === "image" && n.source.type === "venue_logo" && !n.source.venueId && n.link?.required) issues.push({ nodeId: n.id, level: "error", message: `“${n.name}”: no venue is linked.` });
    if (n.link?.required && n.kind === "text" && !n.text.trim()) issues.push({ nodeId: n.id, level: "error", message: `“${n.name}” is required but empty${n.source ? " (no event data for it)" : ""}.` });
    if (n.kind === "text" && n.source && !n.override && ctx.hasEvent) {
      // Fields with no event data and no fallback wording after a bar.
      const missing = [...n.source.matchAll(new RegExp(TOKEN_RE.source, "g"))].filter((m) => m[2] === undefined && !(ctx.values[canonicalKey(m[1])] ?? "").toString().trim()).map((m) => canonicalKey(m[1]));
      if (missing.length && !n.hideIfEmpty && !n.link?.required) issues.push({ nodeId: n.id, level: "warning", message: `“${n.name}”: the event has no ${missing.map((k) => tokenLabel(k).toLowerCase() || k).join(", ")}.` });
    }
  }
  return issues;
}

export type { ImageNode, TextNode };
