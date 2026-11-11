import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { enforce, limits, retryMessage, supabaseRateLimitStore } from "@/lib/security/rate-limit";
import { keyedHash } from "@/lib/security/crypto";
import { getClientIp } from "@/lib/security/client-ip";

/** Public — a guest fetches their own profile (points, name) by id from localStorage. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  try {
    const db = createAdminClient();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    // Public endpoint: only what the guest pages show — never email, phone or birthday.
    const { data, error } = await db.from("customers").select("id, full_name, reward_points").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    return NextResponse.json({ customer: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** Public — guests create/update their own profile from the event welcome flow. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const { fullName, phone, email, birthday, favoriteGenres, marketingOptIn } = (body ?? {}) as {
    fullName?: string; phone?: string; email?: string; birthday?: string; favoriteGenres?: unknown; marketingOptIn?: boolean;
  };

  if (!fullName || typeof fullName !== "string" || fullName.trim().length > 100) {
    return NextResponse.json({ error: "Please enter your name (up to 100 characters)." }, { status: 400 });
  }
  if ((email && (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) || (phone && (typeof phone !== "string" || phone.length > 30))) {
    return NextResponse.json({ error: "Please check your email and phone number." }, { status: 400 });
  }
  if (birthday && (typeof birthday !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(birthday))) {
    return NextResponse.json({ error: "Please check your birthday." }, { status: 400 });
  }
  const genres = Array.isArray(favoriteGenres) ? favoriteGenres.filter((g) => typeof g === "string").slice(0, 20).map((g) => String(g).slice(0, 40)) : [];

  const L = limits();
  const rl = await enforce(supabaseRateLimitStore, [
    { bucket: `guest:s:${keyedHash("ip", getClientIp(req.headers))}`, limit: L.publicWritePerSource.limit, window: L.publicWritePerSource.window }
  ]).catch(() => ({ allowed: true, retryAfterSeconds: 0 }));
  if (!rl.allowed) return NextResponse.json({ error: retryMessage(rl.retryAfterSeconds) }, { status: 429 });

  try {
    const db = createAdminClient();

    let existing = null;
    if (email) {
      const { data } = await db.from("customers").select("id").eq("email", email).maybeSingle();
      existing = data;
    }

    const payload = {
      full_name: fullName.trim(),
      phone: phone || null,
      email: email || null,
      birthday: birthday || null,
      favorite_genres: genres,
      marketing_opt_in: !!marketingOptIn,
    };

    if (existing) {
      // Someone typing an email that's already on file must not be able to
      // overwrite that person's details: only empty fields are filled in.
      const { data: current } = await db.from("customers").select("full_name, phone, birthday").eq("id", existing.id).maybeSingle();
      const fill: Record<string, unknown> = {};
      if (!current?.phone && payload.phone) fill.phone = payload.phone;
      if (!current?.birthday && payload.birthday) fill.birthday = payload.birthday;
      if (Object.keys(fill).length) await db.from("customers").update(fill).eq("id", existing.id);
      const { data, error } = await db.from("customers").select("id, full_name, reward_points").eq("id", existing.id).single();
      if (error) throw error;
      return NextResponse.json({ customer: data });
    }

    const { data, error } = await db.from("customers").insert(payload).select("id, full_name, reward_points").single();
    if (error) throw error;
    return NextResponse.json({ customer: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
