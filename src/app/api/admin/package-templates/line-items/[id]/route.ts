import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { updateLineItem, deleteLineItem } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (body.catalogItemId !== undefined) patch.catalog_item_id = body.catalogItemId;
  if (body.nameOverride !== undefined) patch.name_override = body.nameOverride;
  if (body.descriptionOverride !== undefined) patch.description_override = body.descriptionOverride;
  if (body.pricingMethodOverride !== undefined) patch.pricing_method_override = body.pricingMethodOverride;
  if (body.priceCentsOverride !== undefined) patch.price_cents_override = body.priceCentsOverride;
  if (body.includedQuantity !== undefined) patch.included_quantity = body.includedQuantity;
  if (body.minQuantity !== undefined) patch.min_quantity = body.minQuantity;
  if (body.maxQuantity !== undefined) patch.max_quantity = body.maxQuantity;
  if (body.selectionMode !== undefined) patch.selection_mode = body.selectionMode;
  if (body.isClientVisible !== undefined) patch.is_client_visible = body.isClientVisible;
  if (body.position !== undefined) patch.position = body.position;

  try {
    const lineItem = await updateLineItem(id, patch);
    return NextResponse.json({ lineItem });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  try {
    await deleteLineItem(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
