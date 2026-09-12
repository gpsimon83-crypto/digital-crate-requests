import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { getCurrentSelection } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

// Viewable by staff and the assigned DJ (same access rule as the rest of
// a project's detail data) — only the separate /approve action is staff-only.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const selection = await getCurrentSelection(id);
    return NextResponse.json({ selection });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
