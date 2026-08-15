import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/roles";
import { exchangeCodeForTokens, fetchConnectedEmail } from "@/lib/google-calendar";
import { saveConnection } from "@/lib/data/calendar-connection";

const STATE_COOKIE = "gcal_oauth_state";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user || !isStaffRole(user.user_metadata?.role)) {
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
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const connectedEmail = await fetchConnectedEmail(tokens.access_token);

    await saveConnection({
      connectedEmail,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      connectedBy: user.id
    });

    const res = NextResponse.redirect(new URL("/admin/settings?calendar=connected", req.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch {
    return NextResponse.redirect(new URL("/admin/settings?calendar=error", req.url));
  }
}
