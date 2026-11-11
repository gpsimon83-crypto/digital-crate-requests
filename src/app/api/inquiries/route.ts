import { NextRequest, NextResponse } from "next/server";
import { productionDeps, submitPublicRequest } from "@/lib/security/inquiry-service";
import { readJson, requestContext } from "@/lib/security/request-context";

/**
 * Public booking inquiry (cratesdjs.com form, and digitalcratedjs.com
 * server-to-server with INQUIRY_PARTNER_SECRET).
 *
 * Nothing becomes a lead here. The request is validated, checked
 * (Turnstile, rate limits, honeypot, duplicates, spam signals) and saved as
 * "pending verification"; the lead is created, and staff/DJ notifications
 * and follow-ups start, only after the person confirms their email
 * (/api/inquiries/verify) and any required admin review.
 */
export async function POST(req: NextRequest) {
  const ctx = requestContext(req.headers);
  const body = await readJson(req);
  try {
    const result = await submitPublicRequest("inquiry", body, ctx, await productionDeps());
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("inquiry submit failed", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "We couldn't send your request right now. Please try again in a few minutes, or call or email us directly." },
      { status: 503 }
    );
  }
}
