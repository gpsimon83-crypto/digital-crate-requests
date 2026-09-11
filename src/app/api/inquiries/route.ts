import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createInquiry } from "@/lib/data/inquiries";
import { sendInquiryAlertSms } from "@/lib/send-sms";
import { sendSystemEmail } from "@/lib/send-system-email";
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

    try {
      const firstName = name.trim().split(" ")[0] || name;
      const signupUrl = `${req.nextUrl.origin}/portal/signup`;
      const text =
        `Hi ${firstName},\n\n` +
        `Thanks for reaching out to Digital Crate DJs! We've received your ${eventType.toLowerCase()} inquiry` +
        `${eventDate ? ` for ${new Date(eventDate).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}` : ""}` +
        ` and our team will be in touch within 24 hours to confirm details.\n\n` +
        `In the meantime, you can create a free account to track your event, sign your contract, manage payments, ` +
        `and build your "must play / do not play" song list — all in one place:\n\n${signupUrl}\n\n` +
        `Important: sign up with this exact email address (${email}) so it connects automatically to your event.\n\n` +
        `Talk soon,\nDigital Crate DJs`;
      await sendSystemEmail({ to: email, subject: "We got your booking request — set up your event portal", text });
    } catch (err) {
      // Best-effort — an unconfigured/failed system email should never take down inquiry creation.
      // The WordPress site's own fallback email covers this case when this CRM call fails outright.
      // Still logged (unlike a silent swallow) so a Resend/domain misconfig shows up in Vercel logs.
      console.error("sendSystemEmail failed for inquiry", event.id, err);
    }

    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
