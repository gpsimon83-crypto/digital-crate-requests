import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/comm/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseManualPayment, PAYMENT_METHODS } from "@/lib/payment-methods";
import { maybeAdvancePipelineStage } from "@/lib/pipeline-stage";
import { syncPlaybook } from "@/lib/data/playbook";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/error-message";

const missingColumn = (e: unknown) => ["42703", "PGRST204"].includes((e as { code?: string } | null)?.code ?? "");

/** Staff: record a payment the client made outside Stripe (cash, check, Zelle, ...). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffUser();
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const parsed = parseManualPayment(body, today);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const p = parsed.value;

  const db = createAdminClient();
  const { data: ev } = await db.from("events").select("id").eq("id", id).maybeSingle();
  if (!ev) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Midday UTC keeps the paid date on the same calendar day in US time zones.
  const base = { event_id: id, kind: p.kind, amount_cents: p.cents, status: "succeeded", paid_at: `${p.paidOn}T18:00:00.000Z` };
  try {
    let { data, error } = await db
      .from("payments")
      .insert({ ...base, method: p.method, reference: p.reference, note: p.note, recorded_by: staff.userId })
      .select()
      .single();
    // Before migration 0060 the extra columns don't exist; the payment still counts.
    if (error && missingColumn(error)) ({ data, error } = await db.from("payments").insert(base).select().single());
    if (error) throw error;

    await logActivity({
      actorUserId: staff.userId,
      action: "payment.recorded",
      entityType: "event",
      entityId: id,
      eventId: id,
      metadata: { paymentId: (data as { id: string }).id, kind: p.kind, amountCents: p.cents, method: PAYMENT_METHODS[p.method], paidOn: p.paidOn, reference: p.reference }
    });
    if (p.kind === "deposit") await maybeAdvancePipelineStage(id, "Retainer Paid");
    await syncPlaybook(id).catch(() => {}); // e.g. ticks "Retainer paid" on a wedding
    return NextResponse.json({ payment: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
