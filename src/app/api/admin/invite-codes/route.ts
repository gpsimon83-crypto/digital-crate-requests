import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

function generateCode() {
  return `DCDJ-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("invite_codes")
      .select("id, code, used, assigned_dj_id, djs(display_name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ codes: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { assignedDjId } = await req.json().catch(() => ({}));

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("invite_codes")
      .insert({ code: generateCode(), assigned_dj_id: assignedDjId || null })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ code: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
