import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { createSection } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  if (!body.title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });

  try {
    const section = await createSection(id, { title: body.title.trim(), position: body.position ?? 0 });
    return NextResponse.json({ section });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
