import { NextRequest, NextResponse } from "next/server";
import { CLIENT_FIELDS, pickEditable } from "@/lib/editable-fields";
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
  const body = await req.json().catch(() => ({}));
  const picked = pickEditable(body, CLIENT_FIELDS);
  if (!picked.ok) return NextResponse.json({ error: picked.error }, { status: 400 });
  if (Object.keys(picked.values).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  try {
    const client = await updateClient(id, picked.values);
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
