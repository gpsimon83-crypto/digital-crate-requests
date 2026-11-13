import { describe, expect, it } from "vitest";
import { fmtTime } from "@/lib/audio/time";

describe("player time", () => {
  it("formats elapsed time and duration", () => {
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(227)).toBe("3:47");
    expect(fmtTime(3725)).toBe("1:02:05");
    expect(fmtTime(NaN)).toBe("--:--");
    expect(fmtTime(Infinity)).toBe("--:--");
  });
});
