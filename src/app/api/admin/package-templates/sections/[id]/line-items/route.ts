import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { createLineItem } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  if (!body.catalogItemId && !body.nameOverride?.trim()) {
    return NextResponse.json({ error: "catalogItemId or nameOverride is required" }, { status: 400 });
  }

  try {
    const lineItem = await createLineItem(id, {
      catalog_item_id: body.catalogItemId ?? null,
      name_override: body.nameOverride ?? null,
      description_override: body.descriptionOverride ?? null,
      pricing_method_override: body.pricingMethodOverride ?? null,
      price_cents_override: body.priceCentsOverride ?? null,
      included_quantity: body.includedQuantity ?? 0,
      min_quantity: body.minQuantity ?? null,
      max_quantity: body.maxQuantity ?? null,
      selection_mode: body.selectionMode ?? "optional",
      is_client_visible: body.isClientVisible ?? true,
      position: body.position ?? 0
    });
    return NextResponse.json({ lineItem });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
