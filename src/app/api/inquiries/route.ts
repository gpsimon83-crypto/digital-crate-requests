import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createInquiry } from "@/lib/data/inquiries";
import { sendInquiryAlertSms } from "@/lib/send-sms";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { runAutomations } from "@/lib/automations-engine";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, eventDate, eventType, preferredDjId } = body;

  if (!name || !email || !eventDate || !eventType) {
    return NextResponse.json({ error: "name, email, eventDate, and eventType are required" }, { status: 400 });
  }

  try {
    const event = await createInquiry(body);

    await logActivity({ actorLabel: "Website inquiry form", action: "lead.created", entityType: "event", entityId: event.id, eventId: event.id });
    await runAutomations("lead_created", event.id, req.nextUrl.origin);

    try {
      let djName: string | null = null;
      if (preferredDjId) {
        const db = createAdminClient();
        const { data: dj } = await db.from("djs").select("display_name").eq("id", preferredDjId).maybeSingle();
        djName = dj?.display_name ?? null;
      }
      await sendInquiryAlertSms({ name, eventDate, eventType, djName });
    } catch {
      // Best-effort ops alert — a failed/unconfigured SMS should never take down inquiry creation.
    }

    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
