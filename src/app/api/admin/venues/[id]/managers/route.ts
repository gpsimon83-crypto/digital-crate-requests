import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { audit, cleanText, isVenueUser, requireVenueAdmin } from "@/lib/venue/server";
import { appOrigin } from "@/lib/comm/server";

type Params = { params: Promise<{ id: string }> };
const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;

async function findUserByEmail(email: string): Promise<User | null> {
  const db = createAdminClient();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

/**
 * A one-time "set your password" link for the manager. Generating it does
 * NOT send an email: the admin copies it into a message (or, later, the
 * Communications Center sends it). After setting a password the manager
 * lands in the venue portal.
 */
async function setupLink(email: string): Promise<string | null> {
  const db = createAdminClient();
  const { data, error } = await db.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${appOrigin()}/auth/reset-password` }
  });
  if (error) return null;
  return data.properties?.action_link ?? null;
}

/** Invite a manager (creates a venue login if needed), or get a fresh setup link. */
export async function POST(req: NextRequest, { params }: Params) {
  const admin = await requireVenueAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id: venueId } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = createAdminClient();

  try {
    if (b.action === "link") {
      const { data: m } = await db.from("venue_managers").select("email").eq("id", String(b.managerId ?? "")).eq("venue_id", venueId).maybeSingle();
      if (!m) return NextResponse.json({ error: "Manager not found" }, { status: 404 });
      const link = await setupLink(m.email);
      if (!link) return NextResponse.json({ error: "Couldn't create a setup link. Try again." }, { status: 503 });
      await audit(venueId, admin, "manager.link_created", { email: m.email });
      return NextResponse.json({ link });
    }

    const email = String(b.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const full_name = cleanText(b.full_name, 120);
    const title = cleanText(b.title, 80);
    const phone = cleanText(b.phone, 40);

    const { data: venue } = await db.from("venues").select("id, name").eq("id", venueId).maybeSingle();
    if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

    let user = await findUserByEmail(email);
    if (user && !isVenueUser(user)) {
      // Keep roles separate: a DJ, client or staff login can't also be a venue login.
      return NextResponse.json(
        { error: "That email already has a Digital Crate DJs login (DJ, client or staff). Use a different email for the venue manager." },
        { status: 409 }
      );
    }
    if (!user) {
      const { data, error } = await db.auth.admin.createUser({
        email,
        email_confirm: true,
        app_metadata: { role: "venue" },
        user_metadata: { full_name: full_name ?? undefined }
      });
      if (error) throw error;
      user = data.user;
    }

    const { data: manager, error } = await db
      .from("venue_managers")
      .upsert(
        { venue_id: venueId, user_id: user.id, email, full_name, title, phone, is_active: true, invited_by: admin.id },
        { onConflict: "venue_id,user_id" }
      )
      .select("id, venue_id, user_id, email, full_name, title, phone, is_active, invited_at, last_seen_at")
      .single();
    if (error) throw error;
    await audit(venueId, admin, "manager.invited", { email });
    return NextResponse.json({ manager, link: await setupLink(email) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** Turn a manager's access on or off for this venue. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireVenueAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id: venueId } = await params;
  const b = (await req.json().catch(() => ({}))) as { managerId?: string; is_active?: boolean };
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("venue_managers")
      .update({ is_active: !!b.is_active })
      .eq("id", String(b.managerId ?? ""))
      .eq("venue_id", venueId)
      .select("id, email, is_active")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Manager not found" }, { status: 404 });
    await audit(venueId, admin, data.is_active ? "manager.activated" : "manager.deactivated", { email: data.email });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** Removes the manager from this venue. Their login stays (they may manage other venues). */
export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = await requireVenueAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id: venueId } = await params;
  const managerId = req.nextUrl.searchParams.get("managerId") ?? "";
  try {
    const db = createAdminClient();
    const { data, error } = await db.from("venue_managers").delete().eq("id", managerId).eq("venue_id", venueId).select("email").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Manager not found" }, { status: 404 });
    await audit(venueId, admin, "manager.removed", { email: data.email });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
