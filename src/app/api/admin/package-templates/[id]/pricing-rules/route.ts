import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { createPricingRule } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  if (!body.label?.trim() || !body.ruleType || !body.adjustmentType || body.adjustmentValue === undefined) {
    return NextResponse.json({ error: "label, ruleType, adjustmentType, and adjustmentValue are required" }, { status: 400 });
  }

  try {
    const rule = await createPricingRule(id, {
      rule_type: body.ruleType,
      label: body.label.trim(),
      match: body.match ?? {},
      adjustment_type: body.adjustmentType,
      adjustment_value: body.adjustmentValue,
      position: body.position ?? 0
    });
    return NextResponse.json({ rule });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
