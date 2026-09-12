import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { createRule } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  if (!body.ruleType) return NextResponse.json({ error: "ruleType is required" }, { status: 400 });

  try {
    const rule = await createRule(id, {
      rule_type: body.ruleType,
      subject_line_item_id: body.subjectLineItemId ?? null,
      target_line_item_id: body.targetLineItemId ?? null,
      condition: body.condition ?? null
    });
    return NextResponse.json({ rule });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
