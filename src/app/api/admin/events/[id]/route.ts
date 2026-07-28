import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { sendEventContract } from "@/lib/data/events";
import { requireAdmin } from "@/lib/require-admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const { contractDocumentUrl } = body as { contractDocumentUrl?: string };

  if (!contractDocumentUrl) {
    return NextResponse.json({ error: "contractDocumentUrl is required" }, { status: 400 });
  }

  try {
    const event = await sendEventContract(id, contractDocumentUrl);
    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
