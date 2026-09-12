import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { getTemplateDetail } from "@/lib/data/package-builder";
import { generatePackageCopy, COPY_TONES, type CopyTone } from "@/lib/ai/generate-package-copy";
import { errorMessage } from "@/lib/error-message";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const field = body.field as "intro" | "confirmation";
  const tone = body.tone as CopyTone;

  if (field !== "intro" && field !== "confirmation") {
    return NextResponse.json({ error: "field must be 'intro' or 'confirmation'" }, { status: 400 });
  }
  if (!COPY_TONES.includes(tone)) {
    return NextResponse.json({ error: "Invalid tone" }, { status: 400 });
  }

  try {
    const detail = await getTemplateDetail(id);
    if (!detail) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const serviceNames = detail.sections
      .flatMap((s) => s.line_items)
      .filter((li) => li.is_client_visible && li.selection_mode !== "hidden")
      .map((li) => li.name_override ?? li.catalog_item?.name)
      .filter((n): n is string => !!n);

    const text = await generatePackageCopy({
      field,
      tone,
      templateName: detail.template.name,
      eventType: detail.template.event_type,
      tier: detail.template.tier,
      serviceNames
    });

    if (text === null) {
      return NextResponse.json({ error: "AI copy writer isn't configured yet — add ANTHROPIC_API_KEY to enable it." }, { status: 503 });
    }

    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
