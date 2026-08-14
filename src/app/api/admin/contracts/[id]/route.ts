import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { sendContract, voidContract, updateDraftBody } from "@/lib/data/contracts";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/error-message";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const { action, body, reason } = (await req.json()) as { action?: "send" | "void" | "edit"; body?: string; reason?: string };

  try {
    if (action === "send") {
      const contract = await sendContract(id);
      await logActivity({ action: "contract.sent", entityType: "contract", entityId: id, eventId: contract.event_id });
      return NextResponse.json({ contract });
    }
    if (action === "void") {
      const contract = await voidContract(id, reason);
      await logActivity({ action: "contract.voided", entityType: "contract", entityId: id, eventId: contract.event_id, metadata: { reason } });
      return NextResponse.json({ contract });
    }
    if (action === "edit") {
      if (!body?.trim()) return NextResponse.json({ error: "Body is required" }, { status: 400 });
      const contract = await updateDraftBody(id, body.trim());
      return NextResponse.json({ contract });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
