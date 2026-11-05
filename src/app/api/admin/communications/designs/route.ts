import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureStarterDesigns, requireStaffUser } from "@/lib/comm/server";
import { defaultBlock, sanitizeDesign } from "@/lib/comm/blocks";

const LIST_COLS = "id, name, audience, subject, theme, is_starter, updated_at, created_at";

export async function GET() {
  const auth = await requireStaffUser();
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureStarterDesigns();
    const db = createAdminClient();
    const { data, error } = await db.from("comm_email_designs").select(LIST_COLS).is("archived_at", null).order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ designs: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** Create a new design: blank, or a copy of an existing one ({ fromId }). */
export async function POST(req: NextRequest) {
  const auth = await requireStaffUser();
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as { fromId?: string; name?: string; audience?: string };
  try {
    const db = createAdminClient();
    let design;
    let audience = body.audience === "dj" ? "dj" : "client";
    if (body.fromId) {
      const { data: src, error } = await db.from("comm_email_designs").select("*").eq("id", body.fromId).single();
      if (error) throw error;
      design = sanitizeDesign({ ...src, name: `${src.name} (copy)` });
      audience = src.audience;
    } else {
      design = sanitizeDesign({
        name: body.name || "Untitled email",
        audience,
        subject: "",
        theme: "dark",
        blocks: [defaultBlock("logo"), defaultBlock("heading"), defaultBlock("text"), defaultBlock("button"), defaultBlock("footer")]
      });
    }
    const { data, error } = await db
      .from("comm_email_designs")
      .insert({ ...design, audience, created_by: auth.userId, updated_by: auth.userId })
      .select(LIST_COLS)
      .single();
    if (error) throw error;
    return NextResponse.json({ design: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
