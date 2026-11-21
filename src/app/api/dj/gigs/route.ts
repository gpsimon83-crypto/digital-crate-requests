import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { djIdForUser, missingTable } from "@/lib/data/residency";
import { addDays, hhmm, todayIn } from "@/lib/residency";
import { errorMessage } from "@/lib/error-message";

/** The signed-in DJ's recurring-venue gigs: to confirm, confirmed upcoming, and recaps due. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = createAdminClient();
  const dj = await djIdForUser(db, user.id);
  if (!dj) return NextResponse.json({ awaiting: [], upcoming: [], recapDue: [] });
  try {
    const today = todayIn("America/Chicago");
    const { data, error } = await db
      .from("residency_gigs")
      .select("id, event_id, gig_date, start_time, end_time, coverage, outcome, notes, change_note, residencies(name, timezone, venues(name, city, state))")
      .eq("dj_id", dj.id)
      .gte("gig_date", addDays(today, -30)) // recaps due for the last month, and everything ahead
      .order("gig_date", { ascending: true });
    if (error) {
      if (missingTable(error)) return NextResponse.json({ awaiting: [], upcoming: [], recapDue: [] });
      throw error;
    }
    const rows = (data ?? []) as unknown as {
      id: string;
      event_id: string;
      gig_date: string;
      start_time: string;
      end_time: string;
      coverage: string;
      outcome: string;
      notes: string | null;
      change_note: string | null;
      residencies: { name: string; timezone: string; venues: { name: string; city: string | null; state: string | null } | null } | null;
    }[];
    const ids = rows.map((r) => r.id);
    const { data: recaps } = ids.length ? await db.from("residency_recaps").select("gig_id").in("gig_id", ids) : { data: [] };
    const done = new Set(((recaps ?? []) as { gig_id: string }[]).map((r) => r.gig_id));
    const shape = (r: (typeof rows)[number]) => ({
      id: r.id,
      date: r.gig_date,
      start: hhmm(r.start_time),
      end: hhmm(r.end_time),
      night: r.residencies?.name ?? "Bar night",
      venue: r.residencies?.venues?.name ?? null,
      place: [r.residencies?.venues?.city, r.residencies?.venues?.state].filter(Boolean).join(", ") || null,
      notes: r.notes,
      changeNote: r.change_note,
      coverage: r.coverage
    });
    const dayOf = (r: (typeof rows)[number]) => todayIn(r.residencies?.timezone ?? "America/Chicago");
    return NextResponse.json(
      {
        awaiting: rows.filter((r) => r.coverage === "awaiting" && r.outcome === "scheduled" && r.gig_date >= dayOf(r)).map(shape),
        upcoming: rows.filter((r) => r.coverage === "confirmed" && r.outcome === "scheduled" && r.gig_date >= dayOf(r)).map(shape),
        recapDue: rows.filter((r) => r.coverage === "confirmed" && r.outcome !== "canceled" && r.gig_date <= dayOf(r) && !done.has(r.id)).map(shape)
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
