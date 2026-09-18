import type { EventCategory } from "@/lib/event-category";

export const EVENT_TYPES = [
  "Wedding",
  "School Dance",
  "Club / Bar Night",
  "Corporate Event",
  "Holiday Party",
  "Birthday / Private Party",
  "Other"
] as const;

export type EventCategoryKey = "wedding" | "school" | "private" | "corporate" | "club" | "other";

// Matches against events.event_category (the derived, canonical value —
// see src/lib/event-category.ts), not the raw free-text event_type, so
// filtering works regardless of casing or which of the three write paths
// (this app's form, the Scheduler, or WordPress) produced the row.
export const EVENT_CATEGORY_GROUPS: { key: EventCategoryKey; label: string; match: (category: EventCategory | null) => boolean }[] = [
  { key: "wedding", label: "Weddings", match: (c) => c === "wedding" },
  { key: "school", label: "School Dances", match: (c) => c === "school_dance" },
  { key: "private", label: "Private Events", match: (c) => c === "private_party" || c === "holiday" },
  { key: "corporate", label: "Corporate", match: (c) => c === "corporate" },
  { key: "club", label: "Club / Bar Nights", match: (c) => c === "bar_nightclub" },
  { key: "other", label: "Other", match: (c) => !c || c === "other" || c === "consultation" }
];
