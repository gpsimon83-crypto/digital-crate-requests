import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { audit, cleanText, requireVenueAdmin } from "@/lib/venue/server";
import { fetchCalendarVenueNames } from "@/lib/venue/calendar-feed";
import { isLinked, looksLike, namesToAdd } from "@/lib/venue/calendar-names";

/**
 * Venue names found on the shared DCDJ calendar, with which CRM venue (if
 * any) already catches each one and which venues look like a match.
 */
export async function GET() {
  const admin = await requireVenueAdmin();
  if (admin instanceof NextResponse) return admin;
  try {
    const db = createAdminClient();
    const [{ venues: found, status }, { data: rows, error }] = await Promise.all([
      fetchCalendarVenueNames(),
      db.from("venues").select("id, name, calendar_names").order("name")
    ]);
    if (error) throw error;
    const venues = (rows ?? []).map((v) => ({ id: v.id as string, name: v.name as string, calendar_names: ((v.calendar_names as string[] | null) ?? []) }));
    return NextResponse.json({
      status,
      suggestions: found.map((s) => ({
        ...s,
        linked: venues.filter((v) => isLinked(v.calendar_names, s.match)).map((v) => ({ id: v.id, name: v.name })),
        similar: venues.filter((v) => !isLinked(v.calendar_names, s.match) && looksLike(v.name, s.name)).map((v) => ({ id: v.id, name: v.name }))
      }))
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** Adds calendar spellings to an existing venue (keeps the ones it has). Body: { venueId, names: string[] } */
export async function POST(req: NextRequest) {
  const admin = await requireVenueAdmin();
  if (admin instanceof NextResponse) return admin;
  const b = (await req.json().catch(() => null)) as { venueId?: unknown; names?: unknown } | null;
  const venueId = typeof b?.venueId === "string" ? b.venueId : "";
  const names = Array.isArray(b?.names) ? b!.names.map((s) => cleanText(s, 80)).filter((s): s is string => !!s).slice(0, 6) : [];
  if (!venueId || !names.length) return NextResponse.json({ error: "Pick a venue and at least one name." }, { status: 400 });
  try {
    const db = createAdminClient();
    const { data: row, error } = await db.from("venues").select("id, calendar_names").eq("id", venueId).maybeSingle();
    if (error) throw error;
    if (!row) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    const current = ((row.calendar_names as string[] | null) ?? []);
    const add = namesToAdd(current, names);
    const next = [...current, ...add].slice(0, 20);
    const { error: upErr } = await db.from("venues").update({ calendar_names: next, updated_at: new Date().toISOString() }).eq("id", venueId);
    if (upErr) throw upErr;
    if (add.length) await audit(venueId, admin, "venue.updated", { fields: ["calendar_names"], added: add });
    return NextResponse.json({ calendar_names: next, added: add });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
