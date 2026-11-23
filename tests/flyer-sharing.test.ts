import { describe, expect, it } from "vitest";
import { canUseTemplate, shareLabel } from "@/lib/flyers/sharing";

describe("flyer template sharing", () => {
  it("all / chosen / office", () => {
    expect(canUseTemplate("all", [], "d1")).toBe(true);
    expect(canUseTemplate(undefined, [], "d1")).toBe(true);
    expect(canUseTemplate("selected", ["d1"], "d1")).toBe(true);
    expect(canUseTemplate("selected", ["d2"], "d1")).toBe(false);
    expect(canUseTemplate("selected", ["d1"], null)).toBe(false);
    expect(canUseTemplate("office", ["d1"], "d1")).toBe(false);
  });
  it("labels", () => {
    expect(shareLabel("all", 0)).toBe("All DJs");
    expect(shareLabel("selected", 1)).toBe("1 DJ");
    expect(shareLabel("selected", 3)).toBe("3 DJs");
    expect(shareLabel("office", 0)).toBe("Office only");
  });
});
