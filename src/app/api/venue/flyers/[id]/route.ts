import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireVenueAccess } from "@/lib/venue/server";
import { FLYER_BUCKET } from "@/lib/flyers/server";

/** One sent flyer's image, for that venue's managers (and staff). ?download=1 saves it. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = createAdminClient();
  const { data } = await db.from("venue_flyers").select("id, venue_id, title, night_date, storage_path, hidden").eq("id", id).maybeSingle();
  const row = data as { id: string; venue_id: string; title: string; night_date: string | null; storage_path: string; hidden: boolean } | null;
  if (!row || row.hidden) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await requireVenueAccess(row.venue_id);
  if (access instanceof NextResponse) return access;
  if (access.venue.id !== row.venue_id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: file, error } = await db.storage.from(FLYER_BUCKET).download(row.storage_path);
  if (error || !file) return NextResponse.json({ error: "Image missing" }, { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox"
  };
  if (req.nextUrl.searchParams.get("download") === "1") {
    const safe = `${row.title}${row.night_date ? ` ${row.night_date}` : ""}`.replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "flyer";
    headers["Content-Disposition"] = `attachment; filename="${safe}.png"`;
  }
  return new NextResponse(file, { headers });
}
