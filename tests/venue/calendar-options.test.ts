import { describe, expect, it } from "vitest";
import { isDjName, resolveDjName, venueNameVariants, venueSearchNames, VENUE_CALENDAR_OPTIONS, DJ_CALENDAR_OPTIONS } from "@/lib/venue/calendar-options";

const map = [
  { id: "1", calendar_name: "Que", display_name: "DJ Que" },
  { id: "2", calendar_name: "GMO", display_name: "DJ Grand Master O" },
  { id: "3", calendar_name: "Omerta", display_name: "DJ Omertà" },
  { id: "4", calendar_name: "J Prime", display_name: "DJ J Prime" }
];

describe("calendar DJ names", () => {
  it("has the venues and DJs you listed", () => {
    expect([...VENUE_CALENDAR_OPTIONS]).toEqual(["Casey Key", "North 48", "Brass Boar's Den"]);
    expect([...DJ_CALENDAR_OPTIONS].slice(0, 6)).toEqual(["Que", "GMO", "Makara", "Bubblz", "Omerta", "Penny"]);
  });
  it("maps the DJ part of a title to the actual name, ignoring case and accents", () => {
    expect(resolveDjName(map, "que")?.display_name).toBe("DJ Que");
    expect(resolveDjName(map, "gmo")?.display_name).toBe("DJ Grand Master O");
    expect(resolveDjName(map, "Omertà")?.display_name).toBe("DJ Omertà");
    expect(resolveDjName(map, "J Prime")?.display_name).toBe("DJ J Prime");
  });
  it("falls back to the members-area match, and needs whole words", () => {
    expect(resolveDjName(map, "", "DJ Que")?.display_name).toBe("DJ Que");
    expect(resolveDjName(map, "Queen night")).toBeNull();
    expect(resolveDjName(map, "")).toBeNull();
    expect(resolveDjName([], "Que")).toBeNull();
  });
});

describe("what a venue portal searches the calendar for", () => {
  it("always includes the venue's own name, singular too", () => {
    expect(venueNameVariants("Casey Keys")).toEqual(["Casey Keys", "Casey Key"]);
    expect(venueNameVariants("Casey Key Pub")).toEqual(expect.arrayContaining(["Casey Key Pub", "Casey Key"]));
    expect(venueNameVariants("Brass Boar's Den")).toEqual(["Brass Boar's Den"]);
  });
  it("skips DJ names saved in the venue box", () => {
    const djs = [{ calendar_name: "Hydef", display_name: "Dj Hydef" }];
    expect(isDjName("DJ Que", [])).toBe(true);
    expect(isDjName("gmo", [])).toBe(true);
    expect(isDjName("Peace", [])).toBe(true);
    expect(isDjName("Dj HyDef", djs)).toBe(true);
    expect(isDjName("North 48", djs)).toBe(false);
    expect(venueSearchNames("Casey Keys", ["Dj Peace", "Dj Grand Master O", "DJ Que", "gmo", "Peace"], djs)).toEqual(["Casey Keys", "Casey Key"]);
    expect(venueSearchNames("North 48", ["North 48 Oco", "DJ Penny"], djs)).toEqual(["North 48", "North 48 Oco"]);
  });
});
