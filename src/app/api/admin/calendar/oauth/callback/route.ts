import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, accountRole } from "@/lib/roles";
import { exchangeCodeForTokens, fetchConnectedEmail, hasCalendarScope } from "@/lib/google-calendar";
import { runCalendarSync } from "@/lib/calendar-sync";
import { saveConnection } from "@/lib/data/calendar-connection";

const STATE_COOKIE = "gcal_oauth_state";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user || !isStaffRole(accountRole(user))) {
    return NextResponse.redirect(new URL("/admin/settings?calendar=error", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/admin/settings?calendar=error", req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!hasCalendarScope(tokens.scope)) {
      // Signed in, but the calendar permission box was left unticked: don't save a connection that can't work.
      const res = NextResponse.redirect(new URL("/admin/settings?calendar=scope", req.url));
      res.cookies.delete(STATE_COOKIE);
      return res;
    }
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const connectedEmail = await fetchConnectedEmail(tokens.access_token);

    await saveConnection({
      connectedEmail,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      connectedBy: user.id
    });
    // Sync right away so Settings shows the result (and the calendar list) now, not in 15 minutes.
    await runCalendarSync().catch(() => {});

    const res = NextResponse.redirect(new URL("/admin/settings?calendar=connected", req.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch {
    return NextResponse.redirect(new URL("/admin/settings?calendar=error", req.url));
  }
}
