import { describe, expect, it } from "vitest";
import { calendarNamesFor, isAwayNote, mentionsDj } from "@/lib/data/my-gigs";

// Titles as the DJs write them on the DCDJ calendar.
const names = calendarNamesFor("DJ Penny", []);

describe("Penny's calendar entries", () => {
  it("match her name however it's written", () => {
    for (const t of ["Young Wedding - Penny", "Maddie & Devin wedding -Penny", "Mojo- Penny", "Karen 65th Bday- Penny", "Penny out of town", "Gmo and penny shadow Whyte nite bucks 5pm", "Tracy's Morrow 50th Bday - Penny"]) {
      expect(mentionsDj(t, names), t).toBe(true);
    }
    expect(mentionsDj("Pennywise party - Que", names)).toBe(false);
    expect(mentionsDj("D2 - Que", names)).toBe(false);
  });
  it("marks out-of-town notes as away, not gigs", () => {
    expect(isAwayNote("Out Of Town - Penny")).toBe(true);
    expect(isAwayNote("Penny out of town")).toBe(true);
    expect(isAwayNote("Young Wedding - Penny")).toBe(false);
    expect(isAwayNote("Kick off party - Penny")).toBe(false);
  });
});
