import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { listTemplates, createTemplate, duplicateTemplate } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

export async function GET() {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  try {
    const templates = await listTemplates();
    return NextResponse.json({ templates });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const body = await req.json();
  const { duplicateFrom, name, ...rest } = body as { duplicateFrom?: string; name?: string; [k: string]: unknown };

  try {
    if (duplicateFrom) {
      const template = await duplicateTemplate(duplicateFrom, { name });
      return NextResponse.json({ template });
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const template = await createTemplate({ name: name.trim(), ...rest });
    return NextResponse.json({ template });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
