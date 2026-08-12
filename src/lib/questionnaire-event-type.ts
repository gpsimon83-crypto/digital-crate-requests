// events.event_type is free text (e.g. "wedding", "corporate", "birthday",
// "club", "festival") with no CHECK constraint, so we map it onto the fixed
// set of questionnaire templates we actually build content for.
export type QuestionnaireEventType = "wedding" | "bar_nightclub" | "corporate" | "private_party" | "school_dance";

const KEYWORD_MAP: [RegExp, QuestionnaireEventType][] = [
  [/wedding/i, "wedding"],
  [/(bar|nightclub|club)/i, "bar_nightclub"],
  [/(corporate|company|office)/i, "corporate"],
  [/(school|prom|homecoming|dance)/i, "school_dance"],
  [/(private|birthday|anniversary|graduation|party|festival)/i, "private_party"]
];

export function normalizeEventType(raw: string | null | undefined): QuestionnaireEventType | null {
  if (!raw) return null;
  for (const [pattern, type] of KEYWORD_MAP) {
    if (pattern.test(raw)) return type;
  }
  return null;
}
