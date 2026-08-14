import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export interface SearchResult {
  type: "event" | "client" | "dj" | "venue";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const like = `%${q}%`;
  const db = createAdminClient();

  try {
    const [events, clients, djs, venues] = await Promise.all([
      db.from("events").select("id, title, event_code, starts_at").or(`title.ilike.${like},event_code.ilike.${like}`).limit(8),
      db.from("clients").select("id, first_name, last_name, company_name, email").is("deleted_at", null).or(`first_name.ilike.${like},last_name.ilike.${like},company_name.ilike.${like},email.ilike.${like}`).limit(8),
      db.from("djs").select("id, display_name").ilike("display_name", like).limit(8),
      db.from("venues").select("id, name, location").or(`name.ilike.${like},location.ilike.${like}`).limit(8)
    ]);

    const results: SearchResult[] = [
      ...(events.data ?? []).map((e) => ({
        type: "event" as const,
        id: e.id,
        title: e.title || e.event_code,
        subtitle: e.starts_at ? new Date(e.starts_at).toLocaleDateString() : e.event_code,
        href: `/admin/events/${e.id}`
      })),
      ...(clients.data ?? []).map((c) => ({
        type: "client" as const,
        id: c.id,
        title: c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed contact",
        subtitle: c.email || "",
        href: `/admin/clients`
      })),
      ...(djs.data ?? []).map((d) => ({
        type: "dj" as const,
        id: d.id,
        title: d.display_name,
        subtitle: "DJ",
        href: `/admin/djs`
      })),
      ...(venues.data ?? []).map((v) => ({
        type: "venue" as const,
        id: v.id,
        title: v.name,
        subtitle: v.location || "",
        href: `/admin/venues`
      }))
    ];

    console.log("SEARCH_DEBUG", JSON.stringify({ q, like, eventsErr: events.error, clientsErr: clients.error, djsErr: djs.error, venuesErr: venues.error, djsData: djs.data }));

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
