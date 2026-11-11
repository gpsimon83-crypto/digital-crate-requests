import { NextRequest, NextResponse } from "next/server";
import { productionDeps, resendVerification } from "@/lib/security/inquiry-service";
import { readJson, requestContext } from "@/lib/security/request-context";

/** "Send me a new link." Always the same neutral answer; never reveals whether an address is known. */
export async function POST(req: NextRequest) {
  const ctx = requestContext(req.headers);
  const body = await readJson(req);
  try {
    const r = await resendVerification(body, { ...ctx, partner: false }, await productionDeps());
    return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("inquiry resend failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "We couldn't send a new link right now. Please try again shortly." }, { status: 503 });
  }
}
