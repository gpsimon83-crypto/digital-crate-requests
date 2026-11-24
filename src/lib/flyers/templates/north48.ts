import { LOCKED_PERMS, newImage, newText } from "../scene";
import type { FlyerNode, FormatKey, Role, Scene, TemplateContent } from "../types";
import { FORMATS } from "../types";
import { arcBoxFor } from "../arc";

/**
 * "North 48 – Blackout" (story 1080×1920), from the designer's layout.json.
 * The textured background (no text, no person) is one picture; every word
 * is its own editable text layer. NORTH 48 is live venue text on the
 * supplied arch (curved text), the title lines and DJ name keep their −3°
 * turn and the month its −90°. Linked to the venue, the DJs, the date, the
 * time and the drink specials; the sample wording after "|" shows until
 * the flyer has a booking.
 *
 * Like the SVG (textLength, spacingAndGlyphs), each line is stretched to its
 * preset width, with leftover room as letter spacing, and shrinks on one
 * line if real details run longer.
 */
export const NORTH48_SLUG = "north-48-blackout";

type Spec = {
  id: string;
  role: Role;
  name: string;
  text: string;
  font: "anton" | "barlow";
  size: number;
  /** Centre x and alphabetic baseline y, as in layout.json. */
  x: number;
  y: number;
  width: number;
  fill: string;
  rotation?: number;
  stroke?: boolean;
  /** Natural width of the sample at its size (measured with the bundled fonts). */
  natural: number;
  hideIfEmpty?: boolean;
};

const FONT = {
  anton: { key: "anton", weight: 400, italic: false, baseline: 0.925 },
  barlow: { key: "barlow-condensed", weight: 700, italic: true, baseline: 0.9 }
} as const;
const CREAM = "#f3e8cf";
const ORANGE = "#ff6a00";
const INK = "#141413";
const MAX_STRETCH = 2.7;

const LINES: Spec[] = [
  { id: "weekday", role: "date", name: "Weekday (WED)", text: "{{event.weekdayShort|WED}}", font: "anton", size: 53, x: 190, y: 435, width: 190, fill: CREAM, natural: 85.7 },
  { id: "month", role: "date", name: "Month (NOV)", text: "{{event.monthShort|NOV}}", font: "anton", size: 52, x: 92, y: 590, width: 145, fill: ORANGE, rotation: -90, natural: 75.6 },
  { id: "day", role: "date", name: "Day (25)", text: "{{event.dayNumber|25}}", font: "anton", size: 210, x: 245, y: 625, width: 235, fill: CREAM, natural: 207.5 },
  { id: "time", role: "time", name: "Time", text: "{{event.timeRange|9 PM–CLOSE}}", font: "barlow", size: 44, x: 214, y: 690, width: 300, fill: CREAM, natural: 182 },
  { id: "event-line-1", role: "title", name: "Title line 1 (BLACKOUT)", text: "BLACKOUT", font: "anton", size: 174, x: 540, y: 1010, width: 900, fill: CREAM, rotation: -3, stroke: true, natural: 637.4 },
  { id: "event-line-2", role: "title", name: "Title line 2 (WEDNESDAY)", text: "WEDNESDAY", font: "anton", size: 132, x: 540, y: 1160, width: 900, fill: CREAM, rotation: -3, stroke: true, natural: 579.4 },
  { id: "dj-name", role: "dj_name", name: "DJ name", text: "{{dj.lineup|DJ NAME}}", font: "anton", size: 140, x: 540, y: 1465, width: 860, fill: CREAM, rotation: -3, stroke: true, natural: 466.9 },
  { id: "tagline", role: "details", name: "Tagline", text: "THE NIGHT BEFORE THANKSGIVING", font: "barlow", size: 35, x: 540, y: 1650, width: 820, fill: CREAM, natural: 411 },
  { id: "specials", role: "specials", name: "Drink specials", text: "{{event.drinkSpecials}}", font: "barlow", size: 44, x: 540, y: 1730, width: 550, fill: ORANGE, natural: 246.3, hideIfEmpty: true },
  { id: "address", role: "address", name: "Address", text: "{{venue.street|VENUE ADDRESS}} • {{venue.cityLine|CITY}}", font: "barlow", size: 30, x: 540, y: 1830, width: 780, fill: CREAM, natural: 236.4 }
];

function sampleOf(t: string) {
  return t.replace(/\{\{[^}|]+\|([^}]*)\}\}/g, "$1");
}

function line(l: Spec, s: Pick<Scene, "width" | "height">): FlyerNode {
  const f = FONT[l.font];
  const ratio = l.width / l.natural;
  const stretch = Math.round(Math.min(MAX_STRETCH, Math.max(0.5, ratio)) * 1000) / 1000;
  const chars = [...sampleOf(l.text)].length;
  const leftover = l.width - l.natural * stretch;
  const trackingEm = leftover > 1 && chars > 1 ? Math.round((leftover / chars / stretch / l.size) * 1000) / 1000 : null;
  const rotation = l.rotation ?? 0;
  let x = l.x - l.width / 2;
  let y = l.y - f.baseline * l.size;
  if (rotation) {
    // The layout turns around the baseline centre; the editor turns around the box centre: shift to match.
    const v = l.size * (f.baseline - 0.5);
    const t = (rotation * Math.PI) / 180;
    x += v * Math.sin(t);
    y += v * (1 - Math.cos(t));
  }
  return newText(l.role, s, {
    name: l.name,
    text: l.text,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    width: l.width,
    height: l.size,
    font: f.key,
    weight: f.weight,
    italic: f.italic,
    fontSize: l.size,
    minFontSize: Math.max(8, Math.round(l.size * 0.55)),
    lineHeight: 1,
    letterSpacing: 0,
    trackingEm,
    stretch: Math.abs(stretch - 1) > 0.001 ? stretch : undefined,
    align: "center",
    uppercase: true,
    shrink: true,
    fill: l.fill,
    stroke: { enabled: !!l.stroke, color: INK, width: 10 },
    rotation,
    pivot: "center",
    ...(l.hideIfEmpty ? { hideIfEmpty: true } : {})
  });
}

/** NORTH 48 on the arch: path M 65,300 Q 540,55 1015,300 (middle of the baseline 122.5 px above its ends). */
function venueArch(s: Pick<Scene, "width" | "height">): FlyerNode {
  const size = 190;
  const arc = 122.5;
  const b = arcBoxFor(65, 1015, 300, size, arc);
  // The letters are widened along the arch (SVG textLength), matched to the designer's
  // preview: NORTH 48 spans about x 170–905, centred under the top of the arch.
  const stretch = 1.2;
  return newText("venue", s, {
    name: "Venue name (on the arch)",
    text: "{{venue.name|NORTH 48}}",
    ...b,
    font: FONT.anton.key,
    weight: 400,
    italic: false,
    fontSize: size,
    minFontSize: 90,
    lineHeight: 1,
    letterSpacing: 0,
    stretch,
    align: "center",
    uppercase: true,
    shrink: true,
    fill: CREAM,
    rotation: 0,
    pivot: "center",
    arc
  });
}

function story(): Scene {
  const { width, height } = FORMATS.story;
  const s = { width, height };
  const nodes: FlyerNode[] = [
    newImage("background", { type: "static", src: "/flyers/north48/background.jpg" }, s, {
      name: "Background (textured, no text)",
      x: 0,
      y: 0,
      width,
      height,
      fit: "cover",
      locked: true,
      perms: { ...LOCKED_PERMS }
    }),
    venueArch(s),
    ...LINES.map((l) => line(l, s))
  ];
  return { version: 1, format: "story", width, height, background: "#141413", safeMargin: 40, nodes };
}

export function north48TemplateContent(): TemplateContent {
  return { formats: { story: story() } as Partial<Record<FormatKey, Scene>> };
}
