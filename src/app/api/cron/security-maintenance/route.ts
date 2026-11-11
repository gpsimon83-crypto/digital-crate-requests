import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAuthorized } from "@/lib/security/cron-auth";

/**
 * Daily retention job: releases expired call holds, archives requests whose
 * confirmation link expired, and deletes personal data from inquiries that
 * never became leads after INQUIRY_RETENTION_DAYS (default 90), plus
 * security history older than SECURITY_LOG_RETENTION_DAYS (default 365).
 * Leads, clients and bookings are never touched.
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = (name: string, fallback: number) => {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v >= 7 ? Math.floor(v) : fallback;
  };
  const { data, error } = await createAdminClient().rpc("security_maintenance", {
    p_submission_days: days("INQUIRY_RETENTION_DAYS", 90),
    p_log_days: days("SECURITY_LOG_RETENTION_DAYS", 365)
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ ok: true, result: data });
}
