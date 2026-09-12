import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { setDealEligibility } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

// Body: { packageTemplateIds: string[] } — replaces the full eligibility set for this deal.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  try {
    await setDealEligibility(id, body.packageTemplateIds ?? []);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
