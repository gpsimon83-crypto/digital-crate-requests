import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { listExpenses, createExpense } from "@/lib/data/expenses";
import { requirePermission } from "@/lib/require-permission";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const denied = await requirePermission("finance.view_company");
  if (denied) return denied;

  try {
    const expenses = await listExpenses();
    return NextResponse.json({ expenses });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requirePermission("finance.manage");
  if (denied) return denied;

  const body = await req.json();
  const { description, amountCents, category, eventId, incurredOn } = body as {
    description?: string;
    amountCents?: number;
    category?: string;
    eventId?: string;
    incurredOn?: string;
  };
  if (!description?.trim() || !amountCents || amountCents <= 0) {
    return NextResponse.json({ error: "description and a positive amountCents are required" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const expense = await createExpense({ description: description.trim(), amountCents, category, eventId, incurredOn, createdBy: user?.id });
    return NextResponse.json({ expense });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
