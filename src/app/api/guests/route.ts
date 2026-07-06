import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

/** Public — a guest fetches their own profile (points, name) by id from localStorage. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  try {
    const db = createAdminClient();
    const { data, error } = await db.from("customers").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    return NextResponse.json({ customer: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** Public — guests create/update their own profile from the event welcome flow. */
export async function POST(req: NextRequest) {
  const { fullName, phone, email, birthday, favoriteGenres, marketingOptIn } = await req.json();

  if (!fullName) {
    return NextResponse.json({ error: "fullName is required" }, { status: 400 });
  }

  try {
    const db = createAdminClient();

    let existing = null;
    if (email) {
      const { data } = await db.from("customers").select("id").eq("email", email).maybeSingle();
      existing = data;
    }

    const payload = {
      full_name: fullName,
      phone: phone || null,
      email: email || null,
      birthday: birthday || null,
      favorite_genres: favoriteGenres ?? [],
      marketing_opt_in: !!marketingOptIn,
    };

    if (existing) {
      const { data, error } = await db.from("customers").update(payload).eq("id", existing.id).select().single();
      if (error) throw error;
      return NextResponse.json({ customer: data });
    }

    const { data, error } = await db.from("customers").insert(payload).select().single();
    if (error) throw error;
    return NextResponse.json({ customer: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
