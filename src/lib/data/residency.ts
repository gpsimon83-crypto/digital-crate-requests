/**
 * Recurring Bar / Club bookings — database side.
 * `ensureGigs` is safe to run any number of times (unique slot per residency).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { accountRole } from "@/lib/roles";
import { hasPermission, resolveUserRole } from "@/lib/data/permissions";
import {
  datesToGenerate,
  gigStatus,
  hhmm,
  nextGig,
  todayIn,
  type Brief,
  type Coverage,
  type Gig,
  type Outcome,
  type Pattern,
  type Schedule
} from "@/lib/residency";

type Db = ReturnType<typeof createAdminClient>;

export type ResidencyRow = Schedule & {
  id: string;
  event_id: string;
  venue_id: string | null;
  name: string;
  timezone: string;
  default_dj_id: string | null;
  venue_fee_cents: number | null;
  dj_payout_cents: number | null;
  money_notes: string | null;
  active: boolean;
  pattern: Pattern;
};

export type GigRow = Gig & {
  residency_id: string;
  event_id: string;
  cancel_reason: string | null;
  change_note: string | null;
  dj_responded_at: string | null;
  venue_fee_cents: number | null;
  dj_payout_cents: number | null;
};

export type RecapRow = {
  id: string;
  gig_id: string;
  residency_id: string;
  event_id: string;
  dj_id: string | null;
  picked_up: string;
  worked: string;
  next_dj: string;
  issue: string | null;
  issue_resolved_at: string | null;
  submitted_at: string;
};

const RES_COLS = "id, event_id, venue_id, name, pattern, weekday, weeks, start_time, end_time, starts_on, ends_on, timezone, default_dj_id, venue_fee_cents, dj_payout_cents, money_notes, active";
export const MONEY_KEYS = ["venue_fee_cents", "dj_payout_cents", "money_notes"] as const;

const norm = <T extends { start_time: string; end_time: string }>(r: T): T => ({ ...r, start_time: hhmm(r.start_time), end_time: hhmm(r.end_time) });

/** Is the table there yet (migration 0061)? */
export const missingTable = (e: unknown) => ["42P01", "PGRST205", "PGRST200"].includes((e as { code?: string } | null)?.code ?? "");

export async function loadResidency(db: Db, eventId: string): Promise<ResidencyRow | null> {
  const { data, error } = await db.from("residencies").select(RES_COLS).eq("event_id", eventId).maybeSingle();
  if (error) {
    if (missingTable(error)) return null;
    throw error;
  }
  return data ? norm(data as unknown as ResidencyRow) : null;
}

export async function listGigs(db: Db, residencyId: string): Promise<GigRow[]> {
  const { data, error } = await db.from("residency_gigs").select("*").eq("residency_id", residencyId).order("gig_date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as GigRow[]).map(norm);
}

/** Create the schedule's dates from today to the horizon that don't exist yet. */
export async function ensureGigs(db: Db, r: ResidencyRow, existing?: GigRow[]) {
  if (!r.active) return 0;
  const gigs = existing ?? (await listGigs(db, r.id));
  const today = todayIn(r.timezone);
  const dates = datesToGenerate(r, gigs.map((g) => g.slot_date), today);
  if (!dates.length) return 0;
  const rows = dates.map((d) => ({
    residency_id: r.id,
    event_id: r.event_id,
    slot_date: d,
    gig_date: d,
    start_time: r.start_time,
    end_time: r.end_time,
    dj_id: r.default_dj_id,
    coverage: (r.default_dj_id ? "awaiting" : "unassigned") as Coverage,
    source: "schedule"
  }));
  // Another request generating at the same moment: the unique slot keeps one.
  const { error } = await db.from("residency_gigs").upsert(rows, { onConflict: "residency_id,slot_date", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

export async function financeAccess(): Promise<{ view: boolean; manage: boolean; userId: string | null }> {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { view: false, manage: false, userId: null };
    const role = await resolveUserRole(user.id, accountRole(user));
    if (!role) return { view: false, manage: false, userId: user.id };
    const [view, manage] = await Promise.all([hasPermission(role, "finance.view_company"), hasPermission(role, "finance.manage")]);
    return { view: view || manage, manage, userId: user.id };
  } catch {
    return { view: false, manage: false, userId: null };
  }
}

export async function loadBrief(db: Db, venueId: string | null) {
  if (!venueId) return { venue: null, brief: {} as Brief, pins: [] as { id: string; text: string; gig_date: string | null; recap_id: string | null }[] };
  const { data: v } = await db.from("venues").select("id, name, location, city, state, cover_url, cover_focus, scheduling_prefs").eq("id", venueId).maybeSingle();
  let brief: Brief = {};
  {
    const { data, error } = await db.from("venues").select("dj_brief").eq("id", venueId).maybeSingle();
    if (!error) brief = ((data as { dj_brief?: Brief } | null)?.dj_brief ?? {}) as Brief;
  }
  // Fall back to what the venue told us in its portal, until staff write a brief.
  const prefs = ((v as { scheduling_prefs?: Record<string, string> } | null)?.scheduling_prefs ?? {}) as Record<string, string>;
  if (!brief.music && prefs.music_notes) brief = { ...brief, music: prefs.music_notes };
  if (!brief.load_in && prefs.setup_notes) brief = { ...brief, load_in: prefs.setup_notes };
  const { data: pins } = await db.from("venue_brief_pins").select("id, text, gig_date, recap_id").eq("venue_id", venueId).order("created_at", { ascending: true });
  return { venue: v as { id: string; name: string; location: string | null; city: string | null; state: string | null; cover_url: string | null; cover_focus: unknown } | null, brief, pins: (pins ?? []) as { id: string; text: string; gig_date: string | null; recap_id: string | null }[] };
}

export type GigView = GigRow & { djName: string | null; status: { label: string; tone: string }; recapId: string | null; issueOpen: boolean };

/** Everything the residency project page shows. Money only with finance access. */
export async function residencyView(eventId: string, opts: { finance: boolean }) {
  const db = createAdminClient();
  const r = await loadResidency(db, eventId);
  if (!r) return null;
  let gigs = await listGigs(db, r.id);
  if (await ensureGigs(db, r, gigs)) gigs = await listGigs(db, r.id);
  const today = todayIn(r.timezone);
  const { data: djRows } = await db.from("djs").select("id, display_name, photo_url").order("display_name");
  const djs = (djRows ?? []) as { id: string; display_name: string; photo_url: string | null }[];
  const djName = (id: string | null) => (id ? (djs.find((d) => d.id === id)?.display_name ?? "DJ") : null);
  const { data: recapRows } = await db.from("residency_recaps").select("*").eq("residency_id", r.id).order("submitted_at", { ascending: false });
  const recaps = (recapRows ?? []) as RecapRow[];
  const recapBy = new Map(recaps.map((x) => [x.gig_id, x]));
  const views: GigView[] = gigs.map((g) => {
    const rc = recapBy.get(g.id) ?? null;
    const v = { ...g, djName: djName(g.dj_id), status: gigStatus(g, !!rc, today), recapId: rc?.id ?? null, issueOpen: !!rc?.issue && !rc.issue_resolved_at };
    if (!opts.finance) {
      v.venue_fee_cents = null;
      v.dj_payout_cents = null;
    }
    return v;
  });
  const { venue, brief, pins } = await loadBrief(db, r.venue_id);
  const { data: playsHere } = r.venue_id ? await db.from("venue_djs").select("dj_id").eq("venue_id", r.venue_id) : { data: [] };
  const residency: Partial<ResidencyRow> = { ...r };
  if (!opts.finance) for (const k of MONEY_KEYS) delete residency[k];
  const next = nextGig(views, today);
  const prior = [...views].filter((g) => g.gig_date < today && g.outcome !== "canceled").sort((a, b) => b.gig_date.localeCompare(a.gig_date))[0] ?? null;
  return {
    residency,
    venue,
    brief,
    pins,
    today,
    gigs: views,
    nextGigId: next?.id ?? null,
    priorGigId: prior?.id ?? null,
    recaps: recaps.map((x) => ({ ...x, gig_date: gigs.find((g) => g.id === x.gig_id)?.gig_date ?? null, djName: djName(x.dj_id) })),
    djs: djs.map((d) => ({ ...d, playsHere: ((playsHere ?? []) as { dj_id: string }[]).some((p) => p.dj_id === d.id) })),
    finance: opts.finance
  };
}

/** The DJ's login → DJ profile id. */
export async function djIdForUser(db: Db, userId: string) {
  const { data } = await db.from("djs").select("id, display_name").eq("auth_user_id", userId).maybeSingle();
  return (data as { id: string; display_name: string } | null) ?? null;
}

/** In-app notification to a DJ (bell). Never throws. */
export async function notifyDj(db: Db, djId: string, n: { title: string; body: string; eventId: string; gigId: string }) {
  try {
    const { data } = await db.from("djs").select("auth_user_id").eq("id", djId).maybeSingle();
    const uid = (data as { auth_user_id: string | null } | null)?.auth_user_id;
    if (!uid) return;
    await db.from("notifications").insert({ user_id: uid, type: "dj_assignment_pending", title: n.title, body: n.body, entity_type: "residency_gig", entity_id: n.gigId, event_id: n.eventId });
  } catch {
    // the bookings page still lists it
  }
}

export type { Coverage, Outcome };
