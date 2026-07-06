import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("djs")
      .select("id, display_name, auth_user_id")
      .order("display_name");
    if (error) throw error;
    return NextResponse.json({ djs: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { displayName } = await req.json();
  if (!displayName) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { data, error } = await db.from("djs").insert({ display_name: displayName }).select().single();
    if (error) throw error;
    return NextResponse.json({ dj: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
