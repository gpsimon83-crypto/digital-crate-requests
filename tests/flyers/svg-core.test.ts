import { describe, expect, it } from "vitest";
import { apply, guessImageRole, guessTextRole, humanize, isAllCaps, multiply, parseClassRules, parseTransform, pickFormat, px, rotationOf, scaleX, suggestPlaceholder, toHex, weightOf } from "@/lib/flyers/svg-core";
import { matchFont } from "@/lib/flyers/fonts";
import { bookingValues, fillText } from "@/lib/flyers/scene";

describe("SVG transforms", () => {
  it("reads Illustrator's translate/scale and nested matrices", () => {
    expect(apply(parseTransform("translate(372.73 73)"), 0, 0)).toEqual([372.73, 73]);
    expect(scaleX(parseTransform("scale(.86)"))).toBeCloseTo(0.86);
    const m = multiply(parseTransform("translate(10,20) scale(2)"), parseTransform("translate(5 5)"));
    expect(apply(m, 0, 0)).toEqual([20, 30]);
    expect(rotationOf(parseTransform("rotate(-90)"))).toBe(-90);
    expect(apply(parseTransform("rotate(90 50 50)"), 50, 0)).toEqual([expect.closeTo(100, 6), expect.closeTo(50, 6)]);
  });
});

describe("SVG styles", () => {
  const css = `.st0 { font-size: 43.68px; } .st0, .st7 { fill: #111; font-family: Arial-BoldMT, Arial; font-weight: 700; } .st9 { fill: #cb171a; font-size: 98.84px; } .st9 { font-family: Arial-Black, 'Arial Black'; }`;
  it("merges class rules the way Illustrator writes them", () => {
    const r = parseClassRules(css);
    expect(r.get("st0")).toMatchObject({ "font-size": "43.68px", fill: "#111", "font-weight": "700" });
    expect(r.get("st9")).toMatchObject({ fill: "#cb171a", "font-family": "Arial-Black, 'Arial Black'" });
  });
  it("normalizes colours, lengths and weights", () => {
    expect(toHex("#111")).toBe("#111111");
    expect(toHex("rgb(203, 23, 26)")).toBe("#cb171a");
    expect(toHex("white")).toBe("#ffffff");
    expect(px(".02em", 50)).toBe(1);
    expect(px("12pt")).toBe(16);
    expect(weightOf("bold")).toBe(700);
  });
  it("maps fonts to the closest included one", () => {
    expect(matchFont("Arial-Black, 'Arial Black'", 800)).toEqual({ key: "archivo-black", weight: 400 });
    expect(matchFont("Arial-BoldMT, Arial", 700)).toEqual({ key: "arimo", weight: 700 });
    expect(matchFont("ArialMT, Arial", 400)).toEqual({ key: "arimo", weight: 400 });
    expect(matchFont("Montserrat-ExtraBold", 800).key).toBe("montserrat");
    expect(matchFont("BebasNeue-Regular", 400).key).toBe("bebas");
    expect(matchFont("Helvetica Neue", 400).key).toBe("arimo");
  });
});

describe("SVG layers", () => {
  it("picks the size from the artboard", () => {
    expect(pickFormat(1080, 1080)).toMatchObject({ format: "square", off: 0 });
    expect(pickFormat(2160, 2700).format).toBe("portrait");
    expect(pickFormat(1080, 1920).format).toBe("story");
  });
  it("names layers and works out what each one is (from the uploaded template)", () => {
    expect(humanize("event-day1")).toBe("Event day");
    expect(humanize("dj-name")).toBe("Dj name");
    const cases: [string, string, string][] = [
      ["presenter", "DIGITAL CRATE DJS PRESENTS", "text"],
      ["event-day", "NOV", "date"],
      ["event-day", "14", "date"],
      ["event-time", "10PM", "time"],
      ["event-time", "START", "time"],
      ["event-title", "CASEY KEY PUB", "title"],
      ["dj-name", "DJ NAME", "dj_name"],
      ["venue-name", "YOUR VENUE", "venue"],
      ["venue-address", "VENUE ADDRESS • CITY, STATE", "address"],
      ["footer", "YOUR EVENT DETAILS", "details"]
    ];
    for (const [id, text, role] of cases) expect(guessTextRole(humanize(id), text)).toBe(role);
    expect(guessImageRole("Background", false)).toBe("background");
    expect(guessImageRole("Layer 3", true)).toBe("background");
    expect(guessImageRole("Venue logo", false)).toBe("logo");
  });
  it("turns booking fields into placeholders that keep the file's words as fallback", () => {
    expect(suggestPlaceholder("date", "NOV")).toBe("{{event_month|NOV}}");
    expect(suggestPlaceholder("date", "14")).toBe("{{event_day|14}}");
    expect(suggestPlaceholder("time", "10PM")).toBe("{{start_time|10PM}}");
    expect(suggestPlaceholder("time", "START")).toBe("START");
    expect(suggestPlaceholder("dj_name", "DJ NAME")).toBe("{{dj_name}}");
    expect(suggestPlaceholder("venue", "YOUR VENUE")).toBe("{{venue_name|YOUR VENUE}}");
    expect(suggestPlaceholder("text", "DIGITAL CRATE DJS PRESENTS")).toBe("DIGITAL CRATE DJS PRESENTS");
    expect(isAllCaps("NOV")).toBe(true);
    expect(isAllCaps("Nov")).toBe(false);
  });
  it("fills the new month/day placeholders from a booking", () => {
    const v = bookingValues({ starts_at: "2026-11-26T03:30:00Z" }, "DJ Peace");
    expect(v).toMatchObject({ event_month: "Nov", event_day: "25", event_weekday: "Wednesday" });
    expect(fillText("{{event_month|NOV}} {{event_day|14}}", v)).toBe("Nov 25");
    expect(fillText("{{event_month|NOV}} {{event_day|14}}", {})).toBe("NOV 14");
  });
});
