import { describe, it, expect } from "vitest";
import { djNightTemplateContent } from "@/lib/flyers/templates/dj-night";
import { parseScene, fillText } from "@/lib/flyers/scene";
import type { TextNode } from "@/lib/flyers/types";

describe("DJ Night Party template", () => {
  const c = djNightTemplateContent();
  it("has portrait and story, every layer separate and in the preset's order", () => {
    for (const f of ["portrait", "story"] as const) {
      const sc = c.formats[f]!;
      expect(sc.width).toBe(1080);
      expect(sc.height).toBe(f === "portrait" ? 1350 : 1920);
      expect(sc.nodes.map((n) => n.kind).join(",")).toBe(["shape", "shape", "image", ...Array(9).fill("text"), "shape", "shape", ...Array(3).fill("text"), "shape", ...Array(4).fill("text")].join(","));
      expect(sc.nodes.filter((n) => n.kind === "text")).toHaveLength(16);
      // survives the save checks unchanged in substance
      const p = parseScene(JSON.parse(JSON.stringify(sc)), f);
      expect(p.ok).toBe(true);
      if (p.ok) expect(p.value.nodes.length).toBe(sc.nodes.length);
    }
  });
  it("keeps the colors, the -8° script and the photo fade", () => {
    const sc = c.formats.portrait!;
    const t = (name: string) => sc.nodes.find((n) => n.name === name) as TextNode;
    expect(t("Title (DJ NIGHT)").fill).toBe("#ee252e");
    expect(t("Script (Party)").rotation).toBe(-8);
    expect(t("Script (Party)").fill).toBe("#f6e539");
    const photo = sc.nodes.find((n) => n.kind === "image")!;
    expect(photo.kind === "image" && photo.feather.sides).toEqual({ top: Math.round(0.22 * 540), right: 0, bottom: Math.round(0.25 * 540), left: 0 });
  });
  it("fills venue, date, time and lineup from the event, with sample wording until then", () => {
    const sc = c.formats.portrait!;
    const lineup = sc.nodes.find((n) => n.name === "DJ lineup") as TextNode;
    expect(fillText(lineup.text, {})).toBe("DJ NAME • DJ NAME • DJ NAME");
    expect(fillText(lineup.text, { dj_lineup: "DJ Nova • DJ Penny" })).toBe("DJ Nova • DJ Penny");
    const date = sc.nodes.find((n) => n.name === "Date (day month)") as TextNode;
    expect(fillText(date.text, { event_day_number: "22", event_month_short: "NOV" })).toBe("22 NOV");
    const city = sc.nodes.find((n) => n.name === "City, state, ZIP") as TextNode;
    expect(fillText(city.text, { venue_city: "Belgium, WI 53004" })).toBe("Belgium, WI 53004");
  });
});
