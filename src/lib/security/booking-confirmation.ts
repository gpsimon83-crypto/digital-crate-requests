import { createAdminClient } from "@/lib/supabase/admin";

export interface ConfirmDeps {
  getEvent(id: string): Promise<{ id: string; status: string; dj_id: string | null; starts_at: string | null } | null>;
  hasSignedContract(id: string): Promise<boolean>;
  depositPaidCents(id: string): Promise<number>;
  /** Atomic, per-DJ serialised confirm (database function confirm_event_guarded). */
  confirmGuarded(id: string, allowOverlap: boolean): Promise<{ result: "confirmed" | "already" | "conflict" | "not_found"; conflictEventId: string | null }>;
  env: { requireContract: boolean; requireDeposit: boolean };
}

export interface ConfirmResult {
  status: number;
  body: { ok?: boolean; error?: string; conflictEventId?: string; alreadyConfirmed?: boolean };
}

export function confirmationRulesFromEnv() {
  return {
    requireContract: process.env.BOOKING_REQUIRE_SIGNED_CONTRACT === "true",
    requireDeposit: process.env.BOOKING_REQUIRE_DEPOSIT === "true"
  };
}

/**
 * The only way a booking becomes "confirmed". Enforced on the server:
 * - a public inquiry needs office (staff) approval — a DJ alone, or the
 *   inquiry form itself, can never confirm one;
 * - optional business rules: signed contract and/or a deposit received
 *   (recorded only by the verified Stripe webhook);
 * - the assigned DJ can't be double-booked by two confirmations racing.
 */
export async function confirmBooking(input: { eventId: string; isStaff: boolean; allowOverlap?: boolean }, deps: ConfirmDeps): Promise<ConfirmResult> {
  const event = await deps.getEvent(input.eventId);
  if (!event) return { status: 404, body: { error: "Project not found" } };
  if (event.status === "confirmed" || event.status === "live") return { status: 200, body: { ok: true, alreadyConfirmed: true } };
  if (event.status === "declined" || event.status === "ended") {
    return { status: 409, body: { error: "This project is closed. Reopen it before confirming." } };
  }
  if (event.status === "inquiry" && !input.isStaff) {
    return { status: 403, body: { error: "New inquiries need office approval before they can be confirmed." } };
  }
  if (deps.env.requireContract && !(await deps.hasSignedContract(event.id))) {
    return { status: 409, body: { error: "The contract must be signed before this booking can be confirmed." } };
  }
  if (deps.env.requireDeposit && (await deps.depositPaidCents(event.id)) <= 0) {
    return { status: 409, body: { error: "A deposit must be received before this booking can be confirmed." } };
  }
  const r = await deps.confirmGuarded(event.id, !!input.allowOverlap && input.isStaff);
  if (r.result === "not_found") return { status: 404, body: { error: "Project not found" } };
  if (r.result === "conflict") {
    return {
      status: 409,
      body: { error: "The assigned DJ already has a confirmed booking at an overlapping time.", conflictEventId: r.conflictEventId ?? undefined }
    };
  }
  return { status: 200, body: { ok: true, alreadyConfirmed: r.result === "already" } };
}

export const supabaseConfirmDeps = (): ConfirmDeps => ({
  async getEvent(id) {
    const { data } = await createAdminClient().from("events").select("id, status, dj_id, starts_at").eq("id", id).maybeSingle();
    return data;
  },
  async hasSignedContract(id) {
    const { data } = await createAdminClient().from("contracts").select("id").eq("event_id", id).eq("status", "signed").limit(1);
    return (data ?? []).length > 0;
  },
  async depositPaidCents(id) {
    const { data } = await createAdminClient().from("payments").select("amount_cents").eq("event_id", id).eq("kind", "deposit").eq("status", "succeeded");
    return (data ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  },
  async confirmGuarded(id, allowOverlap) {
    const { data, error } = await createAdminClient().rpc("confirm_event_guarded", { p_event_id: id, p_allow_overlap: allowOverlap });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { result: string; conflict_event_id: string | null } | undefined;
    return { result: (row?.result ?? "not_found") as "confirmed" | "already" | "conflict" | "not_found", conflictEventId: row?.conflict_event_id ?? null };
  },
  env: confirmationRulesFromEnv()
});
