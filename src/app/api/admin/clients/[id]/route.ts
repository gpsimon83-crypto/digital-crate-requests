import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { getClient, updateClient, deleteClient } from "@/lib/data/clients";
import { requireAuth } from "@/lib/require-auth";
import { requireAdmin } from "@/lib/require-admin";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  try {
    const client = await getClient(id);
    return NextResponse.json({ client });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  try {
    const client = await updateClient(id, body);
    return NextResponse.json({ client });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  try {
    await deleteClient(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
