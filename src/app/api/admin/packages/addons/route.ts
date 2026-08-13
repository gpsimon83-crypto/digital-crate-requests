import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { listPackageAddons, createPackageAddon } from "@/lib/data/packages";
import { errorMessage } from "@/lib/error-message";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const includeInactive = req.nextUrl.searchParams.get("all") === "1";
  try {
    const addons = await listPackageAddons(includeInactive);
    return NextResponse.json({ addons });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { name, description, price, position } = body as { name?: string; description?: string; price?: number; position?: number };

  if (!name?.trim() || !description?.trim() || price === undefined) {
    return NextResponse.json({ error: "name, description, and price are required" }, { status: 400 });
  }

  try {
    const addon = await createPackageAddon({ name: name.trim(), description: description.trim(), price, position });
    return NextResponse.json({ addon });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
