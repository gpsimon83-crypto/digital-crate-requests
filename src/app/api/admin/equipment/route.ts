import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { listEquipment, createEquipment } from "@/lib/data/equipment";
import { requireAuth } from "@/lib/require-auth";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const equipment = await listEquipment();
    return NextResponse.json({ equipment });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { category, name } = body;
  if (!category || !name) {
    return NextResponse.json({ error: "category and name are required" }, { status: 400 });
  }

  try {
    const item = await createEquipment(body);
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
