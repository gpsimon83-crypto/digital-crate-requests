import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getTemplateByIdForAdmin, updateTemplate } from "@/lib/data/questionnaires";
import { errorMessage } from "@/lib/error-message";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { templateId } = await params;
  try {
    const result = await getTemplateByIdForAdmin(templateId);
    if (!result) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { templateId } = await params;
  const body = await req.json();
  const { title, openingHeading, openingBody, openingCtaLabel, isActive } = body as {
    title?: string;
    openingHeading?: string;
    openingBody?: string;
    openingCtaLabel?: string;
    isActive?: boolean;
  };

  try {
    const template = await updateTemplate(templateId, {
      ...(title !== undefined ? { title } : {}),
      ...(openingHeading !== undefined ? { opening_heading: openingHeading } : {}),
      ...(openingBody !== undefined ? { opening_body: openingBody } : {}),
      ...(openingCtaLabel !== undefined ? { opening_cta_label: openingCtaLabel } : {}),
      ...(isActive !== undefined ? { is_active: isActive } : {})
    });
    return NextResponse.json({ template });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
