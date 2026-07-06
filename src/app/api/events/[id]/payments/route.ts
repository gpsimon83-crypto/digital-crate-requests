import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/require-auth";
import { errorMessage } from "@/lib/error-message";

interface PaymentRow {
  id: string;
  type: "tip" | "request" | "boost";
  guest: string;
  song: string | null;
  amountCents: number;
  status: "authorized" | "captured" | "canceled";
  createdAt: string;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await params;

  try {
    const db = createAdminClient();
    const [{ data: tips, error: tipErr }, { data: requests, error: reqErr }, { data: boosts, error: boostErr }] =
      await Promise.all([
        db.from("tips").select("id, amount_cents, created_at, customers(full_name)").eq("event_id", id),
        db
          .from("song_requests")
          .select("id, song_title, amount_cents, payment_status, is_paid, created_at, customers(full_name)")
          .eq("event_id", id)
          .eq("is_paid", true),
        db
          .from("boosts")
          .select("id, amount_cents, created_at, customers(full_name), song_requests!inner(song_title, event_id)")
          .eq("song_requests.event_id", id),
      ]);
    if (tipErr) throw tipErr;
    if (reqErr) throw reqErr;
    if (boostErr) throw boostErr;

    type CustomerJoin = { full_name: string | null } | { full_name: string | null }[] | null;
    const nameOf = (c: CustomerJoin) => {
      if (!c) return "Guest";
      const row = Array.isArray(c) ? c[0] : c;
      return row?.full_name || "Guest";
    };

    const payments: PaymentRow[] = [
      ...(tips ?? []).map((t) => ({
        id: `tip-${t.id}`,
        type: "tip" as const,
        guest: nameOf(t.customers as CustomerJoin),
        song: null,
        amountCents: t.amount_cents,
        status: "captured" as const,
        createdAt: t.created_at,
      })),
      ...(requests ?? []).map((r) => ({
        id: `req-${r.id}`,
        type: "request" as const,
        guest: nameOf(r.customers as CustomerJoin),
        song: r.song_title,
        amountCents: r.amount_cents,
        status: (r.payment_status === "captured"
          ? "captured"
          : r.payment_status === "canceled"
            ? "canceled"
            : "authorized") as PaymentRow["status"],
        createdAt: r.created_at,
      })),
      ...(boosts ?? []).map((b) => {
        const req = b.song_requests as { song_title: string } | { song_title: string }[] | null;
        const song = Array.isArray(req) ? req[0]?.song_title : req?.song_title;
        return {
          id: `boost-${b.id}`,
          type: "boost" as const,
          guest: nameOf(b.customers as CustomerJoin),
          song: song ?? null,
          amountCents: b.amount_cents,
          status: "captured" as const,
          createdAt: b.created_at,
        };
      }),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ payments });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
