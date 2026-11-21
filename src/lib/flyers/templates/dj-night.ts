import { LOCKED_PERMS, newImage, newShape, newText } from "../scene";
import type { FlyerNode, FormatKey, Role, Scene, TemplateContent } from "../types";
import { FORMATS } from "../types";
import layouts from "./dj-night-layouts.json";

/**
 * "DJ Night Party" template (portrait 1080×1350 and story 1080×1920), built
 * from the designer's layer presets (dj-night-layouts.json). Every text is
 * its own editable layer, every rectangle an editable shape, and the concert
 * photo a replaceable picture with a vertical fade. Nothing is flattened.
 *
 * The presets give text as a centre x and an alphabetic baseline, stretched
 * to a fixed width (SVG textLength). Here each text gets a box of that
 * width, its top placed from the font's measured baseline, and the same
 * horizontal stretch (with extra letter spacing for the widest small copy),
 * shrinking on one line if real event details run longer.
 */
export const DJ_NIGHT_SLUG = "dj-night-party";

type Layer = {
  id: string;
  type: "rect" | "image" | "text";
  x: number;
  y: number;
  width: number;
  height?: number;
  fill?: string;
  stroke?: string | null;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  rotation?: number;
};

const FONTS: Record<string, { key: string; weight: number; italic: boolean; baseline: number }> = {
  // baseline = alphabetic baseline below the text box top, as a share of the font size (measured in the editor, line height 1)
  Anton: { key: "anton", weight: 400, italic: false, baseline: 0.925 },
  "Barlow Condensed": { key: "barlow-condensed", weight: 700, italic: true, baseline: 0.9 },
  "Great Vibes": { key: "great-vibes", weight: 400, italic: false, baseline: 0.73 }
};
/** Each sample's natural width at its preset size (no stretch), measured with the bundled fonts. */
const NATURAL: Record<string, number> = {
  "top-left": 90.2,
  presenter: 185.3,
  "top-right": 114.3,
  title: 824.5,
  script: 369.4,
  date: 191.9,
  year: 103.7,
  "start-label": 125.5,
  time: 139.1,
  "lineup-label": 201.5,
  "lineup-1": 312.7,
  "lineup-2": 280.5,
  venue: 377.1,
  address: 119.3,
  city: 115.6,
  contact: 198.2
};
const MAX_STRETCH = 2.7;

/** Linked fields (sample wording after "|" shows until the flyer has an event). */
const TEXT: Record<string, { role: Role; name: string; text: string }> = {
  "top-left": { role: "details", name: "Top left tag", text: "SPECIAL PARTY" },
  presenter: { role: "venue", name: "Venue presents", text: "{{venue.name|YOUR VENUE}} PRESENTS" },
  "top-right": { role: "details", name: "Top right tag", text: "ONE SPECIAL NIGHT" },
  title: { role: "title", name: "Title (DJ NIGHT)", text: "DJ NIGHT" },
  script: { role: "text", name: "Script (Party)", text: "Party" },
  date: { role: "date", name: "Date (day month)", text: "{{event.dayNumber|DAY}} {{event.monthShort|MON}}" },
  year: { role: "date", name: "Year", text: "{{event.year|YEAR}}" },
  "start-label": { role: "time", name: "Start label", text: "START" },
  time: { role: "time", name: "Start time", text: "{{event.startTime|00 PM}}" },
  "lineup-label": { role: "text", name: "Lineup label", text: "SPECIAL PERFORMANCE BY" },
  "lineup-1": { role: "dj_name", name: "DJ lineup", text: "{{dj.lineup|DJ NAME • DJ NAME • DJ NAME}}" },
  "lineup-2": { role: "text", name: "Guests line", text: "GUEST NAME • GUEST NAME" },
  venue: { role: "venue", name: "Venue name", text: "{{venue.name|YOUR PLACE HERE}}" },
  address: { role: "address", name: "Street address", text: "{{venue.street|STREET ADDRESS}}" },
  city: { role: "address", name: "City, state, ZIP", text: "{{venue.cityLine|CITY, STATE • ZIP}}" },
  contact: { role: "details", name: "Contact line", text: "CONTACT • WEBSITE • PHONE" }
};
const RECT_NAMES: Record<string, string> = { background: "Background", border: "Border", "lineup-panel": "Lineup panel", "lineup-label-box": "Lineup label box", "venue-panel": "Venue panel" };

function textNode(l: Layer, s: Pick<Scene, "width" | "height">): FlyerNode {
  const f = FONTS[l.fontFamily ?? "Anton"];
  const fs = l.fontSize ?? 40;
  const meta = TEXT[l.id] ?? { role: "text" as Role, name: l.id, text: l.text ?? "" };
  const ratio = l.width / (NATURAL[l.id] ?? l.width);
  const stretch = Math.round(Math.min(MAX_STRETCH, Math.max(0.5, ratio)) * 1000) / 1000;
  // What stretch can't cover (the widest small copy) becomes letter spacing, in em so it follows auto-fit.
  const chars = [...(l.text ?? "")].length;
  const leftover = l.width - (NATURAL[l.id] ?? l.width) * stretch;
  const trackingEm = leftover > 1 && chars > 1 ? Math.round((leftover / chars / stretch / fs) * 1000) / 1000 : null;
  const rotation = l.rotation ?? 0;
  let x = l.x - l.width / 2;
  let y = l.y - f.baseline * fs;
  if (rotation) {
    // The preset turns around the baseline centre; the editor turns around the box centre: shift to match.
    const v = fs * (f.baseline - 0.5);
    const t = (rotation * Math.PI) / 180;
    x += v * Math.sin(t);
    y += v * (1 - Math.cos(t));
  }
  return newText(meta.role, s, {
    name: meta.name,
    text: meta.text,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    width: l.width,
    height: fs,
    font: f.key,
    weight: f.weight,
    italic: f.italic,
    fontSize: fs,
    minFontSize: Math.max(8, Math.round(fs * 0.55)),
    lineHeight: 1,
    letterSpacing: 0,
    trackingEm,
    stretch: Math.abs(stretch - 1) > 0.001 ? stretch : undefined,
    align: "center",
    uppercase: l.id !== "script",
    shrink: true,
    fill: l.fill ?? "#ffffff",
    rotation,
    pivot: "center"
  });
}

function layout(format: "portrait" | "story"): Scene {
  const L = (layouts as unknown as Record<string, { canvas: { width: number; height: number }; layers: Layer[]; mask: { stops: [number, number][] } }>)[format];
  const { width, height } = FORMATS[format];
  const s = { width, height };
  const stops = L.mask.stops;
  const nodes: FlyerNode[] = L.layers.map((l): FlyerNode => {
    if (l.type === "text") return textNode(l, s);
    if (l.type === "image") {
      const h = l.height ?? 0;
      // The preset's vertical alpha fade (0 → 1 by 22%, solid to 75%, → 0 at the bottom) as soft top and bottom edges.
      const top = Math.round((stops[1]?.[0] ?? 0.22) * h);
      const bottom = Math.round((1 - (stops[2]?.[0] ?? 0.75)) * h);
      return newImage("image", { type: "static", src: "/flyers/dj-night/concert-photo.jpg" }, s, {
        name: "Concert photo (replace with yours)",
        x: l.x,
        y: l.y,
        width: l.width,
        height: h,
        fit: "cover",
        feather: { amount: Math.max(top, bottom), shape: "edges", sides: { top, right: 0, bottom, left: 0 }, curve: "linear" }
      });
    }
    const outline = !l.fill || l.fill === "none";
    const isBg = l.id === "background";
    return newShape("rectangle", s, {
      name: RECT_NAMES[l.id] ?? "Rectangle",
      x: l.x,
      y: l.y,
      width: l.width,
      height: l.height ?? 0,
      fillEnabled: !outline,
      fill: outline ? "#000000" : (l.fill as string),
      stroke: { enabled: !!l.stroke, color: l.stroke ?? "#000000", width: 2 },
      radius: 0,
      keepRatio: false,
      ...(isBg ? { locked: true, perms: { ...LOCKED_PERMS, style: true } } : {})
    });
  });
  return { version: 1, format, width, height, background: "#10271e", safeMargin: 40, nodes };
}

export function djNightTemplateContent(): TemplateContent {
  return { formats: { portrait: layout("portrait"), story: layout("story") } as Partial<Record<FormatKey, Scene>> };
}
