import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/dj-dashboard/login";
const SIGNUP_PATH = "/dj-dashboard/signup";
const DJ_PREFIX = "/dj-dashboard";
const STAFF_PREFIXES = ["/admin", "/analytics"];
const PUBLIC_EXCEPTIONS = [LOGIN_PATH, SIGNUP_PATH];
const STAFF_ROLES = ["owner", "admin", "manager"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsDjAuth = pathname.startsWith(DJ_PREFIX);
  const needsStaffAuth = STAFF_PREFIXES.some((p) => pathname.startsWith(p));
  const isPublicException = PUBLIC_EXCEPTIONS.some((p) => pathname.startsWith(p));

  if ((!needsDjAuth && !needsStaffAuth) || isPublicException) {
    return NextResponse.next();
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
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // /admin and /analytics require an owner/admin/manager role. /dj-dashboard
  // allows any authenticated user (DJs manage their own bookings; staff see everything).
  if (needsStaffAuth) {
    const role = user.user_metadata?.role;
    if (!STAFF_ROLES.includes(role)) {
      const loginUrl = new URL(LOGIN_PATH, request.url);
      loginUrl.searchParams.set("next", pathname);
      loginUrl.searchParams.set("error", "admin_only");
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/dj-dashboard/:path*", "/admin/:path*", "/analytics/:path*"],
};
