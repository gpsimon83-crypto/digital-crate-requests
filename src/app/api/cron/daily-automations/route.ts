import { NextRequest, NextResponse } from "next/server";
import { runDateBasedAutomations } from "@/lib/automations-engine";

/**
 * Runs once daily (see vercel.json) to fire date-based automations
 * ("7 days before the event," "1 day after," etc.) — see the auth pattern
 * note in /api/cron/check-email, which this mirrors.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = `https://${req.headers.get("host") ?? "www.cratesdjs.com"}`;
  const result = await runDateBasedAutomations(origin);
  return NextResponse.json(result);
}
