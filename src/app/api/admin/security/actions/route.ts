import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSecurityAdmin } from "@/lib/security/admin-guard";
import { runAdminAction } from "@/lib/security/admin-actions";
import { supabaseBlockStore } from "@/lib/security/admin-data";
import { productionDeps } from "@/lib/security/inquiry-service";
import { enforce, limits, retryMessage, supabaseRateLimitStore } from "@/lib/security/rate-limit";
import { readJson } from "@/lib/security/request-context";

const note = z.string().trim().max(500).optional();
const Action = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("approve"), id: z.uuid(), note }),
  z.strictObject({ action: z.literal("spam"), id: z.uuid(), note }),
  z.strictObject({ action: z.literal("restore"), id: z.uuid(), note }),
  z.strictObject({ action: z.literal("resend"), id: z.uuid() }),
  z.strictObject({ action: z.literal("block"), id: z.uuid(), kind: z.enum(["email", "source"]), hours: z.coerce.number().int().min(1).max(720), reason: z.string().trim().max(300).optional() }),
  z.strictObject({ action: z.literal("unblock"), blockId: z.uuid() })
]);

/** Review actions on inquiries. Owner/admin only; every action is recorded with who did it. */
export async function POST(req: NextRequest) {
  const gate = await requireSecurityAdmin();
  if (!gate.ok) return gate.response;

  const L = limits();
  const rl = await enforce(supabaseRateLimitStore, [{ bucket: `admin:u:${gate.userId}`, limit: L.adminActionPerUser.limit, window: L.adminActionPerUser.window }]);
  if (!rl.allowed) return NextResponse.json({ error: retryMessage(rl.retryAfterSeconds) }, { status: 429 });

  const parsed = Action.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const deps = { ...(await productionDeps()), blocks: supabaseBlockStore };
    const r = await runAdminAction(parsed.data, gate.actor, deps);
    return NextResponse.json(r.body, { status: r.status });
  } catch (err) {
    console.error("security action failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "That action failed. Please try again." }, { status: 503 });
  }
}
