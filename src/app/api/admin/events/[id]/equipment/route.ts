import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { checkConflicts, assignEquipment } from "@/lib/data/equipment-assignments";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/error-message";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const { equipmentId, quantity, notes, force } = (await req.json()) as {
    equipmentId?: string;
    quantity?: number;
    notes?: string;
    force?: boolean;
  };

  if (!equipmentId) return NextResponse.json({ error: "equipmentId is required" }, { status: 400 });
  const qty = quantity ?? 1;
  if (qty < 1) return NextResponse.json({ error: "quantity must be at least 1" }, { status: 400 });

  try {
    const conflict = await checkConflicts(id, equipmentId, qty);
    if (conflict.hasConflict && !force) {
      return NextResponse.json({ conflict }, { status: 409 });
    }

    const assignment = await assignEquipment(id, { equipmentId, quantity: qty, notes });
    await logActivity({
      action: "equipment.assigned",
      entityType: "equipment_assignment",
      entityId: assignment.id,
      eventId: id,
      metadata: { equipmentId, quantity: qty, overrodeConflict: conflict.hasConflict }
    });
    return NextResponse.json({ assignment, conflict });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
