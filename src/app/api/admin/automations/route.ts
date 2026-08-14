import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { listAutomations, createAutomation } from "@/lib/data/automations";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const automations = await listAutomations();
    return NextResponse.json({ automations });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { name, trigger, conditions, actions } = body;
  if (!name || !trigger) {
    return NextResponse.json({ error: "name and trigger are required" }, { status: 400 });
  }

  try {
    const automation = await createAutomation({ name, trigger, conditions: conditions ?? [], actions: actions ?? [] });
    return NextResponse.json({ automation });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
