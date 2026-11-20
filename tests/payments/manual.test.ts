import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { parseManualPayment } from "@/lib/payment-methods";

type Row = Record<string, unknown>;
let db: Record<string, Row[]> = {};
let noNewColumns = false;
function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let op = "select";
  let payload: Row = {};
  const run = (mode: "many" | "single" | "maybe") => {
    const rows = (db[table] ??= []);
    if (op === "insert") {
      if (noNewColumns && "method" in payload) return { data: null, error: { code: "PGRST204", message: "no column" } };
      const r = { id: `p${rows.length + 1}`, ...payload };
      rows.push(r);
      return { data: r, error: null };
    }
    const hit = rows.filter((r) => filters.every((f) => f(r)));
    if (op === "update") hit.forEach((r) => Object.assign(r, payload));
    if (op === "delete") db[table] = rows.filter((r) => !hit.includes(r));
    return mode === "many" ? { data: hit, error: null } : { data: hit[0] ?? null, error: null };
  };
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    insert: (p: Row) => ((op = "insert"), (payload = p), q),
    update: (p: Row) => ((op = "update"), (payload = p), q),
    delete: () => ((op = "delete"), q),
    maybeSingle: () => Promise.resolve(run("maybe")),
    single: () => Promise.resolve(run("single")),
    then: (res: (v: unknown) => unknown) => Promise.resolve(run("many")).then(res)
  };
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => query(t) }) }));
let staff = true;
vi.mock("@/lib/comm/server", () => ({ requireStaffUser: async () => (staff ? { userId: "u1", email: null } : NextResponse.json({ error: "Admin access required" }, { status: 403 })) }));
const advanced: string[] = [];
vi.mock("@/lib/pipeline-stage", () => ({ maybeAdvancePipelineStage: async (_: string, s: string) => void advanced.push(s) }));
vi.mock("@/lib/data/playbook", () => ({ syncPlaybook: async () => ({}) }));
vi.mock("@/lib/activity", () => ({ logActivity: async () => {} }));

import { POST } from "@/app/api/admin/events/[id]/payments/route";
import { PATCH, DELETE } from "@/app/api/admin/events/[id]/payments/[paymentId]/route";
import { computeBalance } from "@/lib/data/payments";

const post = (b: Row) => POST(new NextRequest("http://x", { method: "POST", body: JSON.stringify(b) }), { params: Promise.resolve({ id: "e1" }) });
const voidIt = (pid: string, reason: string) => PATCH(new NextRequest("http://x", { method: "PATCH", body: JSON.stringify({ action: "void", reason }) }), { params: Promise.resolve({ id: "e1", paymentId: pid }) });
const good = { amount: "1,250.50", kind: "deposit", method: "zelle", paidOn: "2026-11-02", reference: "ZL-88", note: "Paid at the walkthrough" };

beforeEach(() => {
  db = { events: [{ id: "e1" }], payments: [] };
  staff = true;
  noNewColumns = false;
  advanced.length = 0;
});

describe("parseManualPayment", () => {
  it("accepts dollars with commas and rejects bad input", () => {
    expect(parseManualPayment(good, "2026-11-19")).toEqual({ value: { cents: 125050, kind: "deposit", method: "zelle", paidOn: "2026-11-02", reference: "ZL-88", note: "Paid at the walkthrough" } });
    expect(parseManualPayment({ ...good, amount: "0" }, "2026-11-19")).toHaveProperty("error");
    expect(parseManualPayment({ ...good, amount: "abc" }, "2026-11-19")).toHaveProperty("error");
    expect(parseManualPayment({ ...good, method: "bitcoin" }, "2026-11-19")).toHaveProperty("error");
    expect(parseManualPayment({ ...good, paidOn: "2026-12-01" }, "2026-11-19")).toHaveProperty("error");
  });
});

describe("recording a payment", () => {
  it("adds a succeeded payment that counts toward the balance, and moves the stage on a deposit", async () => {
    const r = await post(good);
    expect(r.status).toBe(200);
    expect(db.payments[0]).toMatchObject({ event_id: "e1", kind: "deposit", amount_cents: 125050, status: "succeeded", method: "zelle", reference: "ZL-88", recorded_by: "u1" });
    expect(advanced).toEqual(["Retainer Paid"]);
    const bal = computeBalance({ quoted_amount: null, final_amount: 2500 }, db.payments as never);
    expect(bal).toEqual({ totalDueCents: 250000, paidCents: 125050, balanceCents: 124950 });
  });

  it("is staff-only", async () => {
    staff = false;
    expect((await post(good)).status).toBe(403);
    expect(db.payments.length).toBe(0);
  });

  it("still records the payment before migration 0060", async () => {
    noNewColumns = true;
    expect((await post(good)).status).toBe(200);
    expect(db.payments[0]).toMatchObject({ amount_cents: 125050, status: "succeeded" });
    expect(db.payments[0]).not.toHaveProperty("method");
  });

  it("voids a hand-entered payment with a reason, once; card payments can't be voided", async () => {
    await post(good);
    expect((await voidIt("p1", "")).status).toBe(400);
    expect((await voidIt("p1", "Entered twice")).status).toBe(200);
    expect(db.payments[0]).toMatchObject({ status: "voided", void_reason: "Entered twice", voided_by: "u1" });
    expect(computeBalance({ quoted_amount: null, final_amount: 2500 }, db.payments as never).paidCents).toBe(0);
    expect((await voidIt("p1", "again")).status).toBe(409);
    db.payments.push({ id: "card", event_id: "e1", status: "succeeded", stripe_payment_intent_id: "pi_1", amount_cents: 5000, kind: "balance" });
    expect((await voidIt("card", "oops")).status).toBe(400);
    expect((await voidIt("missing", "oops")).status).toBe(404);
  });
});

describe("removing a payment", () => {
  const del = (pid: string) => DELETE(new NextRequest("http://x", { method: "DELETE" }), { params: Promise.resolve({ id: "e1", paymentId: pid }) });
  it("removes hand-entered payments (voided or not), never card payments, staff only", async () => {
    await post(good);
    await post({ ...good, kind: "balance" });
    await voidIt("p2", "Entered twice");
    db.payments.push({ id: "card", event_id: "e1", status: "succeeded", stripe_payment_intent_id: "pi_1", amount_cents: 5000, kind: "balance" });
    staff = false;
    expect((await del("p1")).status).toBe(403);
    staff = true;
    expect((await del("card")).status).toBe(400);
    expect((await del("p1")).status).toBe(200);
    expect((await del("p2")).status).toBe(200);
    expect((await del("p1")).status).toBe(404);
    expect(db.payments.map((p) => p.id)).toEqual(["card"]);
  });
});
