import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { listSucceededPayments } from "@/lib/data/payments";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const payments = await listSucceededPayments();
    return NextResponse.json({ payments });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
