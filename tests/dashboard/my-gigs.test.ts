import { describe, it, expect } from "vitest";
import { calendarNamesFor, mentionsDj } from "@/lib/data/my-gigs";

describe("my gigs: finding a DJ on the calendar", () => {
  const map = [
    { id: "1", calendar_name: "Peace", display_name: "DJ Peace" },
    { id: "2", calendar_name: "P-Dawg", display_name: "DJ Peace" },
    { id: "3", calendar_name: "Que", display_name: "DJ Que" }
  ];
  it("uses the profile name, the name without DJ, and mapped nicknames", () => {
    expect(calendarNamesFor("DJ Peace", map).sort()).toEqual(["DJ Peace", "P-Dawg", "Peace"].sort());
    expect(calendarNamesFor("Makara", [])).toEqual(["Makara"]);
  });
  it("matches whole words only, any case or punctuation", () => {
    const names = calendarNamesFor("DJ Peace", map);
    expect(mentionsDj("Peace @ Kyotes", names)).toBe(true);
    expect(mentionsDj("Smith wedding - DJ PEACE", names)).toBe(true);
    expect(mentionsDj("Kyotes: p-dawg", names)).toBe(true);
    expect(mentionsDj("Peaceful Pines bingo", names)).toBe(false);
    expect(mentionsDj("Que @ Casey Keys", names)).toBe(false);
    expect(mentionsDj(null, names)).toBe(false);
  });
});
