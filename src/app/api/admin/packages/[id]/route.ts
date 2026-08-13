import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { updatePackage, deletePackage } from "@/lib/data/packages";
import { errorMessage } from "@/lib/error-message";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const { name, description, price, hours, features, position, isActive } = body as {
    name?: string;
    description?: string;
    price?: number;
    hours?: number | null;
    features?: string[];
    position?: number;
    isActive?: boolean;
  };

  try {
    const pkg = await updatePackage(id, { name, description, price, hours, features, position, isActive });
    return NextResponse.json({ package: pkg });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  try {
    await deletePackage(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
