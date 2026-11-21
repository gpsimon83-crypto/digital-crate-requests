import type { Brief, Coverage, Outcome, Pattern } from "@/lib/residency";

export type ResGig = {
  id: string;
  slot_date: string;
  gig_date: string;
  start_time: string;
  end_time: string;
  dj_id: string | null;
  djName: string | null;
  coverage: Coverage;
  outcome: Outcome;
  notes: string | null;
  source: "schedule" | "manual";
  detached: boolean;
  off_schedule: boolean;
  change_note: string | null;
  cancel_reason: string | null;
  venue_fee_cents: number | null;
  dj_payout_cents: number | null;
  status: { label: string; tone: "neutral" | "approved" | "pending" | "declined" | "info" };
  recapId: string | null;
  issueOpen: boolean;
};

export type ResRecap = {
  id: string;
  gig_id: string;
  gig_date: string | null;
  djName: string | null;
  picked_up: string;
  worked: string;
  next_dj: string;
  issue: string | null;
  issue_resolved_at: string | null;
  submitted_at: string;
};

export type ResidencyData = {
  residency: {
    id: string;
    name: string;
    pattern: Pattern;
    weekday: number | null;
    weeks: number[];
    start_time: string;
    end_time: string;
    starts_on: string;
    ends_on: string | null;
    timezone: string;
    default_dj_id: string | null;
    venue_id: string | null;
    active: boolean;
    venue_fee_cents?: number | null;
    dj_payout_cents?: number | null;
    money_notes?: string | null;
  };
  venue: { id: string; name: string; location: string | null; city: string | null; state: string | null; cover_url: string | null } | null;
  brief: Brief;
  pins: { id: string; text: string; gig_date: string | null; recap_id: string | null }[];
  today: string;
  gigs: ResGig[];
  nextGigId: string | null;
  priorGigId: string | null;
  recaps: ResRecap[];
  djs: { id: string; display_name: string; photo_url: string | null; playsHere: boolean }[];
  finance: boolean;
  canManageMoney: boolean;
};

export async function api(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: r.ok, data };
}
export const errOf = (d: Record<string, unknown>, fallback = "Something went wrong.") => (typeof d.error === "string" ? d.error : fallback);
export const money = (c: number | null | undefined) => (c == null ? "—" : `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`);
