import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireAuth } from "@/lib/require-auth";

/** Any signed-in DJ can add a venue when creating their own event. */
export async function POST(req: NextRequest) {
  const denied = await requireAuth();
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
