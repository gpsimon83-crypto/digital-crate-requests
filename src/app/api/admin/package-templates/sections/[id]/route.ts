import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { updateSection, deleteSection } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  try {
    const section = await updateSection(id, body);
    return NextResponse.json({ section });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  try {
    await deleteSection(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
