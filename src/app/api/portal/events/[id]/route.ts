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

    const payments = await listEventPayments(id);
    const balance = computeBalance(event, payments);

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
  const { mustPlay, doNotPlay, specialRequests } = body;

  try {
    const client = await getClientForAuthUser(user.id);
    if (!client) return NextResponse.json({ error: "No client record linked to this account" }, { status: 403 });

    const event = await updateClientEventNight(client.id, id, {
      ...(mustPlay !== undefined ? { must_play: mustPlay } : {}),
      ...(doNotPlay !== undefined ? { do_not_play: doNotPlay } : {}),
      ...(specialRequests !== undefined ? { special_requests: specialRequests } : {})
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
