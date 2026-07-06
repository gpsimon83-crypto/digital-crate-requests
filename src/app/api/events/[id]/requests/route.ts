import { NextRequest, NextResponse } from "next/server";
import { listSongRequests } from "@/lib/data/requests";
import { errorMessage } from "@/lib/error-message";

/** Public read — guests need this for the Vote page and "Hot Right Now". */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const requests = await listSongRequests(id);
    return NextResponse.json({ requests });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
