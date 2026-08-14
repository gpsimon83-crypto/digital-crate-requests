import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { grantPermission, revokePermission } from "@/lib/data/permissions";
import { requirePermission } from "@/lib/require-permission";

export async function POST(req: NextRequest) {
  const denied = await requirePermission("permissions.manage");
  if (denied) return denied;

  const body = await req.json();
  const { role, capability, granted } = body as { role?: string; capability?: string; granted?: boolean };
  if (!role || !capability || typeof granted !== "boolean") {
    return NextResponse.json({ error: "role, capability, and granted are required" }, { status: 400 });
  }

  try {
    if (granted) await grantPermission(role, capability);
    else await revokePermission(role, capability);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
