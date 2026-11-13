import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { audit, cleanText, requireVenueAdmin } from "@/lib/venue/server";

/**
 * DJs as written on the shared DCDJ calendar → the name venue portals show.
 * GET lists them; POST adds or updates one ({ calendar_name, display_name });
 * DELETE ?id= removes one.
 */
export async function GET() {
  const admin = await requireVenueAdmin();
  if (admin instanceof NextResponse) return admin;
  try {
    const { data, error } = await createAdminClient().from("calendar_dj_names").select("id, calendar_name, display_name").order("calendar_name");
    if (error) {
      // Before migration 0047 runs, the table doesn't exist yet.
      if (error.code === "42P01" || /calendar_dj_names/.test(error.message)) return NextResponse.json({ migrated: false, djs: [] });
      throw error;
    }
    return NextResponse.json({ migrated: true, djs: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireVenueAdmin();
  if (admin instanceof NextResponse) return admin;
  const b = (await req.json().catch(() => null)) as { calendar_name?: unknown; display_name?: unknown } | null;
  const calendarName = cleanText(b?.calendar_name, 40);
  const displayName = cleanText(b?.display_name, 80);
  if (!calendarName || calendarName.length < 2) return NextResponse.json({ error: "Pick the DJ's calendar name." }, { status: 400 });
  if (!displayName || displayName.length < 2) return NextResponse.json({ error: "Type the DJ's actual name." }, { status: 400 });
  try {
    const db = createAdminClient();
    const { data: existing, error: findErr } = await db.from("calendar_dj_names").select("id").ilike("calendar_name", calendarName.replace(/[%_\\]/g, "\\$&")).maybeSingle();
    if (findErr) throw findErr;
    const now = new Date().toISOString();
    const { data, error } = existing
      ? await db.from("calendar_dj_names").update({ calendar_name: calendarName, display_name: displayName, updated_at: now }).eq("id", existing.id).select("id, calendar_name, display_name").single()
      : await db.from("calendar_dj_names").insert({ calendar_name: calendarName, display_name: displayName }).select("id, calendar_name, display_name").single();
    if (error) throw error;
    await audit(null, admin, "calendar_dj.saved", { calendar_name: calendarName, display_name: displayName });
    return NextResponse.json({ dj: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireVenueAdmin();
  if (admin instanceof NextResponse) return admin;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Missing DJ." }, { status: 400 });
  try {
    const { error } = await createAdminClient().from("calendar_dj_names").delete().eq("id", id);
    if (error) throw error;
    await audit(null, admin, "calendar_dj.removed", { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
