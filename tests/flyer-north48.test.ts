import { describe, expect, it } from "vitest";
import { north48TemplateContent } from "@/lib/flyers/templates/north48";
import { parseTemplateContent } from "@/lib/flyers/scene";
import { arcGeometry, arcBoxFor } from "@/lib/flyers/arc";
import type { TextNode } from "@/lib/flyers/types";

describe("North 48 template", () => {
  const parsed = parseTemplateContent(north48TemplateContent());
  it("is a valid story template with separate layers", () => {
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const s = parsed.value.formats.story!;
    expect([s.width, s.height]).toEqual([1080, 1920]);
    expect(s.nodes.filter((n) => n.kind === "text")).toHaveLength(11);
    expect(s.nodes.filter((n) => n.kind === "image")).toHaveLength(1);
  });
  it("keeps NORTH 48 as curved, linked venue text", () => {
    if (!parsed.ok) return;
    const v = parsed.value.formats.story!.nodes.find((n) => n.name.startsWith("Venue")) as TextNode;
    expect(v.text).toBe("{{venue.name|NORTH 48}}");
    expect(v.arc).toBe(122.5);
  });
  it("keeps the −3° and −90° turns and links the event fields", () => {
    if (!parsed.ok) return;
    const t = parsed.value.formats.story!.nodes.filter((n): n is TextNode => n.kind === "text");
    expect(t.filter((n) => n.rotation === -3).map((n) => n.name)).toEqual(["Title line 1 (BLACKOUT)", "Title line 2 (WEDNESDAY)", "DJ name"]);
    expect(t.find((n) => n.rotation === -90)?.text).toBe("{{event.monthShort|NOV}}");
    expect(t.map((n) => n.text).join(" ")).toMatch(/dj\.lineup.*drinkSpecials.*venue\.street/);
  });
});

describe("arc geometry", () => {
  it("matches the designer's arch: ends at y 300, middle 122.5 higher", () => {
    const b = arcBoxFor(65, 1015, 300, 190, 122.5);
    const g = arcGeometry(b.width, 190, 122.5);
    expect(b.y + g.endsY).toBeCloseTo(300, 5);
    expect(b.y + (g.endsY + g.ctrlY) / 2).toBeCloseTo(177.5, 5);
    expect(g.length).toBeGreaterThan(985);
    expect(g.length).toBeLessThan(1000);
  });
});
