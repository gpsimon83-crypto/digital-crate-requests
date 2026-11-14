import { FORMATS, type FormatKey, type Scene, type TemplateContent } from "./types";
import { LOCKED_PERMS, newImage, newText } from "./scene";

/**
 * The built-in sample template ("Club Night"). Every piece is separate:
 * a text-free background per size, a glow overlay, a sparkle overlay, the
 * DJ's own portrait, the venue logo, and live text with placeholders.
 * Each size is laid out on its own (nothing is stretched between sizes).
 */
export const SAMPLE_TEMPLATE_SLUG = "sample-club-night";

type Layout = { title: number; photoY: number; photoW: number; photoH: number; name: number; nameSize: number; date: number; time: number; venue: number; address: number; details: number };

const LAYOUT: Record<FormatKey, Layout> = {
  square: { title: 58, photoY: 168, photoW: 470, photoH: 500, name: 656, nameSize: 150, date: 818, time: 868, venue: 920, address: 962, details: 1006 },
  portrait: { title: 70, photoY: 200, photoW: 560, photoH: 610, name: 812, nameSize: 168, date: 1000, time: 1054, venue: 1116, address: 1162, details: 1240 },
  story: { title: 210, photoY: 390, photoW: 700, photoH: 780, name: 1170, nameSize: 190, date: 1392, time: 1452, venue: 1528, address: 1580, details: 1690 }
};

function layout(format: FormatKey): Scene {
  const { width, height } = FORMATS[format];
  const L = LAYOUT[format];
  const s = { width, height };
  const margin = format === "story" ? 90 : 60;
  const cx = (w: number) => Math.round((width - w) / 2);
  const textW = width - margin * 2;

  const nodes = [
    newImage("background", { type: "static", src: `/flyers/sample/club-night-${format}.jpg` }, s, { name: "Background (club lights)", locked: true, perms: { ...LOCKED_PERMS } }),
    newImage("overlay", { type: "static", src: "/flyers/sample/gold-halo.png" }, s, {
      name: "Gold halo",
      x: cx(L.photoW + 220),
      y: L.photoY + L.photoH / 2 - (L.photoW + 220) / 2,
      width: L.photoW + 220,
      height: L.photoW + 220,
      opacity: 0.9,
      fit: "contain"
    }),
    newImage("portrait", { type: "dj_photo" }, s, {
      name: "DJ portrait",
      x: cx(L.photoW),
      y: L.photoY,
      width: L.photoW,
      height: L.photoH,
      frame: { enabled: true, color: "#e5b647", width: 6, radius: 28 },
      shadow: { enabled: true, color: "#000000", blur: 40, offsetX: 0, offsetY: 18, opacity: 0.55 }
    }),
    newImage("overlay", { type: "static", src: "/flyers/sample/sparks.png" }, s, { name: "Sparkles", x: 0, y: L.photoY - 80, width, height: Math.round(width * 0.55), opacity: 0.85, fit: "cover" }),
    newImage("logo", { type: "venue_logo" }, s, { name: "Venue logo", x: margin, y: margin - 20, width: format === "story" ? 220 : 170, height: format === "story" ? 130 : 100, fit: "contain" }),
    newText("title", s, {
      name: "Event title",
      text: "{{event_title|Saturday Night Live}}",
      x: margin + (format === "story" ? 0 : 150),
      y: L.title,
      width: textW - (format === "story" ? 0 : 300),
      height: format === "story" ? 150 : 100,
      font: "anton",
      weight: 400,
      fontSize: format === "story" ? 112 : 84,
      uppercase: true,
      letterSpacing: 2,
      fill: "#ffd27a",
      shadow: { enabled: true, color: "#ff9d2e", blur: 28, offsetX: 0, offsetY: 0, opacity: 0.7 }
    }),
    newText("dj_name", s, {
      name: "DJ name",
      text: "{{dj_name}}",
      x: margin,
      y: L.name,
      width: textW,
      height: L.nameSize * 1.05,
      font: "bebas",
      weight: 400,
      fontSize: L.nameSize,
      letterSpacing: 6,
      uppercase: true,
      fill: "#ffffff",
      stroke: { enabled: true, color: "#1a0f2e", width: 3 },
      shadow: { enabled: true, color: "#7c4dff", blur: 30, offsetX: 0, offsetY: 0, opacity: 0.85 }
    }),
    newText("date", s, { name: "Date", text: "{{event_date}}", x: margin, y: L.date, width: textW, height: 52, font: "montserrat", weight: 800, fontSize: format === "story" ? 50 : 40, uppercase: true, letterSpacing: 4, fill: "#e5b647" }),
    newText("time", s, { name: "Time", text: "{{start_time}} – {{end_time|Close}}", x: margin, y: L.time, width: textW, height: 46, font: "montserrat", weight: 600, fontSize: format === "story" ? 42 : 34, letterSpacing: 2, fill: "#ffffff" }),
    newText("venue", s, { name: "Venue", text: "{{venue_name}}", x: margin, y: L.venue, width: textW, height: 44, font: "montserrat", weight: 800, fontSize: format === "story" ? 40 : 32, uppercase: true, letterSpacing: 3, fill: "#ffffff" }),
    newText("address", s, { name: "Address", text: "{{venue_address}}", x: margin, y: L.address, width: textW, height: 40, font: "montserrat", weight: 400, fontSize: format === "story" ? 32 : 26, fill: "#d8cdbb" }),
    newText("details", s, {
      name: "Supporting text",
      text: "Drink specials all night · 21+",
      x: margin,
      y: L.details,
      width: textW,
      height: 44,
      font: "montserrat",
      weight: 600,
      fontSize: format === "story" ? 36 : 28,
      letterSpacing: 1,
      fill: "#ffd27a"
    })
  ];
  return { version: 1, format, width, height, background: "#0b0910", safeMargin: margin, nodes };
}

export function sampleTemplateContent(): TemplateContent {
  return { formats: { square: layout("square"), portrait: layout("portrait"), story: layout("story") } };
}
