import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { requireAdmin } from "@/lib/require-admin";
import { listCatalogItems } from "@/lib/data/package-builder";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DjServiceRow } from "@/app/api/dj/services/route";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id: djId } = await params;

  try {
    const [catalogItems, offerings] = await Promise.all([
      listCatalogItems(),
      createAdminClient().from("dj_service_offerings").select("*").eq("dj_id", djId)
    ]);
    if (offerings.error) throw offerings.error;

    const offeringByCatalogId = new Map(offerings.data.map((o) => [o.catalog_item_id, o]));

    const services: DjServiceRow[] = catalogItems.map((c) => {
      const offering = offeringByCatalogId.get(c.id);
      return {
        catalog_item_id: c.id,
        name: c.name,
        description: c.description,
        category: c.category,
        pricing_method: c.pricing_method,
        unit_label: c.unit_label,
        default_price_cents: c.price_cents,
        price_cents: offering?.price_cents ?? c.price_cents,
        min_quantity: offering?.min_quantity ?? c.min_quantity,
        max_quantity: offering?.max_quantity ?? c.max_quantity,
        is_offered: offering?.is_offered ?? true,
        is_set_up: !!offering
      };
    });

    return NextResponse.json({ services });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id: djId } = await params;
  const body = await req.json();
  const { catalogItemId, priceCents, minQuantity, maxQuantity, isOffered } = body as {
    catalogItemId?: string;
    priceCents?: number;
    minQuantity?: number | null;
    maxQuantity?: number | null;
    isOffered?: boolean;
  };
  if (!catalogItemId || typeof priceCents !== "number" || typeof isOffered !== "boolean") {
    return NextResponse.json({ error: "catalogItemId, priceCents, and isOffered are required" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("dj_service_offerings")
      .upsert(
        {
          dj_id: djId,
          catalog_item_id: catalogItemId,
          price_cents: priceCents,
          min_quantity: minQuantity ?? null,
          max_quantity: maxQuantity ?? null,
          is_offered: isOffered,
          updated_at: new Date().toISOString()
        },
        { onConflict: "dj_id,catalog_item_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ offering: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
