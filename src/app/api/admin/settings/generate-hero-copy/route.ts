import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { generateHeroCopy } from "@/lib/ai/generate-package-copy";
import { errorMessage } from "@/lib/error-message";

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const field = body.field as "heading" | "subheading";
  const surface = body.surface as "portal" | "admin";

  if (field !== "heading" && field !== "subheading") {
    return NextResponse.json({ error: "field must be 'heading' or 'subheading'" }, { status: 400 });
  }
  if (surface !== "portal" && surface !== "admin") {
    return NextResponse.json({ error: "surface must be 'portal' or 'admin'" }, { status: 400 });
  }

  try {
    const text = await generateHeroCopy({ field, surface });
    if (text === null) {
      return NextResponse.json({ error: "AI copy writer isn't configured yet — add ANTHROPIC_API_KEY to enable it." }, { status: 503 });
    }
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
