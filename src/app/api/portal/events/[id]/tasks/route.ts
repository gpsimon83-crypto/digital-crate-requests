import { NextRequest, NextResponse } from "next/server";
import { requirePortalReadAccess } from "@/lib/require-portal-access";
import { playbookView } from "@/lib/data/playbook";
import { errorMessage } from "@/lib/error-message";

/**
 * The client's own playbook steps (same task records as the Tasks tab):
 * signing and paying before the handoff, then their planning checklist.
 * Read-only: these complete from the actual contract, payment,
 * questionnaire and music plan.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requirePortalReadAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const view = await playbookView(id, "client");
    if (!view.isWedding) return NextResponse.json({ tasks: [], handedOff: false });
    const tasks = view.tasks
      .filter((t) => view.handedOff || t.stage === 3)
      .map((t) => ({ id: t.id, title: t.title, nextMove: t.nextMove, status: t.status, due_date: t.due_date, link: t.link, stage: t.stage }));
    return NextResponse.json({ tasks, handedOff: view.handedOff }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
