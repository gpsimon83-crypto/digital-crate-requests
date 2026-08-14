import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { listContractsForEvent } from "@/lib/data/contracts";
import { errorMessage } from "@/lib/error-message";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const contracts = await listContractsForEvent(id);
    return NextResponse.json({ contracts });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
