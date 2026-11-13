/**
 * Venue locations: one venue (one portal) with several places, e.g. North 48
 * Cedarburg and North 48 Oconomowoc. Each location lists how it's written on
 * the shared DCDJ calendar; nights are tagged with the location they match.
 * Safe to import in client code.
 */
import { fold } from "./calendar-options";

export interface VenueLocation {
  id: string;
  name: string;
  city: string | null;
  calendar_names: string[];
  /** Gets nights that only match the venue's own name (no location in the title). */
  is_default: boolean;
}

/** What the venue's browser gets: no calendar names. */
export type PublicLocation = Pick<VenueLocation, "id" | "name" | "city" | "is_default">;

export const MAX_LOCATIONS = 8;
const ID = /^loc_[a-z0-9]{3,32}$/;

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Cleans a saved/posted list: unique ids and names, at most one default, trimmed calendar names. */
export function normalizeLocations(v: unknown): VenueLocation[] {
  if (!Array.isArray(v)) return [];
  const out: VenueLocation[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = clean(r.name, 60);
    if (name.length < 2 || names.has(fold(name))) continue;
    let id = typeof r.id === "string" && ID.test(r.id) ? r.id : `loc_${fold(name).replace(/[^a-z0-9]+/g, "").slice(0, 24) || "x"}`;
    while (ids.has(id)) id = `${id}${out.length}`;
    const cal = Array.isArray(r.calendar_names) ? r.calendar_names : [];
    const seen = new Set<string>();
    const calendar_names = cal
      .map((c) => clean(c, 80))
      .filter((c) => c.length >= 2 && !c.includes("|") && (seen.has(fold(c)) ? false : (seen.add(fold(c)), true)))
      .slice(0, 8);
    ids.add(id);
    names.add(fold(name));
    out.push({ id, name, city: clean(r.city, 60) || null, calendar_names, is_default: !!r.is_default });
    if (out.length >= MAX_LOCATIONS) break;
  }
  let seenDefault = false;
  for (const l of out) {
    if (l.is_default && seenDefault) l.is_default = false;
    if (l.is_default) seenDefault = true;
  }
  return out;
}

export const toPublicLocations = (locs: VenueLocation[]): PublicLocation[] => locs.map(({ id, name, city, is_default }) => ({ id, name, city, is_default }));

/** All location calendar names, longest first, so "North 48 Ocon" is tried before "North 48". */
export function locationSearchNames(locs: VenueLocation[]): string[] {
  const seen = new Set<string>();
  return locs
    .flatMap((l) => l.calendar_names)
    .sort((a, b) => b.length - a.length)
    .filter((n) => (seen.has(fold(n)) ? false : (seen.add(fold(n)), true)));
}

const defaultId = (locs: VenueLocation[]) => locs.find((l) => l.is_default)?.id ?? null;

/** Location of a calendar night from the name the calendar matched; the default location when it matched only the venue name. */
export function locationForMatched(locs: VenueLocation[], matched: string | null | undefined): string | null {
  if (!locs.length) return null;
  const m = fold(String(matched ?? "")).trim();
  const hit = m ? locs.find((l) => l.calendar_names.some((c) => fold(c) === m)) : undefined;
  return hit?.id ?? defaultId(locs);
}

/** Location of free text (a calendar title or a project's venue name): the longest calendar name it contains, else the default. */
export function locationForText(locs: VenueLocation[], text: string | null | undefined): string | null {
  if (!locs.length) return null;
  const t = fold(String(text ?? ""));
  let best: { id: string; len: number } | null = null;
  for (const l of locs) {
    for (const c of [...l.calendar_names, l.name]) {
      const k = fold(c);
      if (k.length >= 3 && t.includes(k) && (!best || k.length > best.len)) best = { id: l.id, len: k.length };
    }
  }
  return best?.id ?? defaultId(locs);
}

/** Reads venues.locations; [] when the column isn't there yet (migration 0049 not run). */
export async function loadLocations(db: unknown, venueId: string): Promise<{ locations: VenueLocation[]; ready: boolean }> {
  type Q = { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } } };
  try {
    const { data, error } = await (db as { from: (t: string) => Q }).from("venues").select("locations").eq("id", venueId).maybeSingle();
    if (error) return { locations: [], ready: false };
    return { locations: normalizeLocations((data as { locations?: unknown } | null)?.locations), ready: true };
  } catch {
    return { locations: [], ready: false };
  }
}
