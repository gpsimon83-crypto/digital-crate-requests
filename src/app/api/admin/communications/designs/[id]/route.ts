import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffUser } from "@/lib/comm/server";
import { sanitizeDesign } from "@/lib/comm/blocks";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const db = createAdminClient();
    const { data, error } = await db.from("comm_email_designs").select("*").eq("id", id).is("archived_at", null).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Design not found" }, { status: 404 });
    return NextResponse.json({ design: { ...data, ...sanitizeDesign(data) } });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid design" }, { status: 400 });
  const design = sanitizeDesign(body);
  const audience = ["client", "dj", "venue", "personal"].includes(body.audience) ? body.audience : "client";
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("comm_email_designs")
      .update({ ...design, audience, updated_by: auth.userId, updated_at: new Date().toISOString() })
      .eq("id", id)
      .is("archived_at", null)
      .select("id, updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Design not found" }, { status: 404 });
    return NextResponse.json({ design: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** Archives (soft-deletes) so past sends keep their history. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const db = createAdminClient();
    const { error } = await db.from("comm_email_designs").update({ archived_at: new Date().toISOString(), updated_by: auth.userId }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
