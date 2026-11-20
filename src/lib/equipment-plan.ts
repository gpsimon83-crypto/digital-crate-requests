/**
 * Equipment recommendations for an event — the pure part (no database).
 *
 * Inputs come from the planning questionnaire first, then Wedding Basics,
 * then the event itself. The event's spaces (reception, plus a separate
 * ceremony or cocktail-hour space) and microphone needs pick which setup
 * rules apply; each rule adds inventory gear with a quantity and a reason.
 * Rules and gear are configured in Admin → Equipment → Setup rules.
 */
import { conditionMatches, type GigCondition, type GigContext } from "@/lib/packages/gig-calculator";
import type { Answers } from "@/lib/questionnaire-engine";

export type Space = "reception" | "ceremony" | "cocktail" | "microphones";
export const SPACE_LABEL: Record<Space, string> = { reception: "Reception audio", ceremony: "Ceremony audio", cocktail: "Cocktail-hour audio", microphones: "Microphones" };

export type SetupRule = {
  id: string;
  space: Space;
  label: string;
  conditions: GigCondition[];
  equipment_id: string | null;
  equipment_category: string | null;
  quantity: number;
  reason: string | null;
  position: number;
  is_active: boolean;
};

type Source = "questionnaire" | "wedding basics" | "event" | "assumed";
export type SetupInputs = {
  guests: number | null;
  eventType: string | null;
  setting: "indoors" | "outdoors" | "both" | null;
  ceremonySpace: "same_room" | "same_venue" | "different" | "none" | null;
  cocktailSpace: "same_room" | "separate" | "none" | null;
  microphones: string[];
  ceremonyTime: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  venue: string | null;
  isWedding: boolean;
  sources: Partial<Record<"guests" | "setting" | "ceremonySpace" | "cocktailSpace" | "microphones" | "ceremonyTime", Source>>;
};

const str = (a: Answers | null | undefined, k: string): string | null => {
  const v = a?.[k];
  return v && !("unsure" in v) && typeof v.value === "string" && v.value.trim() ? v.value.trim() : null;
};
const list = (a: Answers | null | undefined, k: string): string[] | null => {
  const v = a?.[k];
  return v && !("unsure" in v) && Array.isArray(v.value) ? v.value.filter((x): x is string => typeof x === "string") : null;
};
const oneOf = <T extends string>(v: string | null, allowed: readonly T[]): T | null => (v && (allowed as readonly string[]).includes(v) ? (v as T) : null);

/** Planning questionnaire first, then Wedding Basics, then the event. */
export function buildInputs(
  event: { expected_guests: number | null; event_category: string | null; starts_at: string | null; ends_at: string | null; timezone: string | null; venue: string | null },
  planning: Answers | null,
  basics: Answers | null
): SetupInputs {
  const isWedding = event.event_category === "wedding";
  const sources: SetupInputs["sources"] = {};
  const coverage = list(basics, "coverage");

  let setting = oneOf(str(planning, "setup_setting"), ["indoors", "outdoors", "both"] as const);
  if (setting) sources.setting = "questionnaire";
  else if ((setting = oneOf(str(basics, "indoor_outdoor"), ["indoors", "outdoors", "both"] as const))) sources.setting = "wedding basics";

  let ceremonySpace = oneOf(str(planning, "setup_ceremony_space"), ["same_room", "same_venue", "different", "none"] as const);
  if (ceremonySpace) sources.ceremonySpace = "questionnaire";
  else if (coverage && !coverage.includes("ceremony")) {
    ceremonySpace = "none";
    sources.ceremonySpace = "wedding basics";
  }
  else if ((ceremonySpace = oneOf(str(basics, "ceremony_location"), ["same_room", "same_venue", "different"] as const))) sources.ceremonySpace = "wedding basics";

  let cocktailSpace = oneOf(str(planning, "setup_cocktail_space"), ["same_room", "separate", "none"] as const);
  if (cocktailSpace) sources.cocktailSpace = "questionnaire";
  else if (coverage && !coverage.includes("cocktail")) {
    cocktailSpace = "none";
    sources.cocktailSpace = "wedding basics";
  }

  let microphones = list(planning, "setup_microphones");
  if (microphones) {
    sources.microphones = "questionnaire";
    if (microphones.includes("none")) microphones = [];
  } else {
    // Not answered yet: assume what most events need, and say so.
    microphones = [];
    if (ceremonySpace && ceremonySpace !== "none") microphones.push("officiant");
    if (isWedding || event.event_category === "corporate") microphones.push("toasts");
    else microphones.push("announcements");
    sources.microphones = "assumed";
  }

  const ceremonyTime = str(planning, "setup_ceremony_time");
  if (ceremonyTime) sources.ceremonyTime = "questionnaire";
  if (event.expected_guests != null) sources.guests = "event";

  return {
    guests: event.expected_guests ?? null,
    eventType: event.event_category ?? null,
    setting,
    ceremonySpace,
    cocktailSpace,
    microphones,
    ceremonyTime: ceremonyTime && /^\d{2}:\d{2}$/.test(ceremonyTime) ? ceremonyTime : null,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    timezone: event.timezone,
    venue: event.venue,
    isWedding,
    sources
  };
}

export function spacesFor(i: SetupInputs): Space[] {
  const s: Space[] = ["reception"];
  if (i.ceremonySpace === "same_venue" || i.ceremonySpace === "different") s.push("ceremony");
  if (i.cocktailSpace === "separate") s.push("cocktail");
  if (i.microphones.length) s.push("microphones");
  return s;
}

/** What's missing for a confident recommendation (only what matters for this event). */
export function missingInputs(i: SetupInputs): { field: string; label: string; ask: string }[] {
  const out: { field: string; label: string; ask: string }[] = [];
  if (i.guests == null) out.push({ field: "guests", label: "Expected guests", ask: "Add the guest count in Event Details." });
  if (!i.setting) out.push({ field: "setting", label: "Indoors or outdoors", ask: "Asked in the planning questionnaire (Sound & Setup)." });
  if (i.isWedding && !i.ceremonySpace) out.push({ field: "ceremonySpace", label: "Where the ceremony is", ask: "Asked in the planning questionnaire (Sound & Setup)." });
  if (i.isWedding && !i.cocktailSpace) out.push({ field: "cocktailSpace", label: "Where cocktail hour is", ask: "Asked in the planning questionnaire (Sound & Setup)." });
  if (i.sources.microphones === "assumed") out.push({ field: "microphones", label: "Who needs a microphone", ask: "Assumed for now; asked in the planning questionnaire (Sound & Setup)." });
  return out;
}

/** Plain-language list of what the recommendation was based on. */
export function inputSummary(i: SetupInputs): string[] {
  const out: string[] = [];
  if (i.guests != null) out.push(`${i.guests} guests`);
  if (i.setting) out.push(i.setting === "both" ? "indoors and outdoors" : i.setting);
  if (i.ceremonySpace === "same_room") out.push("ceremony in the reception room");
  if (i.ceremonySpace === "same_venue") out.push("ceremony in a separate space");
  if (i.ceremonySpace === "different") out.push("ceremony at another location");
  if (i.cocktailSpace === "separate") out.push("separate cocktail-hour space");
  if (i.microphones.length) out.push(`mics: ${i.microphones.join(", ")}${i.sources.microphones === "assumed" ? " (assumed)" : ""}`);
  return out;
}

export type ProposedItem = {
  /** Stable per event: `${space}:${rule id}`. Used as the assignment's plan_item_key. */
  key: string;
  space: Space;
  ruleId: string;
  label: string;
  equipmentId: string | null;
  equipmentCategory: string | null;
  quantity: number;
  reason: string;
};

/** Every active rule for each of the event's spaces whose conditions all match (no conditions = always). */
export function proposeItems(rules: SetupRule[], i: SetupInputs): ProposedItem[] {
  const ctx: GigContext = {
    guestCount: i.guests,
    eventType: i.eventType,
    hoursBooked: i.startsAt && i.endsAt ? (Date.parse(i.endsAt) - Date.parse(i.startsAt)) / 3_600_000 : null,
    answers: {
      setting: { value: i.setting ?? "" },
      ceremony_space: { value: i.ceremonySpace ?? "" },
      cocktail_space: { value: i.cocktailSpace ?? "" },
      microphones: { value: i.microphones }
    }
  };
  const spaces = new Set(spacesFor(i));
  return rules
    .filter((r) => r.is_active && spaces.has(r.space) && r.conditions.every((c) => conditionMatches(c, ctx)))
    .sort((a, b) => a.position - b.position)
    .map((r) => ({ key: `${r.space}:${r.id}`, space: r.space, ruleId: r.id, label: r.label, equipmentId: r.equipment_id, equipmentCategory: r.equipment_category, quantity: r.quantity, reason: r.reason ?? r.label }));
}

/** Clock time "HH:MM" on the event's date, in its time zone, as epoch ms. */
function onEventDay(startsAt: string, hhmm: string, tz: string | null): number {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz ?? "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(startsAt));
  const [h, m] = hhmm.split(":").map(Number);
  const [y, mo, d] = day.split("-").map(Number);
  let guess = Date.UTC(y, mo - 1, d, h, m);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz ?? "America/Chicago", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  guess += Date.UTC(y, mo - 1, d, h, m) - Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
  return guess;
}

/**
 * Separate spaces whose times overlap need gear running in both at once —
 * flag them for review. Only when the times are actually known.
 */
export function overlapFlags(i: SetupInputs, ceremonyMinutes = 45): string[] {
  const flags: string[] = [];
  if (!i.startsAt || !i.ceremonyTime || !(i.ceremonySpace === "same_venue" || i.ceremonySpace === "different")) return flags;
  const cStart = onEventDay(i.startsAt, i.ceremonyTime, i.timezone);
  const cEnd = cStart + ceremonyMinutes * 60_000;
  const rStart = Date.parse(i.startsAt);
  const rEnd = i.endsAt ? Date.parse(i.endsAt) : rStart + 5 * 3_600_000;
  if (cStart < rEnd && cEnd > rStart) flags.push("The ceremony and reception overlap in separate spaces: both need their own setup running at once.");
  else if (i.cocktailSpace === "separate" && rStart - cEnd < 60 * 60_000) flags.push("Cocktail hour in a separate space starts right after the ceremony: plan a second setup or a quick turnover.");
  else if (i.ceremonySpace === "different" && rStart - cEnd < 90 * 60_000) flags.push("The ceremony is at another location and ends less than 90 minutes before the reception: check the turnover time.");
  return flags;
}

/** Changes in any of these mean an approved plan should be reviewed. */
export function fingerprint(i: SetupInputs): string {
  return JSON.stringify([i.guests, i.setting, i.ceremonySpace, i.cocktailSpace, [...i.microphones].sort(), i.ceremonyTime, i.startsAt, i.endsAt, (i.venue ?? "").trim().toLowerCase()]);
}

/** What changed between the approved inputs and now, in plain words. */
export function changedInputs(before: Partial<SetupInputs> | null | undefined, now: SetupInputs): string[] {
  if (!before) return [];
  const out: string[] = [];
  if ((before.guests ?? null) !== now.guests) out.push(`Guests ${before.guests ?? "—"} → ${now.guests ?? "—"}`);
  if ((before.venue ?? "").trim().toLowerCase() !== (now.venue ?? "").trim().toLowerCase()) out.push(`Venue changed`);
  if ((before.startsAt ?? null) !== now.startsAt || (before.endsAt ?? null) !== now.endsAt || (before.ceremonyTime ?? null) !== now.ceremonyTime) out.push("Timing changed");
  if ((before.setting ?? null) !== now.setting || (before.ceremonySpace ?? null) !== now.ceremonySpace || (before.cocktailSpace ?? null) !== now.cocktailSpace) out.push("Setup answers changed");
  if (JSON.stringify([...(before.microphones ?? [])].sort()) !== JSON.stringify([...now.microphones].sort())) out.push("Microphone needs changed");
  return out;
}
