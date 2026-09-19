import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { requirePortalReadAccess } from "@/lib/require-portal-access";
import { listEventFiles } from "@/lib/data/event-files";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requirePortalReadAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const files = await listEventFiles(id);
    // The contract already has its own dedicated card on this page (with
    // the e-sign flow); the generic file list only needs everything else,
    // so a contract added here doesn't show up twice.
    const nonContractFiles = files.filter((f) => f.category !== "contract");

    return NextResponse.json({ files: nonContractFiles });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
