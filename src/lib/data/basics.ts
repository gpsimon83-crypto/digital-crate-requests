import type { createAdminClient } from "@/lib/supabase/admin";
import { getTemplateForEventType } from "@/lib/data/questionnaires";
import { WEDDING_BASICS } from "@/lib/data/questionnaire-links";
import type { Answers, Template } from "@/lib/questionnaire-engine";
import type { Applied } from "@/lib/data/questionnaire-links";

type Db = ReturnType<typeof createAdminClient>;
export const EVENT_BASICS = "event_basics";

/** Weddings use Wedding Basics (/w/ links); every other event uses Event Basics (/e/ links). */
export async function basicsFor(db: Db, eventId: string): Promise<{ kind: "wedding" | "event"; template: Template | null; event: BasicsEvent | null }> {
  const { data } = await db.from("events").select("id, title, event_category, event_type, expected_guests, starts_at, ends_at, package_id, couple_display_name, clients(first_name, last_name)").eq("id", eventId).maybeSingle();
  const event = data as BasicsEvent | null;
  const wedding = !event || event.event_category === "wedding" || (!event.event_category && /wedding/i.test(event.event_type ?? ""));
  const template = await getTemplateForEventType(wedding ? WEDDING_BASICS : EVENT_BASICS).catch(() => null);
  return { kind: wedding ? "wedding" : "event", template, event };
}

export type BasicsEvent = {
  id: string;
  title: string;
  event_category: string | null;
  event_type: string | null;
  expected_guests: number | null;
  starts_at: string | null;
  ends_at: string | null;
  package_id: string | null;
  couple_display_name: string | null;
  clients: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
};

/** Event Basics answers fill the project's EMPTY guest count and venue; differences are listed, never overwritten. */
export async function applyEventBasics(db: Db, eventId: string, answers: Answers): Promise<Applied> {
  const applied: Applied = { filled: [], differs: [] };
  const get = (k: string) => {
    const v = answers[k];
    return v && !("unsure" in v) && typeof v.value === "string" ? v.value.trim() : "";
  };
  const { data } = await db.from("events").select("expected_guests, venue_name").eq("id", eventId).maybeSingle();
  const ev = data as { expected_guests: number | null; venue_name: string | null } | null;
  if (!ev) return applied;
  const update: Record<string, unknown> = {};
  const guests = Math.round(Number(get("guest_count").replace(/[,\s]/g, "")));
  if (guests > 0) {
    if (ev.expected_guests == null) {
      update.expected_guests = guests;
      applied.filled.push("Guest count");
    } else if (ev.expected_guests !== guests) applied.differs.push({ field: "Guest count", current: String(ev.expected_guests), answered: String(guests) });
  }
  const venue = get("venue");
  if (venue) {
    if (!ev.venue_name) {
      update.venue_name = venue.slice(0, 200);
      applied.filled.push("Venue");
    } else if (ev.venue_name.trim().toLowerCase() !== venue.toLowerCase()) applied.differs.push({ field: "Venue", current: ev.venue_name, answered: venue });
  }
  if (Object.keys(update).length) await db.from("events").update(update).eq("id", eventId);
  return applied;
}
