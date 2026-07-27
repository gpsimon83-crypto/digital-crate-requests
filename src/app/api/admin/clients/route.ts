import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { listClients, createClientRecord } from "@/lib/data/clients";
import { requireAuth } from "@/lib/require-auth";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const clients = await listClients();
    return NextResponse.json({ clients });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { companyName, firstName, lastName } = body;

  if (!companyName && !(firstName && lastName)) {
    return NextResponse.json(
      { error: "Provide either a company name or a first and last name" },
      { status: 400 }
    );
  }

  try {
    const client = await createClientRecord(body);
    return NextResponse.json({ client });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
