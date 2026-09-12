import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { listCatalogItems, createCatalogItem } from "@/lib/data/package-builder";
import { canViewCost, stripCostFromCatalog } from "@/lib/packages/view-cost";
import { errorMessage } from "@/lib/error-message";

export async function GET(req: NextRequest) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const includeInactive = req.nextUrl.searchParams.get("all") === "1";
  try {
    const items = await listCatalogItems(includeInactive);
    const allowed = await canViewCost();
    return NextResponse.json({ items: stripCostFromCatalog(items, allowed) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const item = await createCatalogItem(body);
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
