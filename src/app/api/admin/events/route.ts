import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { listEvents, createEvent } from "@/lib/data/events";
import { requireAuth } from "@/lib/require-auth";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const events = await listEvents();
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { title, djId, venueId, startsAt, endsAt } = body;

  if (!title || !startsAt) {
    return NextResponse.json({ error: "title and startsAt are required" }, { status: 400 });
  }

  try {
    const event = await createEvent({ title, djId, venueId, startsAt, endsAt });
    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
