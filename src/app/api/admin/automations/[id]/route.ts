import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { updateAutomation, deleteAutomation } from "@/lib/data/automations";
import { requireAdmin } from "@/lib/require-admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const { name, trigger, conditions, actions, isActive } = body;

  try {
    const automation = await updateAutomation(id, { name, trigger, conditions, actions, isActive });
    return NextResponse.json({ automation });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  try {
    await deleteAutomation(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
