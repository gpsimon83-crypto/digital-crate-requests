import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isStaffRole, accountRole } from "@/lib/roles";

const LOGIN_PATH = "/dj-dashboard/login";
const SIGNUP_PATH = "/dj-dashboard/signup";
const DJ_PREFIX = "/dj-dashboard";
const STAFF_PREFIXES = ["/admin", "/analytics"];

const PORTAL_LOGIN_PATH = "/portal/login";
const PORTAL_SIGNUP_PATH = "/portal/signup";
const PORTAL_PREFIX = "/portal";

const VENUE_LOGIN_PATH = "/venue/login";
const VENUE_PREFIX = "/venue";

const MFA_PATH = "/admin/security/two-factor";

const PUBLIC_EXCEPTIONS = [LOGIN_PATH, SIGNUP_PATH, PORTAL_LOGIN_PATH, PORTAL_SIGNUP_PATH, VENUE_LOGIN_PATH];

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF defence for cookie-authenticated API calls: a browser always sends
 * an Origin header on cross-site POST/PUT/PATCH/DELETE, so any mutation
 * whose Origin isn't this site is refused. Server-to-server callers
 * (Stripe, SignWell, WordPress, cron) send no Origin and are unaffected;
 * they authenticate with their own signatures/secrets.
 */
function originAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = new Set<string>([request.nextUrl.origin]);
  for (const o of [process.env.NEXT_PUBLIC_APP_URL, ...(process.env.CSRF_ALLOWED_ORIGINS ?? "").split(",")]) {
    if (o && o.trim()) allowed.add(o.trim().replace(/\/$/, ""));
  }
  return allowed.has(origin);
}

/** Private areas must never be cached by a shared cache or indexed. */
function privateHeaders(res: NextResponse) {
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (MUTATING.has(request.method) && !originAllowed(request)) {
      return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    }
    return NextResponse.next();
  }

  const needsDjAuth = pathname.startsWith(DJ_PREFIX);
  const needsStaffAuth = STAFF_PREFIXES.some((p) => pathname.startsWith(p));
  const needsPortalAuth = pathname.startsWith(PORTAL_PREFIX);
  const needsVenueAuth = pathname === VENUE_PREFIX || pathname.startsWith(`${VENUE_PREFIX}/`);
  const isPublicException = PUBLIC_EXCEPTIONS.some((p) => pathname.startsWith(p));

  if ((!needsDjAuth && !needsStaffAuth && !needsPortalAuth && !needsVenueAuth) || isPublicException) {
    return isPublicException ? privateHeaders(NextResponse.next()) : NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL(needsVenueAuth ? VENUE_LOGIN_PATH : needsPortalAuth ? PORTAL_LOGIN_PATH : LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Venue partner logins (role set server-side in app_metadata) only get
  // the venue portal; every other area sends them back to it.
  if (user.app_metadata?.role === "venue" && !needsVenueAuth) {
    return NextResponse.redirect(new URL(VENUE_PREFIX, request.url));
  }

  // /admin and /analytics require an owner/admin/manager role. /dj-dashboard
  // allows any authenticated user (DJs manage their own bookings; staff see everything).
  if (needsStaffAuth) {
    const role = accountRole(user);
    if (!isStaffRole(role)) {
      const loginUrl = new URL(LOGIN_PATH, request.url);
      loginUrl.searchParams.set("next", pathname);
      loginUrl.searchParams.set("error", "admin_only");
      return NextResponse.redirect(loginUrl);
    }

    // Two-factor for staff. Always enforced for anyone who has set it up
    // (so a stolen password alone can't open /admin); required for every
    // staff account only when ADMIN_MFA_REQUIRED=true. The two-factor page
    // itself stays reachable so nobody is locked out of setting it up.
    if (!pathname.startsWith(MFA_PATH)) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const hasFactor = aal?.nextLevel === "aal2";
      const verified = aal?.currentLevel === "aal2";
      if (!verified && (hasFactor || process.env.ADMIN_MFA_REQUIRED === "true")) {
        const mfaUrl = new URL(MFA_PATH, request.url);
        mfaUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(mfaUrl);
      }
    }
  }

  return privateHeaders(response);
}

export const config = {
  matcher: ["/api/:path*", "/dj-dashboard/:path*", "/admin/:path*", "/analytics/:path*", "/portal/:path*", "/venue", "/venue/:path*"],
};
