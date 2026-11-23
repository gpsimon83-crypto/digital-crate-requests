import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { djIdForUser } from "@/lib/data/residency";
import { djOffers } from "@/lib/data/offers";
import { errorMessage } from "@/lib/error-message";

/** The signed-in DJ's offers: payout, dates and scope only. Never the client price, company share or split rule. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const db = createAdminClient();
    const dj = await djIdForUser(db, user.id);
    if (!dj) return NextResponse.json({ offers: [] });
    const offers = await djOffers(db, dj.id).catch((e) => {
      if (/dj_offers|does not exist|schema cache/i.test(String(e?.message ?? e))) return [];
      throw e;
    });
    return NextResponse.json({ offers }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
