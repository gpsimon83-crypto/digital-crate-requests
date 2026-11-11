import { NextResponse } from "next/server";
import { requireSecurityAdmin } from "@/lib/security/admin-guard";
import { securityOverview, staffAccounts } from "@/lib/security/admin-data";

export const dynamic = "force-dynamic";

/** Inquiry Security dashboard data. Owner/admin only. */
export async function GET() {
  const gate = await requireSecurityAdmin();
  if (!gate.ok) return gate.response;
  try {
    const [overview, staff] = await Promise.all([securityOverview(), staffAccounts().catch(() => [])]);
    return NextResponse.json({ ...overview, staff, viewer: { aal: gate.aal } }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01" || code === "PGRST205") {
      return NextResponse.json({ error: "The security tables aren't set up yet. Apply database migration 0045_inquiry_security.sql." }, { status: 503 });
    }
    return NextResponse.json({ error: "Couldn't load security data." }, { status: 503 });
  }
}
