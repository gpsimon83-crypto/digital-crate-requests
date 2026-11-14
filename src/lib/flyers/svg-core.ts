/**
 * Pure helpers for importing layered SVG flyers (Illustrator, Figma, Canva,
 * Inkscape exports). The browser side (svg-import.ts) walks the file; these
 * decide positions, styles, layer types and placeholders, and are unit-tested.
 */
import { FORMATS, type FormatKey, type Role } from "./types";

/* ---------- transforms: [a, b, c, d, e, f] like SVG matrix() ---------- */
export type Mat = [number, number, number, number, number, number];
export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

export function multiply(m: Mat, n: Mat): Mat {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}

export function parseTransform(t: string | null | undefined): Mat {
  let m: Mat = IDENTITY;
  if (!t) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  for (const [, fn, argStr] of t.matchAll(re)) {
    const a = argStr
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
      .map((v) => (Number.isFinite(v) ? v : 0));
    let n: Mat = IDENTITY;
    if (fn === "matrix" && a.length >= 6) n = [a[0], a[1], a[2], a[3], a[4], a[5]];
    else if (fn === "translate") n = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0];
    else if (fn === "scale") n = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0];
    else if (fn === "rotate") {
      const r = ((a[0] ?? 0) * Math.PI) / 180;
      const rot: Mat = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
      n = a.length >= 3 ? multiply(multiply([1, 0, 0, 1, a[1], a[2]], rot), [1, 0, 0, 1, -a[1], -a[2]]) : rot;
    } else if (fn === "skewX") n = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
    else if (fn === "skewY") n = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
    m = multiply(m, n);
  }
  return m;
}

export const apply = (m: Mat, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
export const scaleX = (m: Mat) => Math.hypot(m[0], m[1]);
export const scaleY = (m: Mat) => Math.hypot(m[2], m[3]);
export const rotationOf = (m: Mat) => Math.round(((Math.atan2(m[1], m[0]) * 180) / Math.PI) * 100) / 100;

/* ---------- CSS from <style> (class rules, as Illustrator writes them) ---------- */
export function parseClassRules(css: string): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, sel, body] of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = parseDecls(body);
    for (const s of sel.split(",")) {
      const m = s.trim().match(/^\.([\w-]+)$/);
      if (!m) continue;
      out.set(m[1], { ...(out.get(m[1]) ?? {}), ...decls });
    }
  }
  return out;
}

export function parseDecls(body: string): Record<string, string> {
  const d: Record<string, string> = {};
  for (const part of body.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part.slice(i + 1).trim();
    if (k && v) d[k] = v;
  }
  return d;
}

/* ---------- values ---------- */
export function toHex(c: string | undefined | null, fallback = "#000000"): string {
  if (!c) return fallback;
  const v = c.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  const rgb = v.match(/^rgba?\(\s*([\d.]+)%?[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?/);
  if (rgb) return `#${[rgb[1], rgb[2], rgb[3]].map((x) => Math.max(0, Math.min(255, Math.round(+x))).toString(16).padStart(2, "0")).join("")}`;
  const named: Record<string, string> = { white: "#ffffff", black: "#000000", red: "#ff0000", gold: "#ffd700", yellow: "#ffff00", blue: "#0000ff", green: "#008000", orange: "#ffa500", purple: "#800080", gray: "#808080", grey: "#808080" };
  return named[v] ?? fallback;
}

/** A length in px (handles "43.68px", "43.68", ".02em" relative to a font size). */
export function px(v: string | undefined | null, fontSize = 16): number | null {
  if (!v) return null;
  const m = v.trim().match(/^(-?[\d.]+)(px|em|pt)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === "em" ? n * fontSize : m[2] === "pt" ? (n * 4) / 3 : n;
}

export function weightOf(v: string | undefined | null): number {
  if (!v) return 400;
  if (v === "bold" || v === "bolder") return 700;
  if (v === "normal" || v === "lighter") return 400;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 400;
}

/* ---------- size ---------- */
/** Which flyer size the artwork is made for (by aspect ratio), and how far off it is. */
export function pickFormat(width: number, height: number): { format: FormatKey; off: number } {
  const r = height / width;
  let best: FormatKey = "square";
  for (const k of Object.keys(FORMATS) as FormatKey[]) {
    const kr = FORMATS[k].height / FORMATS[k].width;
    if (Math.abs(kr - r) < Math.abs(FORMATS[best].height / FORMATS[best].width - r)) best = k;
  }
  const br = FORMATS[best].height / FORMATS[best].width;
  return { format: best, off: Math.abs(br - r) / br };
}

/* ---------- naming, layer types and placeholders ---------- */
export function humanize(id: string): string {
  const s = id
    .replace(/^_+|_+$/g, "")
    .replace(/(\d+)$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : "";
}

const MONTH = /^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\.?$/i;
const WEEKDAY = /^(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day|nesday|rsday|urday|sday)?\.?$/i;
const TIME = /^\d{1,2}(:\d{2})?\s*(am|pm)$/i;
const DAYNUM = /^\d{1,2}(st|nd|rd|th)?$/i;

/** What a layer is, from its name in the file and its words. */
export function guessTextRole(name: string, text: string): Role {
  const n = name.toLowerCase().replace(/[\s_-]+/g, " ");
  const t = text.trim();
  if (/\bdj\b|artist|performer|headliner/.test(n)) return "dj_name";
  if (/address|street|location/.test(n)) return "address";
  if (/venue/.test(n)) return "venue";
  if (/time|start|doors/.test(n) || TIME.test(t)) return "time";
  if (/date|day|month/.test(n) || MONTH.test(t) || WEEKDAY.test(t)) return "date";
  if (/title|headline|event name|event/.test(n)) return "title";
  if (/detail|footer|info|note|special|ticket|age/.test(n)) return "details";
  return "text";
}

export function guessImageRole(name: string, coversCanvas: boolean): Role {
  const n = name.toLowerCase();
  if (/background|\bbg\b|backdrop/.test(n) || coversCanvas) return "background";
  if (/logo/.test(n)) return "logo";
  if (/dj|photo|portrait|headshot|artist|person/.test(n)) return "portrait";
  return "overlay";
}

/**
 * Turns a text layer into a placeholder when it's clearly a booking field,
 * keeping the file's own words as the fallback ({{venue_name|YOUR VENUE}}),
 * so the template still looks the same in preview.
 */
export function suggestPlaceholder(role: Role, text: string): string {
  const t = text.trim();
  const fb = (k: string) => `{{${k}|${t.replace(/[{}|]/g, "")}}}`;
  if (!t || t.includes("\n")) return text;
  if (role === "dj_name") return "{{dj_name}}";
  if (MONTH.test(t)) return fb("event_month");
  if (WEEKDAY.test(t)) return fb("event_weekday");
  if (role === "date" && DAYNUM.test(t)) return fb("event_day");
  if (TIME.test(t)) return fb("start_time");
  if (role === "venue") return fb("venue_name");
  if (role === "address") return fb("venue_address");
  if (role === "title") return fb("event_title");
  return text;
}

/** True when text is written in capitals (so filled-in values keep that look). */
export const isAllCaps = (t: string) => /[A-Z]/.test(t) && t === t.toUpperCase();
