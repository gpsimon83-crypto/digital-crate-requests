import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { getEvent, sendEventContract, updateEvent } from "@/lib/data/events";
import { listEventPayments, computeBalance } from "@/lib/data/payments";
import { requireAuth } from "@/lib/require-auth";
import { requireAdmin } from "@/lib/require-admin";

const VALID_STATUSES = ["inquiry", "pending_confirmation", "confirmed", "live", "ended", "declined"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  try {
    const event = await getEvent(id);

    let payments: Awaited<ReturnType<typeof listEventPayments>> = [];
    let balance = computeBalance(event, []);
    try {
      payments = await listEventPayments(id);
      balance = computeBalance(event, payments);
    } catch {
      // leave payments/balance at their zeroed defaults
    }

    return NextResponse.json({ event, payments, balance });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const { contractDocumentUrl, status, internalNotes, clientId, sendWeddingMusicPlan } = body as {
    contractDocumentUrl?: string;
    status?: string;
    internalNotes?: string;
    clientId?: string | null;
    sendWeddingMusicPlan?: boolean;
  };

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    if (contractDocumentUrl) {
      await sendEventContract(id, contractDocumentUrl);
    }

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (internalNotes !== undefined) updates.internal_notes = internalNotes;
    if (clientId !== undefined) updates.client_id = clientId || null;
    if (sendWeddingMusicPlan) updates.wedding_music_plan_sent_at = new Date().toISOString();

    const event = Object.keys(updates).length > 0 ? await updateEvent(id, updates) : await getEvent(id);
    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
