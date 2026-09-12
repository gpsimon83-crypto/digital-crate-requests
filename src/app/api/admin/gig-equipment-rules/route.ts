import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { listGigEquipmentRules, createGigEquipmentRule } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

// Deliberately gated to equipment_rules.manage (owner/admin only) — a
// narrower capability than packages.manage, per explicit request that
// these rules (which set locked equipment minimums) stay admin-only.
export async function GET() {
  const denied = await requirePermission("equipment_rules.manage");
  if (denied) return denied;

  try {
    const rules = await listGigEquipmentRules();
    return NextResponse.json({ rules });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requirePermission("equipment_rules.manage");
  if (denied) return denied;

  const body = await req.json();
  if (!body.label?.trim() || !body.catalogItemId) {
    return NextResponse.json({ error: "label and catalogItemId are required" }, { status: 400 });
  }

  try {
    const rule = await createGigEquipmentRule({
      label: body.label.trim(),
      conditions: body.conditions ?? [],
      catalog_item_id: body.catalogItemId,
      quantity: body.quantity ?? 1,
      reason: body.reason ?? null
    });
    return NextResponse.json({ rule });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
