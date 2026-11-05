import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_RECIPIENTS_PER_SEND,
  providerStatus,
  recipientWarnings,
  recipientsForAddresses,
  recipientsForClients,
  requireStaffUser,
  sendDesign,
  isValidEmail
} from "@/lib/comm/server";
import { SAMPLE_MERGE_VALUES, sanitizeDesign } from "@/lib/comm/blocks";

export const maxDuration = 60;

interface SendBody {
  designId: string;
  design: unknown;
  test?: boolean;
  testEmail?: string;
  clientIds?: string[];
  emails?: string[];
  eventId?: string | null;
  /** Only send when true; otherwise the route just returns the pre-send check. */
  confirm?: boolean;
}

/**
 * Test sends go only to the signed-in admin (or an address they type)
 * using sample data. Real sends personalize each copy from that
 * recipient's own CRM records, and run a pre-send check first: the
 * client must explicitly confirm after seeing who is missing data.
 */
export async function POST(req: NextRequest) {
  const auth = await requireStaffUser();
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => null)) as SendBody | null;
  if (!body?.designId) return NextResponse.json({ error: "Save the design first." }, { status: 400 });
  const design = sanitizeDesign(body.design);
  if (!providerStatus().configured) {
    return NextResponse.json({ error: "Email sending isn't set up yet. See Communications → Settings." }, { status: 412 });
  }

  try {
    const db = createAdminClient();
    const { data: exists } = await db.from("comm_email_designs").select("id").eq("id", body.designId).is("archived_at", null).maybeSingle();
    if (!exists) return NextResponse.json({ error: "Design not found" }, { status: 404 });

    if (body.test) {
      const to = (body.testEmail || auth.email || "").trim();
      if (!isValidEmail(to)) return NextResponse.json({ error: "Enter an email address for the test." }, { status: 400 });
      const result = await sendDesign({
        designId: body.designId,
        design,
        isTest: true,
        userId: auth.userId,
        recipients: [{ email: to, name: null, clientId: null, eventId: null, values: SAMPLE_MERGE_VALUES }]
      });
      return NextResponse.json({ result, to });
    }

    const clientIds = Array.isArray(body.clientIds) ? body.clientIds.filter((x) => typeof x === "string").slice(0, MAX_RECIPIENTS_PER_SEND) : [];
    const emails = Array.isArray(body.emails) ? body.emails.filter((x) => typeof x === "string").slice(0, MAX_RECIPIENTS_PER_SEND) : [];
    const recipients = [...(await recipientsForClients(clientIds, body.eventId ?? null)), ...recipientsForAddresses(emails)];
    if (!recipients.length) return NextResponse.json({ error: "Choose at least one recipient with a valid email address." }, { status: 400 });
    if (recipients.length > MAX_RECIPIENTS_PER_SEND) {
      return NextResponse.json({ error: `Send to ${MAX_RECIPIENTS_PER_SEND} people or fewer at a time.` }, { status: 400 });
    }

    const warnings = recipientWarnings(design, recipients);
    if (!body.confirm) {
      return NextResponse.json({ check: { recipientCount: recipients.length, warnings } });
    }
    const result = await sendDesign({ designId: body.designId, design, isTest: false, userId: auth.userId, recipients });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
