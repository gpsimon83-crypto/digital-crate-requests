import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createClient } from "@/lib/supabase/server";
import { getClientForAuthUser, getClientEvent, updateClientEventNight } from "@/lib/data/portal";
import { listEventPayments, computeBalance } from "@/lib/data/payments";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  try {
    const client = await getClientForAuthUser(user.id);
    if (!client) return NextResponse.json({ error: "No client record linked to this account" }, { status: 403 });

    const event = await getClientEvent(client.id, id);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // Payments is a separate concern from the rest of this page (contract,
    // night-builder) — a failure here (e.g. the payments migration not
    // applied yet) shouldn't take down the whole event page.
    let payments: Awaited<ReturnType<typeof listEventPayments>> = [];
    let balance = computeBalance(event, []);
    try {
      payments = await listEventPayments(id);
      balance = computeBalance(event, payments);
    } catch {
      // leave payments/balance at their zeroed defaults
    }

    return NextResponse.json({ event, payments, balance });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { mustPlay, doNotPlay, specialRequests, weddingMusicPlan } = body;

  try {
    const client = await getClientForAuthUser(user.id);
    if (!client) return NextResponse.json({ error: "No client record linked to this account" }, { status: 403 });

    const event = await updateClientEventNight(client.id, id, {
      ...(mustPlay !== undefined ? { must_play: mustPlay } : {}),
      ...(doNotPlay !== undefined ? { do_not_play: doNotPlay } : {}),
      ...(specialRequests !== undefined ? { special_requests: specialRequests } : {}),
      ...(weddingMusicPlan !== undefined ? { wedding_music_plan: weddingMusicPlan } : {})
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
