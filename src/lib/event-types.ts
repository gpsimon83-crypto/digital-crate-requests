export const EVENT_TYPES = [
  "Wedding",
  "Club / Bar Night",
  "Corporate Event",
  "Holiday Party",
  "Birthday / Private Party",
  "Other"
] as const;

export type EventCategoryKey = "wedding" | "private" | "corporate" | "club" | "other";

export const EVENT_CATEGORY_GROUPS: { key: EventCategoryKey; label: string; match: (eventType: string | null) => boolean }[] = [
  { key: "wedding", label: "Weddings", match: (t) => t === "Wedding" },
  { key: "private", label: "Private Events", match: (t) => t === "Birthday / Private Party" || t === "Holiday Party" },
  { key: "corporate", label: "Corporate", match: (t) => t === "Corporate Event" },
  { key: "club", label: "Club / Bar Nights", match: (t) => t === "Club / Bar Night" },
  { key: "other", label: "Other", match: (t) => !t || t === "Other" }
];
