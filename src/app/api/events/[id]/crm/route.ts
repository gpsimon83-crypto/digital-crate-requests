import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/require-auth";
import { errorMessage } from "@/lib/error-message";

interface CustomerRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  favorite_genres: string[] | null;
  marketing_opt_in: boolean | null;
  reward_points: number | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await params;

  try {
    const db = createAdminClient();
    const [{ data: requests, error: reqErr }, { data: tips, error: tipErr }] = await Promise.all([
      db
        .from("song_requests")
        .select("customer_id, customers(id, full_name, email, phone, favorite_genres, marketing_opt_in, reward_points)")
        .eq("event_id", id)
        .not("customer_id", "is", null),
      db
        .from("tips")
        .select("customer_id, amount_cents, customers(id, full_name, email, phone, favorite_genres, marketing_opt_in, reward_points)")
        .eq("event_id", id)
        .not("customer_id", "is", null),
    ]);
    if (reqErr) throw reqErr;
    if (tipErr) throw tipErr;

    type CustomerJoin = CustomerRow | CustomerRow[] | null;
    const unwrap = (c: CustomerJoin): CustomerRow | null => (Array.isArray(c) ? c[0] ?? null : c);

    const byId = new Map<
      string,
      { customer: CustomerRow; requestCount: number; tipTotalCents: number }
    >();

    for (const r of requests ?? []) {
      const customer = unwrap(r.customers as CustomerJoin);
      if (!customer) continue;
      const entry = byId.get(customer.id) ?? { customer, requestCount: 0, tipTotalCents: 0 };
      entry.requestCount += 1;
      byId.set(customer.id, entry);
    }

    for (const t of tips ?? []) {
      const customer = unwrap(t.customers as CustomerJoin);
      if (!customer) continue;
      const entry = byId.get(customer.id) ?? { customer, requestCount: 0, tipTotalCents: 0 };
      entry.tipTotalCents += t.amount_cents ?? 0;
      byId.set(customer.id, entry);
    }

    const guests = [...byId.values()]
      .map(({ customer, requestCount, tipTotalCents }) => ({
        id: customer.id,
        name: customer.full_name || "Guest",
        email: customer.email,
        phone: customer.phone,
        favoriteGenres: customer.favorite_genres ?? [],
        marketingOptIn: !!customer.marketing_opt_in,
        rewardPoints: customer.reward_points ?? 0,
        requestCount,
        tipTotalCents,
      }))
      .sort((a, b) => b.tipTotalCents + b.requestCount * 100 - (a.tipTotalCents + a.requestCount * 100));

    return NextResponse.json({ guests });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
