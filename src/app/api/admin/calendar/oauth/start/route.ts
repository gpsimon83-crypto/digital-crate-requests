import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/require-admin";
import { buildAuthUrl } from "@/lib/google-calendar";

const STATE_COOKIE = "gcal_oauth_state";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const state = randomBytes(24).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
