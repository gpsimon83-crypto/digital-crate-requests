import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createSection } from "@/lib/data/questionnaires";
import { errorMessage } from "@/lib/error-message";

export async function POST(req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { templateId } = await params;
  const body = await req.json();
  const { key, title, position, transitionHeading, transitionSubheading } = body as {
    key?: string;
    title?: string;
    position?: number;
    transitionHeading?: string;
    transitionSubheading?: string;
  };

  if (!key?.trim() || !title?.trim() || position === undefined) {
    return NextResponse.json({ error: "key, title, and position are required" }, { status: 400 });
  }

  try {
    const section = await createSection(templateId, { key: key.trim(), title: title.trim(), position, transitionHeading, transitionSubheading });
    return NextResponse.json({ section });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
