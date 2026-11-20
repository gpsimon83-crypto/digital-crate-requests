import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkForEvent, weddingBasicsTemplate } from "@/lib/data/questionnaire-links";
import { listEventTasks, syncPlaybook } from "@/lib/data/playbook";
import { ownerLabel, type Owner } from "@/lib/playbook";
import { errorMessage } from "@/lib/error-message";

const SONGS: [string, string][] = [
  ["processional_song", "Processional"],
  ["wedding_party_entrance_song", "Wedding party entrance"],
  ["bride_entrance_song", "Bride entrance"],
  ["recessional_song", "Recessional"],
  ["grand_march_song", "Grand march"],
  ["first_dance_song", "First dance"],
  ["father_daughter_song", "Father/daughter dance"],
  ["mother_son_song", "Mother/son dance"]
];
/** Minutes before the start to arrive when the timeline doesn't say. */
const SETUP_MINUTES = 120;

/** The DJ's day-before brief, built from what's already on the event. Staff and the assigned DJ. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });
  const db = createAdminClient();
  try {
    await syncPlaybook(id);
    const { data: ev } = await db
      .from("events")
      .select("title, couple_display_name, starts_at, ends_at, timezone, venue_name, venue_load_in_notes, weather_backup_plan, vendor_contacts, day_timeline, wedding_music_plan, must_play, do_not_play, special_requests, expected_guests, venues(name, address_line, city, state, contact_name, contact_phone), clients(first_name, last_name, phone), djs(display_name)")
      .eq("id", id)
      .maybeSingle();
    if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const e = ev as unknown as Record<string, unknown> & {
      starts_at: string | null;
      ends_at: string | null;
      timezone: string | null;
      venues: { name: string; address_line: string | null; city: string | null; state: string | null; contact_name: string | null; contact_phone: string | null } | null;
      clients: { first_name: string | null; last_name: string | null; phone: string | null } | null;
      vendor_contacts: { role: string; name: string; phone?: string; email?: string }[] | null;
      day_timeline: { time: string; label: string; note?: string }[] | null;
      wedding_music_plan: Record<string, unknown> | null;
    };
    const tz = e.timezone ?? "America/Chicago";
    const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });

    // Arrival: a load-in / arrival entry on the timeline wins; otherwise two hours before the start.
    const timeline = (e.day_timeline ?? []).filter((t) => t.label?.trim());
    const loadIn = timeline.find((t) => /load|arriv|setup|set-up/i.test(t.label));
    const arrival = loadIn?.time ? `${loadIn.time} (${loadIn.label})` : e.starts_at ? `${time(new Date(Date.parse(e.starts_at) - SETUP_MINUTES * 60_000).toISOString())} (2 hours before the start)` : null;

    const vendors = e.vendor_contacts ?? [];
    const venueContact = vendors.find((v) => /venue|coordinator/i.test(v.role)) ?? (e.venues?.contact_name ? { role: "Venue", name: e.venues.contact_name, phone: e.venues.contact_phone ?? undefined } : null);
    const planner = vendors.find((v) => /planner/i.test(v.role)) ?? null;

    // Partner details arrive with migration 0056; read them separately so the brief works without it.
    let partner: { name: string; phone?: string } | null = null;
    {
      const { data } = await db.from("events").select("clients(partner_first_name, partner_phone)").eq("id", id).maybeSingle();
      const c = (data as unknown as { clients: { partner_first_name: string | null; partner_phone: string | null } | null } | null)?.clients;
      if (c?.partner_first_name) partner = { name: c.partner_first_name, phone: c.partner_phone ?? undefined };
    }

    let coverage: string[] = [];
    try {
      const t = await weddingBasicsTemplate();
      const a = t ? (await linkForEvent(db, id, t.id))?.answers : null;
      const v = a?.coverage;
      const names: Record<string, string> = { ceremony: "Ceremony", cocktail: "Cocktail hour", reception: "Reception" };
      if (v && !("unsure" in v) && Array.isArray(v.value)) coverage = v.value.filter((x): x is string => typeof x === "string").map((x) => names[x] ?? x);
    } catch {
      // no Wedding Basics
    }

    const { data: g } = await db.from("event_equipment_assignments").select("quantity, notes, equipment(name)").eq("event_id", id);
    const gear = ((g ?? []) as unknown as { quantity: number; notes: string | null; equipment: { name: string } | null }[]).map((x) => ({ name: x.equipment?.name ?? "Equipment", quantity: x.quantity, note: x.notes }));

    const plan = e.wedding_music_plan ?? {};
    const keyTracks = SONGS.map(([k, label]) => ({ label, song: typeof plan[k] === "string" ? (plan[k] as string).trim() : "" })).filter((s) => s.song);
    const party = (Array.isArray(plan.wedding_party) ? plan.wedding_party : []) as { name: string; pronunciation?: string }[];
    const pronunciations = party.filter((p) => p.pronunciation?.trim()).map((p) => ({ name: p.name, say: p.pronunciation! }));
    const announcements = typeof plan.mc_announcements === "string" && plan.mc_announcements.trim() ? plan.mc_announcements : null;

    const tasks = await listEventTasks(db, id);
    const viewer = access.isAdmin ? "staff" : "dj";
    const unresolved = tasks
      .filter((t) => t.status !== "done" && (t.stage == null || t.stage <= 6) && t.template_key !== "dj_day_before")
      .map((t) => ({ title: t.title, owner: ownerLabel(t.owner as Owner | null, viewer), due: t.due_date, waiting: t.status === "waiting" ? t.waiting_reason : null }));

    return NextResponse.json(
      {
        title: (e.couple_display_name as string | null) ?? (e.title as string),
        dj: (e.djs as { display_name: string } | null)?.display_name ?? null,
        date: e.starts_at ? new Date(e.starts_at).toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }) : null,
        hours: e.starts_at ? `${time(e.starts_at)}${e.ends_at ? ` – ${time(e.ends_at)}` : ""}` : null,
        arrival,
        venue: { name: e.venues?.name ?? (e.venue_name as string | null), address: [e.venues?.address_line, e.venues?.city, e.venues?.state].filter(Boolean).join(", ") || null },
        contacts: [venueContact, planner, e.clients ? { role: "Couple", name: [e.clients.first_name, e.clients.last_name].filter(Boolean).join(" "), phone: e.clients.phone ?? undefined } : null, partner ? { role: "Partner", ...partner } : null].filter(Boolean),
        loadIn: (e.venue_load_in_notes as string | null) ?? null,
        coverage,
        guests: (e.expected_guests as number | null) ?? null,
        gear,
        timeline,
        keyTracks,
        pronunciations,
        announcements,
        mustPlay: (e.must_play as string[] | null) ?? [],
        doNotPlay: (e.do_not_play as string[] | null) ?? [],
        backup: (e.weather_backup_plan as string | null) ?? null,
        notes: (e.special_requests as string | null) ?? null,
        unresolved
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
