import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireEventAccess } from "@/lib/require-event-access";
import { createTask } from "@/lib/data/tasks";
import { playbookView } from "@/lib/data/playbook";
import { createAdminClient } from "@/lib/supabase/admin";
import { REQUEST_KINDS } from "@/lib/playbook";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/error-message";

/** The event's tasks for staff or the assigned DJ: the Wedding Playbook (for weddings) plus manual tasks. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const view = await playbookView(id, access.isAdmin ? "staff" : "dj");
    return NextResponse.json({ ...view, viewer: access.isAdmin ? "staff" : "dj" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/**
 * A manual task ({ title, dueDate }), or a request for the booking lead
 * ({ request: { kind, details } }) — extra coverage, overtime or a package
 * change. The DJ can raise requests; pricing stays with booking staff.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => ({}))) as { title?: string; dueDate?: string | null; request?: { kind?: string; details?: string } };

  if (body.request) {
    const kind = body.request.kind as keyof typeof REQUEST_KINDS;
    const details = String(body.request.details ?? "").trim().slice(0, 1000);
    if (!(kind in REQUEST_KINDS) || !details) return NextResponse.json({ error: "Say what's needed." }, { status: 400 });
    const { data, error } = await createAdminClient()
      .from("tasks")
      .insert({
        event_id: id,
        template_key: `request:${randomUUID()}`,
        owner: "booking_lead",
        title: `${REQUEST_KINDS[kind]} request`,
        status: "open",
        created_by: access.user.id,
        data: { kind, details, requestedBy: access.isAdmin ? "staff" : (access.dj?.display_name ?? "DJ") }
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
    await logActivity({ actorUserId: access.user.id, action: "task.request_raised", entityType: "event", entityId: id, eventId: id, metadata: { kind } });
    return NextResponse.json({ task: data });
  }

  const { title, dueDate } = body;
  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  try {
    const task = await createTask(id, { title: title.trim(), dueDate, createdBy: access.user.id });
    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
