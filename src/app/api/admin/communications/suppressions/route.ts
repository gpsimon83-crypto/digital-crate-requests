import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffUser, isValidEmail } from "@/lib/comm/server";

export async function GET() {
  const auth = await requireStaffUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const db = createAdminClient();
    const { data, error } = await db.from("comm_email_suppressions").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return NextResponse.json({ suppressions: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffUser();
  if (auth instanceof NextResponse) return auth;
  const { email, detail } = (await req.json().catch(() => ({}))) as { email?: string; detail?: string };
  if (!email || !isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  try {
    const db = createAdminClient();
    const { error } = await db.from("comm_email_suppressions").upsert({ email: email.trim().toLowerCase(), reason: "manual", detail: (detail || "Added by admin").slice(0, 300) });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireStaffUser();
  if (auth instanceof NextResponse) return auth;
  const email = (req.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });
  try {
    const db = createAdminClient();
    const { error } = await db.from("comm_email_suppressions").delete().eq("email", email);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
