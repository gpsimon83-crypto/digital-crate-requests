import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { confirmBooking, type ConfirmDeps } from "@/lib/security/booking-confirmation";
import { processStripeEvent, type StripeHandlerDeps } from "@/lib/security/stripe-webhook";
import { runAdminAction, type BlockStore } from "@/lib/security/admin-actions";
import { submitPublicRequest } from "@/lib/security/inquiry-service";
import { makeDeps, validInquiry } from "./helpers";

function confirmDeps(over: Partial<ConfirmDeps> & { status?: string } = {}): ConfirmDeps {
  return {
    getEvent: async (id) => ({ id, status: over.status ?? "pending", dj_id: "dj1", starts_at: "2026-12-12T23:00:00Z" }),
    hasSignedContract: async () => false,
    depositPaidCents: async () => 0,
    confirmGuarded: async () => ({ result: "confirmed", conflictEventId: null }),
    env: { requireContract: false, requireDeposit: false },
    ...over
  };
}

describe("booking confirmation rules (server-side)", () => {
  it("a new inquiry can't be confirmed by a DJ, only by the office", async () => {
    expect((await confirmBooking({ eventId: "e", isStaff: false }, confirmDeps({ status: "inquiry" }))).status).toBe(403);
    expect((await confirmBooking({ eventId: "e", isStaff: true }, confirmDeps({ status: "inquiry" }))).status).toBe(200);
  });
  it("contract and deposit rules are enforced when turned on", async () => {
    const env = { requireContract: true, requireDeposit: true };
    expect((await confirmBooking({ eventId: "e", isStaff: true }, confirmDeps({ env }))).body.error).toMatch(/contract must be signed/);
    expect((await confirmBooking({ eventId: "e", isStaff: true }, confirmDeps({ env, hasSignedContract: async () => true }))).body.error).toMatch(/deposit/);
    expect((await confirmBooking({ eventId: "e", isStaff: true }, confirmDeps({ env, hasSignedContract: async () => true, depositPaidCents: async () => 50000 }))).status).toBe(200);
  });
  it("a DJ can't be double-booked; only staff may knowingly override", async () => {
    const guarded = vi.fn(async (_id: string, allow: boolean) => (allow ? { result: "confirmed" as const, conflictEventId: null } : { result: "conflict" as const, conflictEventId: "other" }));
    const r = await confirmBooking({ eventId: "e", isStaff: false, allowOverlap: true }, confirmDeps({ confirmGuarded: guarded }));
    expect(r.status).toBe(409);
    expect(guarded).toHaveBeenLastCalledWith("e", false);
    expect((await confirmBooking({ eventId: "e", isStaff: true, allowOverlap: true }, confirmDeps({ confirmGuarded: guarded }))).status).toBe(200);
  });
  it("closed projects can't be confirmed; already-confirmed is a no-op", async () => {
    expect((await confirmBooking({ eventId: "e", isStaff: true }, confirmDeps({ status: "declined" }))).status).toBe(409);
    expect((await confirmBooking({ eventId: "e", isStaff: true }, confirmDeps({ status: "confirmed" }))).body.alreadyConfirmed).toBe(true);
  });
});

function intentEvent(over: Partial<Stripe.PaymentIntent> = {}, id = "evt_1", livemode = true) {
  return {
    id,
    type: "payment_intent.succeeded",
    livemode,
    data: { object: { id: "pi_1", status: "succeeded", amount: 50000, amount_received: 50000, currency: "usd", metadata: { type: "event_payment", eventId: "ev1", kind: "deposit" }, ...over } }
  } as unknown as Stripe.Event;
}

function stripeDeps() {
  const state = new Map<string, "busy" | "done">();
  const recorded: string[] = [];
  const deps: StripeHandlerDeps = {
    ledger: {
      async claim(_p, id) {
        const s = state.get(id);
        if (s) return s;
        state.set(id, "busy");
        return "new";
      },
      async complete(_p, id) {
        state.set(id, "done");
      },
      async release(_p, id) {
        state.delete(id);
      }
    },
    expectLivemode: true,
    eventExists: async () => true,
    recordPayment: async (e, k, a) => {
      recorded.push(`${e}:${k}:${a}`);
    },
    createTip: async () => null,
    boostRequest: async () => null,
    afterPayment: async () => {}
  };
  return { deps, recorded, state };
}

describe("Stripe payments (verified webhook only)", () => {
  it("records a payment once even if Stripe delivers the event twice", async () => {
    const { deps, recorded } = stripeDeps();
    expect((await processStripeEvent(intentEvent(), deps)).result).toBe("processed");
    expect((await processStripeEvent(intentEvent(), deps)).result).toBe("duplicate");
    expect(recorded).toEqual(["ev1:deposit:50000"]);
  });
  it("ignores test-mode events in live, unsucceeded intents, non-USD and unknown projects", async () => {
    const { deps, recorded } = stripeDeps();
    expect((await processStripeEvent(intentEvent({}, "evt_t", false), deps)).result).toBe("wrong_mode");
    expect((await processStripeEvent(intentEvent({ status: "processing" } as never, "evt_p"), deps)).result).toBe("not_applicable");
    expect((await processStripeEvent(intentEvent({ currency: "eur" }, "evt_e"), deps)).result).toBe("not_applicable");
    deps.eventExists = async () => false;
    expect((await processStripeEvent(intentEvent({}, "evt_u"), deps)).result).toBe("unknown_event");
    expect(recorded).toHaveLength(0);
  });
  it("a failure releases the claim so Stripe's retry is processed", async () => {
    const { deps, recorded } = stripeDeps();
    let fail = true;
    deps.recordPayment = async (e, k, a) => {
      if (fail) throw new Error("db down");
      recorded.push(`${e}:${k}:${a}`);
    };
    await expect(processStripeEvent(intentEvent(), deps)).rejects.toThrow();
    fail = false;
    expect((await processStripeEvent(intentEvent(), deps)).result).toBe("processed");
    expect(recorded).toHaveLength(1);
  });
  it("the same PaymentIntent arriving under a new event id isn't double-counted", async () => {
    const { deps } = stripeDeps();
    deps.recordPayment = async () => {
      throw Object.assign(new Error("unique"), { code: "23505" });
    };
    expect((await processStripeEvent(intentEvent({}, "evt_2"), deps)).result).toBe("duplicate_payment");
  });
});

function adminDeps() {
  const base = makeDeps();
  const blockList: { id: string; kind: string; valueHash: string; expiresIso: string; removed?: boolean }[] = [];
  const blocks: BlockStore = {
    async addBlock(b) {
      const id = `blk${blockList.length + 1}`;
      blockList.push({ id, ...b });
      base.repo.blocks.push({ kind: b.kind, hash: b.valueHash, expires: b.expiresIso });
      return id;
    },
    async removeBlock(id) {
      const b = blockList.find((x) => x.id === id && !x.removed);
      if (!b) return false;
      b.removed = true;
      base.repo.blocks = base.repo.blocks.filter((x) => x.hash !== b.valueHash);
      return true;
    }
  };
  return { ...base, adeps: { ...base.deps, blocks }, blockList };
}
const actor = { userId: "u-admin", label: "owner@example.com" };
const ctx = { ip: "203.0.113.7", partner: false };

describe("admin review actions", () => {
  it("approve without email confirmation is allowed but explicitly recorded", async () => {
    const { adeps, repo, activated } = adminDeps();
    await submitPublicRequest("inquiry", validInquiry(), ctx, adeps);
    const id = repo.rows[0].id;
    const r = await runAdminAction({ action: "approve", id }, actor, adeps);
    expect(r.status).toBe(200);
    expect(r.body.message).toMatch(/without email confirmation \(recorded\)/);
    expect(activated).toEqual([id]);
    expect(repo.rows[0].reviewed_by_label).toBe("owner@example.com");
    expect(repo.events.some((e) => e.action === "approved_without_email_verification" && e.actor?.userId === "u-admin")).toBe(true);
    // Approving twice doesn't create a second lead.
    await runAdminAction({ action: "approve", id }, actor, adeps);
    expect(activated).toHaveLength(1);
  });

  it("spam → restore puts it back as pending; restore only works on spam/archived", async () => {
    const { adeps, repo } = adminDeps();
    await submitPublicRequest("inquiry", validInquiry(), ctx, adeps);
    const id = repo.rows[0].id;
    expect((await runAdminAction({ action: "restore", id }, actor, adeps)).status).toBe(409);
    await runAdminAction({ action: "spam", id }, actor, adeps);
    expect(repo.rows[0].status).toBe("spam");
    await runAdminAction({ action: "restore", id }, actor, adeps);
    expect(repo.rows[0].status).toBe("pending_verification");
  });

  it("temporary block stops new submissions from that email silently; unblock lifts it", async () => {
    const { adeps, repo, mail } = adminDeps();
    await submitPublicRequest("inquiry", validInquiry({ email: "pest@example.com" }), ctx, adeps);
    const r = await runAdminAction({ action: "block", id: repo.rows[0].id, kind: "email", hours: 24 }, actor, adeps);
    expect(r.status).toBe(200);
    const blocked = await submitPublicRequest("inquiry", validInquiry({ email: "pest@example.com", eventDate: "2027-01-09" }), { ip: "192.0.2.9", partner: false }, adeps);
    expect(blocked.status).toBe(200); // neutral
    expect(repo.rows[1].status).toBe("spam");
    expect(mail).toHaveLength(1);
    expect((await runAdminAction({ action: "unblock", blockId: "blk1" }, actor, adeps)).status).toBe(200);
    expect((await runAdminAction({ action: "unblock", blockId: "blk1" }, actor, adeps)).status).toBe(404);
  });

  it("blocks are limited to 1 hour – 30 days", async () => {
    const { adeps, repo } = adminDeps();
    await submitPublicRequest("inquiry", validInquiry(), ctx, adeps);
    expect((await runAdminAction({ action: "block", id: repo.rows[0].id, kind: "email", hours: 0 }, actor, adeps)).status).toBe(400);
    expect((await runAdminAction({ action: "block", id: repo.rows[0].id, kind: "email", hours: 10000 }, actor, adeps)).status).toBe(400);
  });

  it("resend respects the 3-per-hour email limit", async () => {
    const { adeps, repo } = adminDeps();
    await submitPublicRequest("inquiry", validInquiry(), ctx, adeps);
    const id = repo.rows[0].id;
    expect((await runAdminAction({ action: "resend", id }, actor, adeps)).status).toBe(200);
    expect((await runAdminAction({ action: "resend", id }, actor, adeps)).status).toBe(200);
    expect((await runAdminAction({ action: "resend", id }, actor, adeps)).status).toBe(429);
  });
});
