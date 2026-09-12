import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { getTemplateDetail, updateTemplate, deleteTemplate, bumpTemplateVersion } from "@/lib/data/package-builder";
import { canViewCost, stripCostFromCatalog } from "@/lib/packages/view-cost";
import { errorMessage } from "@/lib/error-message";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  try {
    const detail = await getTemplateDetail(id);
    if (!detail) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const allowed = await canViewCost();
    const sections = detail.sections.map((s) => ({
      ...s,
      line_items: s.line_items.map((li) => ({
        ...li,
        catalog_item: li.catalog_item ? stripCostFromCatalog([li.catalog_item], allowed)[0] : null
      }))
    }));

    return NextResponse.json({ ...detail, sections });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const { bumpVersion, ...updates } = body as { bumpVersion?: boolean; [k: string]: unknown };

  try {
    const template = bumpVersion ? await bumpTemplateVersion(id) : await updateTemplate(id, updates);
    return NextResponse.json({ template });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  try {
    await deleteTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
