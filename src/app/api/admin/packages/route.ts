import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { listPackages, createPackage } from "@/lib/data/packages";
import { errorMessage } from "@/lib/error-message";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const includeInactive = req.nextUrl.searchParams.get("all") === "1";
  try {
    const packages = await listPackages(includeInactive);
    return NextResponse.json({ packages });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { name, description, price, hours, features, position } = body as {
    name?: string;
    description?: string;
    price?: number;
    hours?: number | null;
    features?: string[];
    position?: number;
  };

  if (!name?.trim() || !description?.trim() || price === undefined) {
    return NextResponse.json({ error: "name, description, and price are required" }, { status: 400 });
  }

  try {
    const pkg = await createPackage({ name: name.trim(), description: description.trim(), price, hours, features, position });
    return NextResponse.json({ package: pkg });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
