/**
 * Recommend a Services package and an estimated price from what a client
 * told us (Wedding Basics or Event Basics answers, or the project's own
 * details when there are no answers yet).
 *
 * - The event's category picks which packages are considered.
 * - Hours needed (start to end, plus ceremony / cocktail hour for weddings)
 *   pick the smallest package that covers them; a shortfall is flagged.
 * - What they want (ceremony, cocktail hour, uplighting, mics) adds the
 *   matching add-on at its price, unless the package already includes it
 *   ("Included", never charged twice).
 * - "Starting at" and "Request a quote" packages are flagged as estimates.
 *
 * Pure: no database. Staff and the project's DJ see the result; it is never
 * shown to the client. The DJ payout estimate is added separately, for staff
 * with finance access only.
 */
import type { AdminAddon, AdminCatalog, AdminPackage } from "@/lib/data/catalog";
import { priceLabel } from "@/lib/data/catalog";
import type { Answers } from "@/lib/questionnaire-engine";
import { needsFromAnswers as weddingNeeds } from "@/lib/wedding-recommend";

export type Want = "ceremony" | "cocktail" | "uplighting" | "mic" | "clean" | "background";

export type EventNeeds = {
  /** Services category slug, e.g. "private-parties". */
  category: string;
  guests: number | null;
  hoursNeeded: number | null;
  wants: Want[];
  outdoors: boolean;
  setupAccess: string | null;
  /** A residency (recurring dates). */
  recurring: boolean;
  source: "wedding_basics" | "event_basics" | "project";
};

export type RecAddOn = { addonId: string | null; name: string; priceCents: number; included: boolean; reason: string };
export type RecOption = {
  packageId: string;
  name: string;
  priceLabel: string;
  pricingType: AdminPackage["pricing_type"];
  hours: number | null;
  basePriceCents: number;
  addOns: RecAddOn[];
  /** Package + add-ons not included. Null when the package is quote-only. */
  estimateCents: number | null;
  /** True when the real price is set by quote (starting at / request a quote / confirm first). */
  estimateOnly: boolean;
  best: boolean;
  why: string[];
  watch: string[];
};
export type Recommendation = { category: string; needs: EventNeeds; options: RecOption[]; notes: string[] };

/** events.event_category → Services category slug. */
export function categorySlugFor(eventCategory: string | null | undefined, eventType?: string | null): string {
  const c = (eventCategory ?? "").toLowerCase();
  const t = (eventType ?? "").toLowerCase();
  if (c === "wedding" || /wedding/.test(t)) return "weddings";
  if (c === "school_dance" || /school|prom|homecoming/.test(t)) return "school-events";
  if (c === "bar_nightclub" || /\bbar\b|club|night|lounge|residen/.test(t)) return "bars-nightlife";
  if (c === "corporate" || /corporate|gala|company|conference/.test(t)) return "corporate-events";
  return "private-parties";
}

const hhmm = /^\d{2}:\d{2}$/;
const answer = (a: Answers, k: string): string => {
  const v = a[k];
  return v && !("unsure" in v) && typeof v.value === "string" ? v.value.trim() : "";
};
const answers = (a: Answers, k: string): string[] => {
  const v = a[k];
  return v && !("unsure" in v) && Array.isArray(v.value) ? v.value.filter((x): x is string => typeof x === "string") : [];
};
export function spanHours(start: string, end: string): number | null {
  if (!hhmm.test(start) || !hhmm.test(end)) return null;
  const [x, y] = [start, end].map((t) => +t.slice(0, 2) * 60 + +t.slice(3));
  return ((y - x + 1440) % 1440 || 1440) / 60;
}
const roundHalf = (h: number) => Math.ceil(h * 2) / 2;

export function needsFromWeddingBasics(a: Answers): Omit<EventNeeds, "category" | "recurring"> {
  const n = weddingNeeds(a);
  const wants: Want[] = [];
  if (n.coverage.includes("ceremony")) wants.push("ceremony", "mic");
  if (n.coverage.includes("cocktail")) wants.push("cocktail");
  return { guests: n.guests, hoursNeeded: n.hoursNeeded, wants, outdoors: n.outdoors === "outdoors" || n.outdoors === "both", setupAccess: n.setupAccess, source: "wedding_basics" };
}

export function needsFromEventBasics(a: Answers): Omit<EventNeeds, "category" | "recurring"> {
  const guests = Number(answer(a, "guest_count").replace(/[,\s]/g, ""));
  const span = spanHours(answer(a, "start_time"), answer(a, "end_time"));
  const picked = answers(a, "needs");
  const wants = (["mic", "uplighting", "clean", "background"] as const).filter((w) => picked.includes(w));
  const io = answer(a, "indoor_outdoor");
  return { guests: guests > 0 ? Math.round(guests) : null, hoursNeeded: span == null ? null : roundHalf(span), wants: [...wants], outdoors: io === "outdoors" || io === "both", setupAccess: answer(a, "setup_access") || null, source: "event_basics" };
}

/** No answers yet: the project's own guest count and times. */
export function needsFromProject(ev: { expected_guests: number | null; starts_at: string | null; ends_at: string | null }): Omit<EventNeeds, "category" | "recurring"> {
  let hours: number | null = null;
  if (ev.starts_at && ev.ends_at) {
    const h = (new Date(ev.ends_at).getTime() - new Date(ev.starts_at).getTime()) / 3_600_000;
    if (h > 0 && h <= 24) hours = roundHalf(h);
  }
  return { guests: ev.expected_guests && ev.expected_guests > 0 ? ev.expected_guests : null, hoursNeeded: hours, wants: [], outdoors: false, setupAccess: null, source: "project" };
}

const ADDON_MATCH: Record<"ceremony" | "cocktail" | "uplighting" | "mic", RegExp> = {
  ceremony: /ceremony/i,
  cocktail: /cocktail/i,
  uplighting: /uplight/i,
  mic: /wireless|microphone|\bmics?\b/i
};
const WANT_REASON: Record<"ceremony" | "cocktail" | "uplighting" | "mic", string> = {
  ceremony: "They want the ceremony covered",
  cocktail: "They want cocktail-hour music",
  uplighting: "They asked for room uplighting",
  mic: "Speeches, toasts or announcements"
};
const BIG_ROOM = 300;

/** A package's features, following "Everything in <other package>" into that package (and its own). */
export function allFeatures(p: AdminPackage, all: AdminPackage[], seen = new Set<string>()): string[] {
  if (seen.has(p.id)) return [];
  seen.add(p.id);
  const out: string[] = [];
  for (const f of p.features) {
    const m = /^everything in (?:the )?(.+?)\.?$/i.exec(f.trim());
    const other = m && all.find((x) => x.id !== p.id && x.name.toLowerCase() === m[1].toLowerCase());
    if (other) out.push(...allFeatures(other, all, seen));
    else out.push(f);
  }
  return out;
}

function scorePackage(p: AdminPackage, addons: AdminAddon[], n: EventNeeds, all: AdminPackage[]): Omit<RecOption, "best"> & { score: number } {
  const why: string[] = [];
  const watch: string[] = [];
  let score = 0;
  const features = allFeatures(p, all);
  const feat = features.join(" · ");
  const recAddOns: RecAddOn[] = [];

  if (n.hoursNeeded != null && p.hours != null) {
    if (p.hours >= n.hoursNeeded) {
      // Spare hours cost money: each one counts against it more than an included extra counts for it.
      score += 4 - Math.min(3, p.hours - n.hoursNeeded);
      why.push(`${p.hours} hours covers about ${n.hoursNeeded}`);
    } else {
      const short = roundHalf(n.hoursNeeded - p.hours);
      score -= 2 + short * 2;
      watch.push(`${p.hours} hours; about ${n.hoursNeeded} needed (${short} more: confirm the overtime rate)`);
    }
  }
  if (n.guests != null) {
    const expanded = /expanded sound|large|gala/i.test(`${p.name} ${feat}`);
    if (n.guests >= BIG_ROOM && expanded) {
      score += 2;
      why.push(`Built for a bigger room (${n.guests} guests)`);
    } else if (n.guests >= BIG_ROOM) watch.push(`${n.guests} guests: check the sound covers the room`);
    else if (expanded && n.guests < 200) score -= 1;
  }
  if (n.setupAccess === "house_sound" && /house sound/i.test(`${p.name} ${feat}`)) {
    score += 2;
    why.push("Plays through the venue's house sound");
  }
  if (n.recurring) {
    if (/residen/i.test(p.name)) {
      score += 4;
      why.push("Recurring dates");
    } else if (n.category === "bars-nightlife") score -= 2;
  } else if (/residen/i.test(p.name)) score -= 3;

  for (const w of n.wants) {
    if (w === "clean") {
      if (/clean/i.test(feat)) {
        score += 1;
        why.push("Clean music only");
      } else watch.push("Wants clean music: note it for the DJ");
      continue;
    }
    if (w === "background") continue;
    const re = ADDON_MATCH[w];
    const addon = addons.find((a) => re.test(a.name));
    const included = (addon && p.included_addon_ids.includes(addon.id)) || re.test(feat);
    if (included) {
      score += 0.5;
      recAddOns.push({ addonId: addon?.id ?? null, name: addon?.name ?? features.find((f) => re.test(f)) ?? w, priceCents: 0, included: true, reason: WANT_REASON[w] });
    } else if (addon) {
      recAddOns.push({ addonId: addon.id, name: addon.name, priceCents: Math.round(addon.price * 100), included: false, reason: WANT_REASON[w] });
    } else watch.push(`${WANT_REASON[w]}: no add-on for it in this category`);
  }
  if (n.outdoors) watch.push("Outdoors: confirm power near the DJ and a weather plan");

  const base = Math.round(p.price * 100);
  const extras = recAddOns.filter((a) => !a.included).reduce((s, a) => s + a.priceCents, 0);
  const quoteOnly = p.pricing_type === "quote";
  const estimateOnly = quoteOnly || p.pricing_type === "starting_at" || p.quote_before_payment;
  if (estimateOnly) watch.push(quoteOnly ? "Priced by quote" : "Starting price: confirm the quote before payment");
  // Big-ticket specialty packages (a live band) only when nothing else fits.
  if (/live band/i.test(p.name)) score -= 6;
  return {
    packageId: p.id,
    name: p.name,
    priceLabel: priceLabel(p),
    pricingType: p.pricing_type,
    hours: p.hours,
    basePriceCents: base,
    addOns: recAddOns,
    estimateCents: quoteOnly ? null : base + extras,
    estimateOnly,
    why,
    watch,
    score
  };
}

export function recommendFromCatalog(catalog: AdminCatalog, n: EventNeeds, limit = 3): Recommendation {
  const cat = catalog.categories.find((c) => c.slug === n.category && c.is_active);
  const notes: string[] = [];
  if (n.hoursNeeded != null) notes.push(`About ${n.hoursNeeded} hours of music`);
  if (n.guests != null) notes.push(`About ${n.guests} guests`);
  if (!cat) return { category: n.category, needs: n, options: [], notes: [...notes, "No active Services category for this event type."] };
  const addons = catalog.addons.filter((a) => a.is_active && (a.category_ids.length === 0 || a.category_ids.includes(cat.id)));
  const inCat = catalog.packages.filter((p) => p.is_active && p.categories.some((l) => l.category_id === cat.id));
  // Specialty bundles (a live band) only when there's nothing else.
  const regular = inCat.filter((p) => !/live band/i.test(p.name));
  const pkgs = regular.length ? regular : inCat;
  const scored = pkgs.map((p) => scorePackage(p, addons, n, catalog.packages));
  // Best fit first; then the lower estimate (quote-only last).
  scored.sort((a, b) => b.score - a.score || (a.estimateCents ?? Infinity) - (b.estimateCents ?? Infinity));
  const options = scored.slice(0, limit).map(({ score: _s, ...o }, i) => {
    void _s;
    return { ...o, best: i === 0 };
  });
  return { category: n.category, needs: n, options, notes };
}
