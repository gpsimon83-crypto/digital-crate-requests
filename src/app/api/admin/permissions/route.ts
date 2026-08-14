import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { listPermissions } from "@/lib/data/permissions";
import { requireAdmin } from "@/lib/require-admin";

// Any staff member can view the matrix — only permissions.manage can change
// it (enforced on the PATCH route below).
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const permissions = await listPermissions();
    return NextResponse.json({ permissions });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
