import { NextRequest, NextResponse } from "next/server";
import { runCalendarSync } from "@/lib/calendar-sync";
import { errorMessage } from "@/lib/error-message";

/**
 * Two-way Google Calendar sync, batched (see vercel.json) rather than
 * pushed inline on every event write — small business, small event count,
 * so a full idempotent reconciliation every run is simpler and more
 * robust than change-tracking, at negligible extra API-call cost.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCalendarSync();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
