import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { listAutomationRuns } from "@/lib/data/automations";
import { requireAdmin } from "@/lib/require-admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  try {
    const runs = await listAutomationRuns(id);
    return NextResponse.json({ runs });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
