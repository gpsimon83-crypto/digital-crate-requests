import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountRole, isStaffRole } from "@/lib/roles";
import { djRowForUser } from "@/lib/view-as";
import { VIEW_MODE_COOKIE } from "@/lib/view-mode";

/**
 * Switch between Admin View and DJ View. Only staff with a linked DJ
 * profile can turn DJ View on; anyone can switch back. Presentation only:
 * see lib/view-mode.ts.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { mode?: unknown };
  const mode = body.mode === "dj" ? "dj" : "admin";
  const res = NextResponse.json({ mode });
  if (mode === "admin") {
    res.cookies.delete(VIEW_MODE_COOKIE);
    return res;
  }
  if (!isStaffRole(accountRole(user))) return NextResponse.json({ error: "Only staff can switch views." }, { status: 403 });
  const dj = await djRowForUser<{ id: string }>(createAdminClient(), user.id, "id").catch(() => null);
  if (!dj) return NextResponse.json({ error: "Link your login to your DJ profile first (DJs → your profile → This DJ is me)." }, { status: 409 });
  res.cookies.set(VIEW_MODE_COOKIE, "dj", { path: "/", sameSite: "lax", secure: true, httpOnly: true, maxAge: 60 * 60 * 24 * 180 });
  return res;
}
