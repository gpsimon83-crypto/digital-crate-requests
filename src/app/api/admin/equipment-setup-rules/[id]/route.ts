import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanSetupRule } from "@/lib/equipment-rules-input";

type P = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: P) {
  const denied = await requirePermission("equipment_rules.manage");
  if (denied) return denied;
  const id = (await params).id;
  const rule = cleanSetupRule(await req.json().catch(() => ({})), true);
  if ("error" in rule) return NextResponse.json({ error: rule.error }, { status: 400 });
  const { data, error } = await createAdminClient().from("equipment_setup_rules").update({ ...rule, updated_at: new Date().toISOString() }).eq("id", id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ rule: data });
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const denied = await requirePermission("equipment_rules.manage");
  if (denied) return denied;
  const { error } = await createAdminClient().from("equipment_setup_rules").delete().eq("id", (await params).id);
  if (error) return NextResponse.json({ error: "Couldn't delete." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
