import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { updateGigEquipmentRule, deleteGigEquipmentRule } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("equipment_rules.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (body.label !== undefined) patch.label = body.label;
  if (body.conditions !== undefined) patch.conditions = body.conditions;
  if (body.catalogItemId !== undefined) patch.catalog_item_id = body.catalogItemId;
  if (body.quantity !== undefined) patch.quantity = body.quantity;
  if (body.reason !== undefined) patch.reason = body.reason;
  if (body.position !== undefined) patch.position = body.position;
  if (body.isActive !== undefined) patch.is_active = body.isActive;

  try {
    const rule = await updateGigEquipmentRule(id, patch);
    return NextResponse.json({ rule });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("equipment_rules.manage");
  if (denied) return denied;

  const { id } = await params;
  try {
    await deleteGigEquipmentRule(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
