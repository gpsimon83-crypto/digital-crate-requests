import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createDraftFromTemplate } from "@/lib/data/contracts";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/error-message";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const { templateId } = (await req.json()) as { templateId?: string };
  if (!templateId) return NextResponse.json({ error: "templateId is required" }, { status: 400 });

  try {
    const contract = await createDraftFromTemplate(id, templateId, req.nextUrl.origin);
    await logActivity({ action: "contract.drafted", entityType: "contract", entityId: contract.id, eventId: id });
    return NextResponse.json({ contract });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
