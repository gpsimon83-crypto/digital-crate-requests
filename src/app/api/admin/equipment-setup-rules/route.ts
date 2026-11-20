import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanSetupRule } from "@/lib/equipment-rules-input";

/** Equipment setup rules (Admin → Equipment). Same capability as the package equipment rules. */
export async function GET() {
  const denied = await requirePermission("equipment_rules.manage");
  if (denied) return denied;
  const { data, error } = await createAdminClient().from("equipment_setup_rules").select("*").order("space").order("position");
  if (error) return NextResponse.json({ ready: false, rules: [] });
  return NextResponse.json({ ready: true, rules: data ?? [] });
}

export async function POST(req: NextRequest) {
  const denied = await requirePermission("equipment_rules.manage");
  if (denied) return denied;
  const rule = cleanSetupRule(await req.json().catch(() => ({})));
  if ("error" in rule) return NextResponse.json({ error: rule.error }, { status: 400 });
  const { data, error } = await createAdminClient().from("equipment_setup_rules").insert(rule).select("*").single();
  if (error) return NextResponse.json({ error: "Couldn't save. Run migration 0058 if you haven't yet." }, { status: 503 });
  return NextResponse.json({ rule: data });
}
