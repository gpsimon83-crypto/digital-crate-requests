import { describe, expect, it } from "vitest";
import { bookingValues, checkDjChanges, duplicateNodes, emptyScene, fillText, imageLayout, instantiate, LOCKED_PERMS, newImage, newText, parseScene, parseTemplateContent, reorder, withGroup } from "@/lib/flyers/scene";
import { commit, initHistory, redo, undo } from "@/lib/flyers/history";
import { boundsOf, snapBox } from "@/lib/flyers/snap";
import { sampleTemplateContent } from "@/lib/flyers/sample-template";
import { checkUpload, sniffImage } from "@/lib/flyers/image-check";
import { FORMATS, type Scene, type TextNode } from "@/lib/flyers/types";

const DJ = "11111111-1111-4111-8111-111111111111";
const VENUE = "22222222-2222-4222-8222-222222222222";

describe("scene validation", () => {
  it("cleans unknown fields, clamps numbers and keeps the format's real size", () => {
    const raw = {
      format: "story",
      width: 99,
      height: 99,
      nodes: [
        { kind: "text", id: "t1", text: "Hi", fontSize: 99999, opacity: 7, evil: "<script>", font: "comic-sans", x: Infinity },
        { kind: "image", id: "i1", source: { type: "static", src: "https://evil.example/x.png" } },
        { kind: "image", id: "i2", source: { type: "static", src: "/flyers/../../etc/passwd.png" } },
        { kind: "image", id: "i3", source: { type: "asset", assetId: "not-a-uuid" } }
      ]
    };
    const p = parseScene(raw);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.value.width).toBe(1080);
    expect(p.value.height).toBe(1920);
    const t = p.value.nodes[0] as TextNode;
    expect(t.fontSize).toBe(600);
    expect(t.opacity).toBe(1);
    expect(t.font).toBe("montserrat");
    expect(t.x).toBe(0);
    expect("evil" in t).toBe(false);
    for (const n of p.value.nodes.slice(1)) expect(n.kind === "image" && n.source.type).toBe("none");
  });
  it("refuses a size change, too many layers and oversized data", () => {
    expect(parseScene({ format: "square", nodes: [] }, "story").ok).toBe(false);
    expect(parseScene({ format: "square", nodes: Array.from({ length: 81 }, () => ({ kind: "text" })) }).ok).toBe(false);
    expect(parseScene({ format: "square", nodes: [{ kind: "text", text: "x".repeat(500_000) }] }).ok).toBe(false);
  });
  it("gives duplicate layer ids new ids", () => {
    const p = parseScene({ format: "square", nodes: [{ kind: "text", id: "a" }, { kind: "text", id: "a" }] });
    expect(p.ok && p.value.nodes[0].id !== p.value.nodes[1].id).toBe(true);
  });
});

describe("placeholders and bookings", () => {
  it("fills placeholders with values or fallbacks", () => {
    expect(fillText("{{dj_name}} @ {{venue_name}}", { dj_name: "DJ Que", venue_name: "North 48" })).toBe("DJ Que @ North 48");
    expect(fillText("{{start_time}} – {{end_time|Close}}", { start_time: "9 PM" })).toBe("9 PM – Close");
    expect(fillText("{{event_title}}", {})).toBe("{{event_title}}");
    expect(fillText("{{event_title}}", {}, false)).toBe("");
  });
  it("formats a booking in Central time", () => {
    const v = bookingValues({ title: "Halloween Bash", starts_at: "2026-11-01T02:00:00Z", ends_at: "2026-11-01T06:30:00Z", venue_name: "Kyote's", venue_address: "1 Main St" }, "DJ Peace");
    expect(v).toMatchObject({ dj_name: "DJ Peace", event_title: "Halloween Bash", event_date: "Saturday, October 31", start_time: "9 PM", end_time: "1:30 AM", venue_name: "Kyote's" });
  });
  it("a DJ's copy gets their own photo, the booking venue's logo, and no raw braces", () => {
    const s = sampleTemplateContent().formats.square!;
    const out = instantiate(s, { values: { dj_name: "DJ Que", event_date: "Friday, Dec 4" }, djId: DJ, venueId: VENUE });
    const portrait = out.nodes.find((n) => n.role === "portrait");
    const logo = out.nodes.find((n) => n.role === "logo");
    expect(portrait?.kind === "image" && portrait.source).toEqual({ type: "dj_photo", djId: DJ });
    expect(logo?.kind === "image" && logo.source).toEqual({ type: "venue_logo", venueId: VENUE });
    const texts = out.nodes.filter((n): n is TextNode => n.kind === "text").map((n) => n.text);
    expect(texts.some((t) => t.includes("{{"))).toBe(false);
    expect(texts).toContain("DJ Que");
    expect(texts).toContain("Saturday Night Live"); // fallback in the title
    expect(texts).toContain("Venue name"); // readable label when nothing to fill
  });
  it("hides the venue logo slot when there's no venue", () => {
    const out = instantiate(sampleTemplateContent().formats.story!, { values: {}, djId: DJ, venueId: null });
    expect(out.nodes.find((n) => n.role === "logo")?.visible).toBe(false);
  });
});

describe("sample template", () => {
  it("is valid, has all three sizes at their real dimensions, and is built from separate layers", () => {
    const c = sampleTemplateContent();
    const p = parseTemplateContent(JSON.parse(JSON.stringify(c)));
    expect(p.ok).toBe(true);
    for (const k of ["square", "portrait", "story"] as const) {
      const s = c.formats[k]!;
      expect([s.width, s.height]).toEqual([FORMATS[k].width, FORMATS[k].height]);
      expect(s.nodes.filter((n) => n.kind === "text").length).toBeGreaterThanOrEqual(7);
      expect(s.nodes.filter((n) => n.kind === "image").length).toBeGreaterThanOrEqual(5);
      expect(s.nodes[0]).toMatchObject({ role: "background", locked: true, perms: LOCKED_PERMS });
      for (const n of s.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.x + n.width).toBeLessThanOrEqual(s.width);
        expect(n.y + n.height).toBeLessThanOrEqual(s.height + 1);
      }
    }
  });
});

describe("image crop math", () => {
  it("cover fills the frame and pans within the overflow", () => {
    const f = { width: 400, height: 400 };
    const center = imageLayout(f, { width: 800, height: 400 }, "cover", { zoom: 1, x: 0, y: 0 });
    expect(center).toEqual({ x: -200, y: 0, width: 800, height: 400 });
    expect(imageLayout(f, { width: 800, height: 400 }, "cover", { zoom: 1, x: -1, y: 0 }).x + 0).toBe(0);
    expect(imageLayout(f, { width: 800, height: 400 }, "cover", { zoom: 1, x: 1, y: 0 }).x).toBe(-400);
    expect(imageLayout(f, { width: 800, height: 400 }, "cover", { zoom: 2, x: 0, y: 0 }).width).toBe(1600);
  });
  it("contain fits the whole image", () => {
    expect(imageLayout({ width: 400, height: 400 }, { width: 800, height: 400 }, "contain", { zoom: 1, x: 0, y: 0 })).toEqual({ x: 0, y: 100, width: 400, height: 200 });
  });
});

describe("layer operations", () => {
  const s = emptyScene("square");
  const a = newText("title", s, { id: "a" });
  const b = newText("dj_name", s, { id: "b", groupId: "g" });
  const c = newImage("overlay", { type: "none" }, s, { id: "c", groupId: "g" });
  it("reorders", () => {
    expect(reorder([a, b, c], "a", "up").map((n) => n.id)).toEqual(["b", "a", "c"]);
    expect(reorder([a, b, c], "a", "top").map((n) => n.id)).toEqual(["b", "c", "a"]);
    expect(reorder([a, b, c], "c", "bottom").map((n) => n.id)).toEqual(["c", "a", "b"]);
  });
  it("groups select together and duplicate into a new group", () => {
    expect(withGroup([a, b, c], "b").sort()).toEqual(["b", "c"]);
    const d = duplicateNodes([a, b, c], ["b", "c"]);
    expect(d.nodes).toHaveLength(5);
    const copies = d.nodes.filter((n) => d.newIds.includes(n.id));
    expect(new Set(copies.map((n) => n.groupId)).size).toBe(1);
    expect(copies[0].groupId).not.toBe("g");
  });
});

describe("DJ permission check", () => {
  const base = sampleTemplateContent().formats.square!;
  const scene: Scene = JSON.parse(JSON.stringify(base));
  const bg = scene.nodes[0];
  const title = scene.nodes.find((n) => n.role === "title")!;
  const clone = (): Scene => JSON.parse(JSON.stringify(scene));
  it("allows editing open layers and adding new ones", () => {
    const n = clone();
    const t = n.nodes.find((x) => x.id === title.id) as TextNode;
    t.text = "NYE";
    t.x += 40;
    t.fill = "#ff0000";
    n.nodes.push(newText("text", n));
    expect(checkDjChanges(scene, n)).toBeNull();
  });
  it("blocks moving, restyling, deleting or unlocking template-locked layers", () => {
    const moved = clone();
    moved.nodes[0].x = 20;
    expect(checkDjChanges(scene, moved)).toMatch(/fixed in place/);
    const gone = clone();
    gone.nodes = gone.nodes.filter((n) => n.id !== bg.id);
    expect(checkDjChanges(scene, gone)).toMatch(/can't be deleted/);
    const unlocked = clone();
    unlocked.nodes[0].perms = { move: true, edit: true, style: true, remove: true };
    expect(checkDjChanges(scene, unlocked)).toMatch(/permissions/);
    const swapped = clone();
    const img = swapped.nodes[0];
    if (img.kind === "image") img.source = { type: "static", src: "/flyers/sample/sparks.png" };
    expect(checkDjChanges(scene, swapped)).toMatch(/set by the template/);
  });
  it("new layers can't sneak in template permissions", () => {
    const n = clone();
    n.nodes.push(newText("text", n, { perms: { ...LOCKED_PERMS } }));
    expect(checkDjChanges(scene, n)).toMatch(/New layers/);
  });
});

describe("snapping", () => {
  it("snaps to canvas centre and other layers' edges within the threshold", () => {
    const r = snapBox({ x: 437, y: 10, width: 200, height: 50 }, [{ x: 0, y: 300, width: 100, height: 100 }], { width: 1080, height: 1080, safeMargin: 60 }, 8);
    expect(r.dx).toBe(3); // centre 537 -> 540
    expect(r.guides).toContainEqual({ orient: "v", pos: 540 });
    const far = snapBox({ x: 300, y: 200, width: 10, height: 10 }, [], { width: 1080, height: 1080, safeMargin: 60 }, 8);
    expect(far).toMatchObject({ dx: 0, dy: 0, guides: [] });
  });
  it("uses rotated bounds", () => {
    const b = boundsOf({ x: 0, y: 0, width: 100, height: 50, rotation: 90 });
    expect(Math.round(b.x)).toBe(-50);
    expect(Math.round(b.width)).toBe(50);
    expect(Math.round(b.height)).toBe(100);
  });
});

describe("undo / redo", () => {
  it("steps back and forward and merges one drag into one step", () => {
    let h = initHistory(1);
    h = commit(h, 2, "drag:a", 1000);
    h = commit(h, 3, "drag:a", 1200);
    h = commit(h, 4, "x", 5000);
    expect(h.past).toEqual([1, 3]);
    h = undo(h);
    expect(h.present).toBe(3);
    h = undo(h);
    expect(h.present).toBe(1);
    h = redo(h);
    expect(h.present).toBe(3);
    h = commit(h, 9);
    expect(h.future).toEqual([]);
  });
});

describe("upload checks", () => {
  const png = (w: number, h: number, colorType = 6) => {
    const b = new Uint8Array(64);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(b.buffer).setUint32(16, w);
    new DataView(b.buffer).setUint32(20, h);
    b[24] = 8;
    b[25] = colorType;
    return b;
  };
  it("reads PNG size and transparency from the bytes", () => {
    expect(sniffImage(png(1200, 900))).toMatchObject({ mime: "image/png", width: 1200, height: 900, hasAlpha: true });
    expect(sniffImage(png(1200, 900, 2))?.hasAlpha).toBe(false);
  });
  it("reads JPEG size", () => {
    const b = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x02, 0x58, 0x03, 0x20, 3, 0, 0, 0, 0]);
    expect(sniffImage(b)).toMatchObject({ mime: "image/jpeg", width: 800, height: 600 });
  });
  it("rejects disguised files, huge images and oversized uploads", () => {
    expect(checkUpload(new TextEncoder().encode("<svg onload=alert(1)>"), "dj").ok).toBe(false);
    expect(checkUpload(png(9000, 100), "dj").ok).toBe(false);
    expect(checkUpload(png(20, 20), "dj").ok).toBe(false);
    const big = new Uint8Array(11 * 1024 * 1024);
    big.set(png(1000, 1000));
    expect(checkUpload(big, "dj")).toMatchObject({ ok: false, error: "Images can be up to 10 MB." });
    expect(checkUpload(big, "template").ok).toBe(true);
  });
});
