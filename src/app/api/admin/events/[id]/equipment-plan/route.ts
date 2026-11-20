import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/comm/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { confirmPlan, planView, type ConfirmItem } from "@/lib/data/equipment-plans";
import { logActivity } from "@/lib/activity";

type P = { params: Promise<{ id: string }> };
const uuidOk = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

/** Staff or the event's DJ (read-only): the recommended setup, what it's based on, and what's already assigned. */
export async function GET(_req: NextRequest, { params }: P) {
  const id = (await params).id;
  if (!uuidOk(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const view = await planView(id);
    if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(view, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Couldn't load the equipment plan." }, { status: 503 });
  }
}

/** Staff approval: turn the (adjusted) proposal into assignments. Re-confirming updates, never duplicates. */
export async function POST(req: NextRequest, { params }: P) {
  const staff = await requireStaffUser();
  if (staff instanceof NextResponse) return staff;
  const id = (await params).id;
  if (!uuidOk(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { items?: ConfirmItem[]; force?: boolean };
  try {
    const result = await confirmPlan(id, Array.isArray(body.items) ? body.items : [], { userId: staff.userId, force: body.force === true });
    if (!result.ok) return NextResponse.json(result, { status: "conflicts" in result ? 409 : 400 });
    await logActivity({ actorUserId: staff.userId, action: "equipment.plan_confirmed", entityType: "event", entityId: id, eventId: id, metadata: { added: result.added, updated: result.updated, overbooked: result.overbooked } });
    return NextResponse.json({ ...result, view: await planView(id) });
  } catch {
    return NextResponse.json({ error: "Couldn't confirm right now. Run migration 0058 if you haven't yet." }, { status: 503 });
  }
}
