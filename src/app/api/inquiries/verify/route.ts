import { NextRequest, NextResponse } from "next/server";
import { productionDeps, verifySubmissionToken } from "@/lib/security/inquiry-service";
import { readJson, requestContext } from "@/lib/security/request-context";

/** Spends a verification token. Called only by the confirm button on /inquiry/verify (POST, never GET). */
export async function POST(req: NextRequest) {
  const { ip } = requestContext(req.headers);
  const body = (await readJson(req)) as { token?: unknown } | null;
  try {
    const r = await verifySubmissionToken(body?.token, { ip }, await productionDeps());
    return NextResponse.json({ outcome: r.outcome, kind: r.kind, retryAfterSeconds: r.retryAfterSeconds }, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("inquiry verify failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ outcome: "error" }, { status: 503 });
  }
}
