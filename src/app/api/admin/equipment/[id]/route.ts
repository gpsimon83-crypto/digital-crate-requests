import { NextRequest, NextResponse } from "next/server";
import { EQUIPMENT_FIELDS, pickEditable } from "@/lib/editable-fields";
import { errorMessage } from "@/lib/error-message";
import { updateEquipment, deleteEquipment } from "@/lib/data/equipment";
import { requireAdmin } from "@/lib/require-admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const picked = pickEditable(body, EQUIPMENT_FIELDS);
  if (!picked.ok) return NextResponse.json({ error: picked.error }, { status: 400 });
  if (picked.values.name === null || picked.values.category === null) return NextResponse.json({ error: "An item needs a name and a category" }, { status: 400 });
  if (Object.keys(picked.values).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  try {
    const item = await updateEquipment(id, picked.values);
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  try {
    await deleteEquipment(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
