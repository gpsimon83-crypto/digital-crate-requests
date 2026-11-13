import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { requireAuth } from "@/lib/require-auth";
import { cleanText, currentUser, isVenueUser } from "@/lib/venue/server";

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

  const { name, location, calendar_names } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  // Optional: how the venue is written on the shared DCDJ calendar (when added from a calendar suggestion).
  const calNames = Array.isArray(calendar_names)
    ? [...new Set(calendar_names.map((s: unknown) => cleanText(s, 80)).filter((s: string | null): s is string => !!s))].slice(0, 20)
    : [];

  try {
    const db = createAdminClient();
    const row: Record<string, unknown> = { name, location: location || null };
    if (calNames.length) row.calendar_names = calNames;
    const { data, error } = await db.from("venues").insert(row).select().single();
    if (error) throw error;
    return NextResponse.json({ venue: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
