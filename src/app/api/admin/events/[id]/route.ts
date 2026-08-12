import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { getEvent, sendEventContract, updateEvent } from "@/lib/data/events";
import { listEventPayments, computeBalance } from "@/lib/data/payments";
import { requireAdmin } from "@/lib/require-admin";
import { requireEventAccess } from "@/lib/require-event-access";
import { PIPELINE_STAGES } from "@/lib/pipeline-stage";

const VALID_STATUSES = ["inquiry", "pending_confirmation", "confirmed", "live", "ended", "declined"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Staff see every project; a DJ only sees projects assigned to them —
  // this route previously only checked "is signed in", which let any DJ
  // fetch any other DJ's project by guessing/knowing its id.
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

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
  const { contractDocumentUrl, status, pipelineStage, internalNotes, clientId, sendWeddingMusicPlan } = body as {
    contractDocumentUrl?: string;
    status?: string;
    pipelineStage?: string;
    internalNotes?: string;
    clientId?: string | null;
    sendWeddingMusicPlan?: boolean;
  };

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (pipelineStage && !(PIPELINE_STAGES as readonly string[]).includes(pipelineStage)) {
    return NextResponse.json({ error: "Invalid pipeline stage" }, { status: 400 });
  }

  try {
    if (contractDocumentUrl) {
      await sendEventContract(id, contractDocumentUrl);
    }

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (pipelineStage) updates.pipeline_stage = pipelineStage;
    if (internalNotes !== undefined) updates.internal_notes = internalNotes;
    if (clientId !== undefined) updates.client_id = clientId || null;
    if (sendWeddingMusicPlan) updates.wedding_music_plan_sent_at = new Date().toISOString();

    const event = Object.keys(updates).length > 0 ? await updateEvent(id, updates) : await getEvent(id);
    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
