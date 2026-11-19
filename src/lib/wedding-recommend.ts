/**
 * Package recommendations from a couple's Wedding Basics answers.
 *
 * Guest count sets the sound system (extra speakers), the parts of the day
 * they want covered add ceremony / cocktail-hour sound and mics, outdoors
 * adds coverage, and a hard load-in adds setup time. Each published wedding
 * package is then scored on how well it fits (guest range, hours, what it
 * already includes) and priced with those extras added.
 *
 * Pure: no database. The numbers below are the business rules; change them
 * here.
 */
import type { Answers } from "@/lib/questionnaire-engine";
import type { PackageLineItemData, PackageSectionData, PackageTemplateData } from "@/lib/packages/types";

/** Extra powered speakers by guest count (on top of the standard system). */
export const SOUND_BANDS: { upTo: number; extraSpeakers: number; label: string }[] = [
  { upTo: 100, extraSpeakers: 0, label: "Standard sound system covers up to 100 guests" },
  { upTo: 200, extraSpeakers: 1, label: "101–200 guests: 1 extra speaker" },
  { upTo: 300, extraSpeakers: 2, label: "201–300 guests: 2 extra speakers" },
  { upTo: Infinity, extraSpeakers: 3, label: "Over 300 guests: 3 extra speakers (confirm the room with the venue)" }
];

/** Extra time on top of the reception for the other parts of the day, in hours. */
const CEREMONY_HOURS = 0.5;
const COCKTAIL_HOURS = 1;

export type AddOnKey = "speaker" | "ceremony_sound" | "cocktail_sound" | "mic" | "mc" | "setup" | "uplighting";

/** Which catalog item each extra is, by name (case-insensitive match on any of these). */
const CATALOG_MATCH: Record<AddOnKey, RegExp> = {
  speaker: /additional speaker|extra speaker/i,
  ceremony_sound: /ceremony/i,
  cocktail_sound: /cocktail/i,
  mic: /wireless mic|microphone/i,
  mc: /\bmc\b|master of ceremon/i,
  setup: /^setup\b/i,
  uplighting: /uplight/i
};

export type Needs = {
  guests: number | null;
  receptionHours: number | null;
  hoursNeeded: number | null;
  coverage: string[];
  ceremonyLocation: string | null;
  outdoors: string | null;
  setupAccess: string | null;
  venue: string | null;
};

export type AddOn = { key: AddOnKey; name: string; quantity: number; reason: string };

const val = (a: Answers, k: string): string => {
  const v = a[k];
  return v && !("unsure" in v) && typeof v.value === "string" ? v.value.trim() : "";
};
const vals = (a: Answers, k: string): string[] => {
  const v = a[k];
  return v && !("unsure" in v) && Array.isArray(v.value) ? v.value.filter((x): x is string => typeof x === "string") : [];
};
const hhmm = /^\d{2}:\d{2}$/;

export function needsFromAnswers(a: Answers): Needs {
  const guests = Number(val(a, "guest_count").replace(/[,\s]/g, ""));
  const s = val(a, "reception_start");
  const e = val(a, "reception_end");
  let receptionHours: number | null = null;
  if (hhmm.test(s) && hhmm.test(e)) {
    const [x, y] = [s, e].map((t) => +t.slice(0, 2) * 60 + +t.slice(3));
    receptionHours = ((y - x + 1440) % 1440 || 1440) / 60;
  }
  const coverage = vals(a, "coverage");
  const hoursNeeded =
    receptionHours == null ? null : Math.ceil((receptionHours + (coverage.includes("ceremony") ? CEREMONY_HOURS : 0) + (coverage.includes("cocktail") ? COCKTAIL_HOURS : 0)) * 2) / 2;
  return {
    guests: guests > 0 ? Math.round(guests) : null,
    receptionHours,
    hoursNeeded,
    coverage,
    ceremonyLocation: val(a, "ceremony_location") || null,
    outdoors: val(a, "indoor_outdoor") || null,
    setupAccess: val(a, "setup_access") || null,
    venue: val(a, "venue") || null
  };
}

/** The extras this wedding needs, each with the reason. */
export function addOnsFor(n: Needs): { addOns: AddOn[]; notes: string[] } {
  const addOns: AddOn[] = [];
  const notes: string[] = [];
  if (n.guests != null) {
    const band = SOUND_BANDS.find((b) => n.guests! <= b.upTo)!;
    if (band.extraSpeakers) addOns.push({ key: "speaker", name: "Additional speaker", quantity: band.extraSpeakers, reason: `${n.guests} guests (${band.label.split(":")[0]})` });
    else notes.push(`${n.guests} guests: the standard sound system covers it`);
  }
  if (n.outdoors === "outdoors" || n.outdoors === "both") {
    const sp = addOns.find((x) => x.key === "speaker");
    const reason = n.outdoors === "both" ? "Part of the day is outdoors" : "Outdoors";
    if (sp) {
      sp.quantity += 1;
      sp.reason += ` + 1 for ${reason.toLowerCase()}`;
    } else addOns.push({ key: "speaker", name: "Additional speaker", quantity: 1, reason });
    notes.push("Outdoors: confirm power within 50 ft of the DJ and a backup plan for weather");
  }

  const c = n.coverage;
  if (c.includes("ceremony")) {
    if (n.ceremonyLocation === "same_room") {
      addOns.push({ key: "mic", name: "Wireless microphone", quantity: 1, reason: "Ceremony in the reception room: a mic for the officiant and vows" });
    } else {
      const where = n.ceremonyLocation === "different" ? "at a different location" : n.ceremonyLocation === "same_venue" ? "in a different room or area" : "(location not decided yet)";
      addOns.push({ key: "ceremony_sound", name: "Ceremony sound", quantity: 1, reason: `Ceremony ${where}: a second sound setup` });
      addOns.push({ key: "mic", name: "Wireless microphone", quantity: 1, reason: "Officiant and vows" });
      if (n.ceremonyLocation === "different") notes.push("Ceremony at a different location: plan travel and a second setup between the two sites");
    }
  }
  if (c.includes("cocktail")) addOns.push({ key: "cocktail_sound", name: "Cocktail-hour sound", quantity: 1, reason: "Cocktail hour, if it's not in the reception room" });
  if (c.includes("reception")) addOns.push({ key: "mc", name: "MC services", quantity: 1, reason: "Reception announcements: entrances, toasts, cake, last dance" });
  if (n.setupAccess === "stairs" || n.setupAccess === "long_walk") {
    addOns.push({ key: "setup", name: "Setup (early arrival)", quantity: 1, reason: n.setupAccess === "stairs" ? "Stairs or no elevator: extra load-in time" : "Long walk from parking: extra load-in time" });
  }
  if (n.venue) notes.push(`Check travel distance to ${n.venue}`);
  if (n.hoursNeeded != null) notes.push(`About ${n.hoursNeeded} hours of DJ time${n.receptionHours != null && n.hoursNeeded !== n.receptionHours ? ` (${n.receptionHours} h reception${c.includes("cocktail") ? " + cocktail hour" : ""}${c.includes("ceremony") ? " + ceremony" : ""})` : ""}`);
  return { addOns, notes };
}

const itemName = (li: PackageLineItemData) => li.name_override || li.catalog_item?.name || "";
/** "MC Services" → "MC services", "Ceremony Sound" → "ceremony sound" (keeps acronyms). */
const lower = (name: string) => name.split(/\s+/).map((w) => (/^[A-Z0-9]{2,}$/.test(w) ? w : w.toLowerCase())).join(" ");
const includedModes = new Set(["included", "required", "locked"]);

export type PackageFit = {
  templateId: string;
  name: string;
  tier: string | null;
  score: number;
  why: string[];
  watch: string[];
  /** Line item → quantity: the package's defaults plus the recommended extras it offers. */
  selections: Record<string, number>;
  /** Recommended extras this package doesn't offer (add them separately or by quote). */
  notOffered: AddOn[];
};

/** How well one package fits, and its selections with the extras added. */
export function fitPackage(t: PackageTemplateData, sections: PackageSectionData[], n: Needs, addOns: AddOn[]): PackageFit {
  const why: string[] = [];
  const watch: string[] = [];
  let score = 0;
  const items = sections.flatMap((s) => s.line_items).filter((li) => li.selection_mode !== "hidden");
  const selections: Record<string, number> = {};
  for (const li of items) selections[li.id] = includedModes.has(li.selection_mode) ? Math.max(1, li.included_quantity) : 0;

  if (n.guests != null && (t.min_guest_count != null || t.max_guest_count != null)) {
    const okMin = t.min_guest_count == null || n.guests >= t.min_guest_count;
    const okMax = t.max_guest_count == null || n.guests <= t.max_guest_count;
    if (okMin && okMax) {
      score += 3;
      why.push(`Built for ${t.min_guest_count ?? 0}–${t.max_guest_count ?? "any number of"} guests`);
    } else {
      score -= 5;
      watch.push(okMax ? `Meant for ${t.min_guest_count}+ guests` : `Meant for up to ${t.max_guest_count} guests`);
    }
  }
  if (n.hoursNeeded != null && t.included_hours != null) {
    const inc = Number(t.included_hours);
    if (inc >= n.hoursNeeded) {
      score += 2;
      why.push(`${inc} hours included covers about ${n.hoursNeeded}`);
    } else {
      score -= Math.min(3, n.hoursNeeded - inc);
      watch.push(`${inc} hours included; about ${n.hoursNeeded} needed (${n.hoursNeeded - inc} h extra time)`);
    }
  }

  const notOffered: AddOn[] = [];
  for (const add of addOns) {
    const li = items.find((x) => CATALOG_MATCH[add.key].test(itemName(x)));
    if (!li) {
      notOffered.push(add);
      continue;
    }
    if (includedModes.has(li.selection_mode) && (selections[li.id] ?? 0) >= add.quantity) {
      score += 2;
      why.push(`Includes ${lower(itemName(li))}`);
    } else {
      score += 1;
      const max = li.max_quantity ?? Infinity;
      selections[li.id] = Math.min(max, Math.max(selections[li.id] ?? 0, add.quantity));
      why.push(`Adds ${add.quantity > 1 ? `${add.quantity} × ` : ""}${lower(itemName(li))}`);
    }
  }
  if (notOffered.length) score -= notOffered.length;
  return { templateId: t.id, name: t.name, tier: t.tier ?? null, score, why, watch, selections, notOffered };
}
