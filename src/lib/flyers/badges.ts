/**
 * Date badges: a group made of one artwork layer (a normal image layer you
 * can replace, crop, zoom and fade) and live text layers for the weekday,
 * month / day and time, linked to the event. Nothing here is a new kind of
 * layer: a badge is ordinary layers sharing a group, so moving, resizing,
 * rotating, duplicating, locking, saving and exporting all work as they do
 * for every other layer.
 *
 * Boxes are percentages of the badge (the artwork's own proportions), as
 * the visible bounds of each text — for the rotated torn-paper month that's
 * the tall box it ends up in. Font sizes are percentages of badge height;
 * each text fits on one line inside its box and never shrinks below `min`.
 * Positions were calibrated by eye against the package's reference image.
 */
import { newImage, newText, uid } from "./scene";
import type { FlyerNode, ImageNode, Scene, TextNode } from "./types";

type BadgeText = {
  key: "weekday" | "date" | "month" | "day" | "time";
  name: string;
  token: string;
  /** Visible box: x, y, width, height in % of the badge. */
  box: [number, number, number, number];
  font: string;
  weight: number;
  italic?: boolean;
  /** Largest size and smallest auto-fit size, % of badge height. */
  size: number;
  min: number;
  lineHeight: number;
  trackingEm?: number;
  color: string;
  align?: "left" | "center" | "right";
  /** Clockwise degrees, around the box centre. */
  rotation?: number;
};

export type BadgePreset = {
  id: "ticket" | "luxury" | "paper" | "neon" | "editorial";
  name: string;
  src: string;
  /** Width ÷ height of the artwork. */
  aspect: number;
  /** Starting width as a share of the flyer's width. */
  start: number;
  texts: BadgeText[];
};

const INK = "#111111";

export const BADGES: BadgePreset[] = [
  {
    id: "ticket",
    name: "Orange Ticket",
    src: "/flyers/badges/ticket.webp",
    aspect: 1122 / 1402,
    start: 0.34,
    texts: [
      { key: "weekday", name: "Weekday", token: "{{event.weekdayShort}}", box: [43.6, 15, 12.8, 8.6], font: "anton", weight: 400, size: 9, min: 4, lineHeight: 1, color: INK },
      { key: "date", name: "Month and day", token: "{{event.monthDay}}", box: [10, 23.5, 80, 47], font: "bebas", weight: 400, size: 62, min: 18, lineHeight: 0.88, trackingEm: -0.01, color: INK },
      { key: "time", name: "Time", token: "{{event.timeRange}}", box: [10, 76.5, 80, 12.5], font: "anton", weight: 400, size: 11, min: 4, lineHeight: 1, color: INK }
    ]
  },
  {
    id: "luxury",
    name: "Luxury Gold",
    src: "/flyers/badges/luxury.webp",
    aspect: 2,
    start: 0.6,
    texts: [
      { key: "weekday", name: "Weekday", token: "{{event.weekdayShort}}", box: [6.5, 32, 19.5, 26], font: "cormorant", weight: 600, italic: true, size: 22, min: 8, lineHeight: 1, color: "#F6EAD3" },
      { key: "date", name: "Month and day", token: "{{event.monthDay}}", box: [29.5, 17.5, 63.5, 52], font: "cormorant", weight: 600, size: 70, min: 16, lineHeight: 0.8, trackingEm: -0.01, color: "#D8B468" },
      { key: "time", name: "Time", token: "{{event.timeRange}}", box: [23.5, 75.5, 53, 13], font: "cormorant", weight: 600, size: 12, min: 5, lineHeight: 1, trackingEm: 0.12, color: "#F6EAD3" }
    ]
  },
  {
    id: "paper",
    name: "Torn Paper",
    src: "/flyers/badges/paper.webp",
    aspect: 1122 / 1402,
    start: 0.34,
    texts: [
      { key: "weekday", name: "Weekday", token: "{{event.weekdayShort}}", box: [14, 9.5, 72, 14], font: "montserrat", weight: 900, size: 13, min: 5, lineHeight: 1, color: INK },
      // Reads bottom-to-top (N at the bottom): one word turned -90°, not stacked letters.
      { key: "month", name: "Month", token: "{{event.monthShort}}", box: [8.5, 26.5, 21, 49], font: "anton", weight: 400, size: 24, min: 6, lineHeight: 0.85, color: "#EB4E14", rotation: -90 },
      { key: "day", name: "Day", token: "{{event.dayNumber}}", box: [30, 25.5, 60, 49], font: "anton", weight: 400, size: 54, min: 14, lineHeight: 0.92, color: INK },
      { key: "time", name: "Time", token: "{{event.timeRange}}", box: [12, 77.5, 76, 12.5], font: "barlow-condensed", weight: 800, size: 12, min: 5, lineHeight: 1, color: INK }
    ]
  },
  {
    id: "neon",
    name: "Neon Panel",
    src: "/flyers/badges/neon.webp",
    aspect: 2,
    start: 0.6,
    texts: [
      { key: "weekday", name: "Weekday", token: "{{event.weekdayShort}}", box: [21, 17, 30, 14], font: "barlow-condensed", weight: 700, italic: true, size: 15, min: 6, lineHeight: 1, color: "#FFFFFF", align: "left" },
      { key: "date", name: "Month and day", token: "{{event.monthDay}}", box: [12.5, 30, 72, 40], font: "barlow-condensed", weight: 800, italic: true, size: 50, min: 14, lineHeight: 0.9, color: "#FFFFFF" },
      { key: "time", name: "Time", token: "{{event.timeRange}}", box: [27, 70, 44, 11.5], font: "barlow-condensed", weight: 700, italic: true, size: 12, min: 5, lineHeight: 1, color: "#FFFFFF" }
    ]
  },
  {
    id: "editorial",
    name: "Bold Editorial",
    src: "/flyers/badges/editorial.webp",
    aspect: 2,
    start: 0.6,
    texts: [
      { key: "weekday", name: "Weekday", token: "{{event.weekdayShort}}", box: [6, -4, 27, 15], font: "montserrat", weight: 800, size: 16, min: 5, lineHeight: 1, trackingEm: 0.12, color: "#FFFFFF" },
      { key: "month", name: "Month", token: "{{event.monthShort}}", box: [5.5, 12, 28, 45], font: "anton", weight: 400, size: 50, min: 8, lineHeight: 0.92, color: "#FF6400" },
      { key: "day", name: "Day", token: "{{event.dayNumber}}", box: [33, -12, 63, 86], font: "anton", weight: 400, size: 105, min: 20, lineHeight: 0.92, color: "#FFFFFF" },
      { key: "time", name: "Time", token: "{{event.timeRange}}", box: [8, 77, 84, 12], font: "montserrat", weight: 700, size: 10, min: 4, lineHeight: 1, trackingEm: 0.12, color: INK }
    ]
  }
];

export const badgeById = (id: string) => BADGES.find((b) => b.id === id);

/**
 * The layers of one badge, as a group, `width` px wide with its top-left at
 * (x, y) — by default centred on the flyer. Art first (below), then text.
 */
export function newBadge(id: BadgePreset["id"], scene: Pick<Scene, "width" | "height">, at?: { x?: number; y?: number; width?: number }): FlyerNode[] {
  const b = badgeById(id);
  if (!b) return [];
  const W = Math.round(at?.width ?? scene.width * b.start);
  const H = Math.round(W / b.aspect);
  const X = Math.round(at?.x ?? (scene.width - W) / 2);
  const Y = Math.round(at?.y ?? (scene.height - H) / 2);
  const groupId = uid();
  const art: ImageNode = newImage("overlay", { type: "static", src: b.src }, scene, {
    name: `${b.name} artwork`,
    x: X,
    y: Y,
    width: W,
    height: H,
    fit: "contain",
    groupId
  });
  const texts = b.texts.map((t): TextNode => {
    const [bx, by, bw, bh] = t.box;
    const vis = { x: X + (bx / 100) * W, y: Y + (by / 100) * H, w: (bw / 100) * W, h: (bh / 100) * H };
    // A quarter-turned text's box is the visible box on its side, around the same centre.
    const turned = Math.abs(((t.rotation ?? 0) % 180) + 180) % 180 === 90;
    const w = turned ? vis.h : vis.w;
    const h = turned ? vis.w : vis.h;
    const cx = vis.x + vis.w / 2;
    const cy = vis.y + vis.h / 2;
    return newText(t.key === "time" ? "time" : t.key === "weekday" || t.key === "month" || t.key === "day" || t.key === "date" ? "date" : "text", scene, {
      name: t.name,
      text: t.token,
      x: Math.round((cx - w / 2) * 10) / 10,
      y: Math.round((cy - h / 2) * 10) / 10,
      width: Math.round(w * 10) / 10,
      height: Math.round(h * 10) / 10,
      rotation: t.rotation ?? 0,
      pivot: "center",
      font: t.font,
      weight: t.weight,
      italic: !!t.italic,
      fontSize: Math.round((t.size / 100) * H * 10) / 10,
      minFontSize: Math.round((t.min / 100) * H * 10) / 10,
      lineHeight: t.lineHeight,
      letterSpacing: 0,
      trackingEm: t.trackingEm ?? null,
      align: t.align ?? "center",
      uppercase: true,
      fill: t.color,
      shrink: true,
      fitBox: true,
      valign: "middle",
      padding: 0,
      shadow: { enabled: false, color: "#000000", blur: 0, offsetX: 0, offsetY: 0, opacity: 0 },
      groupId
    });
  });
  return [art, ...texts];
}
