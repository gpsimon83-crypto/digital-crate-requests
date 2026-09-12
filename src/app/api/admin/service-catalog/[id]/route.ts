import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { updateCatalogItem, deleteCatalogItem } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  try {
    const item = await updateCatalogItem(id, body);
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  try {
    await deleteCatalogItem(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
