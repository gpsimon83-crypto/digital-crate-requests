// events.event_type is free text with three independent, uncoordinated
// writers (this app's own fixed dropdown, the Scheduler's hardcoded
// "consultation", and an external WordPress form posting straight into
// /api/inquiries with no validation) — so the same real-world category
// shows up as "Wedding", "wedding", or any number of WordPress-side
// spellings. events.event_category is the single derived, canonical
// value every comparison in the app should use instead of the raw text.
// event_type itself is left untouched and keeps holding whatever
// display-quality text was actually entered.
export type EventCategory =
  | "wedding"
  | "school_dance"
  | "bar_nightclub"
  | "corporate"
  | "holiday"
  | "private_party"
  | "consultation"
  | "other";

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  wedding: "Wedding",
  school_dance: "School Dance",
  bar_nightclub: "Club / Bar Night",
  corporate: "Corporate Event",
  holiday: "Holiday Party",
  private_party: "Birthday / Private Party",
  consultation: "Consultation",
  other: "Other"
};

// Exact matches for the strings our own forms actually produce — checked
// first so our own dropdown values always resolve deterministically,
// before falling through to the fuzzy patterns below (which exist for
// WordPress's own free text or anything else unanticipated).
const EXACT_MATCHES: Record<string, EventCategory> = {
  wedding: "wedding",
  "school dance": "school_dance",
  "club / bar night": "bar_nightclub",
  "corporate event": "corporate",
  "holiday party": "holiday",
  "birthday / private party": "private_party",
  consultation: "consultation",
  other: "other"
};

const FUZZY_PATTERNS: [RegExp, EventCategory][] = [
  [/wedding/i, "wedding"],
  [/(school|prom|homecoming)/i, "school_dance"],
  [/(bar|nightclub|\bclub\b)/i, "bar_nightclub"],
  [/(corporate|company|office)/i, "corporate"],
  [/holiday/i, "holiday"],
  [/(private|birthday|anniversary|graduation|festival)/i, "private_party"],
  [/consult/i, "consultation"]
];

/** Maps any raw events.event_type text to a fixed category. Empty/unset stays null — that's a real "not specified" state, not "other". */
export function deriveEventCategory(rawEventType: string | null | undefined): EventCategory | null {
  const trimmed = rawEventType?.trim();
  if (!trimmed) return null;

  const exact = EXACT_MATCHES[trimmed.toLowerCase()];
  if (exact) return exact;

  for (const [pattern, category] of FUZZY_PATTERNS) {
    if (pattern.test(trimmed)) return category;
  }
  return "other";
}
