import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffUser, isValidEmail } from "@/lib/comm/server";

/** Client picker for the Studio: clients with a usable email, searchable. */
export async function GET(req: NextRequest) {
  const auth = await requireStaffUser();
  if (auth instanceof NextResponse) return auth;
  const q = (req.nextUrl.searchParams.get("q") || "").trim().replace(/[%,()]/g, " ");
  const upcoming = req.nextUrl.searchParams.get("upcoming") === "1";
  try {
    const db = createAdminClient();
    let query = db.from("clients").select("id, first_name, last_name, company_name, email, status").not("email", "is", null).order("created_at", { ascending: false }).limit(200);
    if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,company_name.ilike.%${q}%,email.ilike.%${q}%`);
    const { data: clients, error } = await query;
    if (error) throw error;
    const list = (clients ?? []).filter((c) => c.email && isValidEmail(c.email) && c.status !== "blocked");
    const ids = list.map((c) => c.id);
    const nextByClient = new Map<string, { id: string; starts_at: string; event_type: string | null }>();
    if (ids.length) {
      const { data: events } = await db
        .from("events")
        .select("id, client_id, starts_at, event_type")
        .in("client_id", ids)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true });
      for (const e of events ?? []) if (e.client_id && !nextByClient.has(e.client_id)) nextByClient.set(e.client_id, e);
    }
    const out = list
      .map((c) => ({
        id: c.id,
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company_name || c.email,
        email: c.email,
        nextEvent: nextByClient.get(c.id) ?? null
      }))
      .filter((c) => !upcoming || c.nextEvent);
    return NextResponse.json({ recipients: out });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
