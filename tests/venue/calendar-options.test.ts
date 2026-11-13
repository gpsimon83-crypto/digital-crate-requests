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
    expect([...VENUE_CALENDAR_OPTIONS].slice(0, 4)).toEqual(["Casey Key", "North 48", "Brass Boar's Den", "Kyotes"]);
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
    expect(venueNameVariants("Brass Boar's Den")).toEqual(["Brass Boar's Den", "Brass Boars Den"]);
    expect(venueNameVariants("Kyote's")).toEqual(expect.arrayContaining(["Kyotes"]));
    expect(venueNameVariants("Coyotes")).toEqual(expect.arrayContaining(["Kyotes"]));
    expect(venueNameVariants("Kyotes Sports Bar")).toEqual(expect.arrayContaining(["Kyotes"]));
    expect(venueNameVariants("The Kyotes Bar & Grill")).toEqual(expect.arrayContaining(["Kyotes"]));
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

import { locationForMatched, locationForText, locationSearchNames, normalizeLocations } from "@/lib/venue/locations";
describe("venue locations", () => {
  const locs = normalizeLocations([
    { name: "Cedarburg", city: "Cedarburg, WI", calendar_names: ["North 48 Cedarburg", "N48 Cedarburg"], is_default: true },
    { name: "Oconomowoc", calendar_names: ["North 48 Ocon", "North 48 Oconomowoc", "north 48 ocon"], is_default: true },
    { name: "cedarburg" },
    { name: "x" }
  ]);
  it("cleans the list: unique names, one default, de-duplicated calendar names", () => {
    expect(locs.map((l) => l.name)).toEqual(["Cedarburg", "Oconomowoc"]);
    expect(locs.map((l) => l.is_default)).toEqual([true, false]);
    expect(locs[1].calendar_names).toEqual(["North 48 Ocon", "North 48 Oconomowoc"]);
    expect(locs[0].id).toBe("loc_cedarburg");
  });
  it("searches longest names first and places nights", () => {
    expect(locationSearchNames(locs)[0]).toBe("North 48 Oconomowoc");
    expect(locationForMatched(locs, "north 48 ocon")).toBe("loc_oconomowoc");
    expect(locationForMatched(locs, "North 48")).toBe("loc_cedarburg"); // only the venue name → default location
    expect(locationForText(locs, "Saturday – North 48 Oconomowoc / DJ Que")).toBe("loc_oconomowoc");
    expect(locationForText(locs, "North 48")).toBe("loc_cedarburg");
    expect(locationForText([], "anything")).toBeNull();
  });
});
