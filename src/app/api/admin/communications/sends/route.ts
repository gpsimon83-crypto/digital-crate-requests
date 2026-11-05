import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { providerStatus, requireStaffUser } from "@/lib/comm/server";

const STATUSES = ["queued", "sent", "delivered", "delayed", "bounced", "complained", "failed", "suppressed"] as const;

/** Sent log + overview numbers. Every number comes from recorded sends; nothing estimated. */
export async function GET(req: NextRequest) {
  const auth = await requireStaffUser();
  if (auth instanceof NextResponse) return auth;
  const id = req.nextUrl.searchParams.get("id");
  try {
    const db = createAdminClient();
    if (id) {
      const { data: send, error } = await db.from("comm_email_sends").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!send) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const { data: recipients, error: rErr } = await db
        .from("comm_email_recipients")
        .select("id, email, name, status, error, opened_at, clicked_at, updated_at, client_id")
        .eq("send_id", id)
        .order("email");
      if (rErr) throw rErr;
      return NextResponse.json({ send, recipients: recipients ?? [] });
    }

    const { data: sends, error } = await db
      .from("comm_email_sends")
      .select("id, design_id, design_name, subject, is_test, recipient_count, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const ids = (sends ?? []).map((s) => s.id);
    const countsBySend = new Map<string, Record<string, number>>();
    if (ids.length) {
      const { data: recs } = await db.from("comm_email_recipients").select("send_id, status, opened_at, clicked_at").in("send_id", ids);
      for (const r of recs ?? []) {
        const c = countsBySend.get(r.send_id) ?? {};
        c[r.status] = (c[r.status] ?? 0) + 1;
        if (r.opened_at) c.opened = (c.opened ?? 0) + 1;
        if (r.clicked_at) c.clicked = (c.clicked ?? 0) + 1;
        countsBySend.set(r.send_id, c);
      }
    }

    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: recent } = await db
      .from("comm_email_recipients")
      .select("status, comm_email_sends!inner(is_test, created_at)")
      .gte("created_at", since)
      .eq("comm_email_sends.is_test", false);
    const totals: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const r of recent ?? []) totals[r.status] = (totals[r.status] ?? 0) + 1;

    return NextResponse.json({
      sends: (sends ?? []).map((s) => ({ ...s, counts: countsBySend.get(s.id) ?? {} })),
      last30Days: totals,
      provider: providerStatus()
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
