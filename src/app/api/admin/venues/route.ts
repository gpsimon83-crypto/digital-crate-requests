import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { requireAuth } from "@/lib/require-auth";
import { currentUser, isVenueUser } from "@/lib/venue/server";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  // Venue partner logins only ever see their own venue (via /api/venue/*).
  if (isVenueUser(await currentUser())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  try {
    const db = createAdminClient();
    const { data, error } = await db.from("venues").select("id, name, location").order("name");
    if (error) throw error;
    return NextResponse.json({ venues: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { name, location } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { data, error } = await db.from("venues").insert({ name, location: location || null }).select().single();
    if (error) throw error;
    return NextResponse.json({ venue: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
