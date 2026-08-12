import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { updateSection, deleteSection } from "@/lib/data/questionnaires";
import { errorMessage } from "@/lib/error-message";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { sectionId } = await params;
  const body = await req.json();
  const { title, position, transitionHeading, transitionSubheading } = body as {
    title?: string;
    position?: number;
    transitionHeading?: string | null;
    transitionSubheading?: string | null;
  };

  try {
    const section = await updateSection(sectionId, { title, position, transitionHeading, transitionSubheading });
    return NextResponse.json({ section });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { sectionId } = await params;
  try {
    await deleteSection(sectionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
