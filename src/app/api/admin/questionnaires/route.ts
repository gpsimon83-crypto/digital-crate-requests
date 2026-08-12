import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { listTemplatesForAdmin } from "@/lib/data/questionnaires";
import { errorMessage } from "@/lib/error-message";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const templates = await listTemplatesForAdmin();
    return NextResponse.json({ templates });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
