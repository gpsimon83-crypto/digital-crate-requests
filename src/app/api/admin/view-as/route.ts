import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireAdmin } from "@/lib/require-admin";
import { VIEW_AS_COOKIE, VIEW_AS_NAME_COOKIE } from "@/lib/view-as";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AGE = 2 * 60 * 60; // two hours

/** Start "View as DJ" for one DJ (staff only). Everything stays read-only until it's turned off. */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { djId } = await req.json().catch(() => ({}));
  if (typeof djId !== "string" || !UUID.test(djId)) return NextResponse.json({ error: "Pick a DJ" }, { status: 400 });
  try {
    const { data: dj, error } = await createAdminClient().from("djs").select("id, display_name").eq("id", djId).maybeSingle();
    if (error) throw error;
    if (!dj) return NextResponse.json({ error: "DJ not found" }, { status: 404 });
    const res = NextResponse.json({ viewAs: dj });
    const secure = process.env.NODE_ENV === "production";
    res.cookies.set(VIEW_AS_COOKIE, dj.id, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: MAX_AGE });
    // Name only, readable by the page for the banner.
    res.cookies.set(VIEW_AS_NAME_COOKIE, encodeURIComponent(String(dj.display_name).slice(0, 60)), { httpOnly: false, sameSite: "lax", secure, path: "/", maxAge: MAX_AGE });
    return res;
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** Stop viewing (anyone can clear their own cookie). */
export async function DELETE() {
  const res = NextResponse.json({ viewAs: null });
  res.cookies.delete(VIEW_AS_COOKIE);
  res.cookies.delete(VIEW_AS_NAME_COOKIE);
  return res;
}
