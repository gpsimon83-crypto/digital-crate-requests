import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flyerAdmin, flyerError, uuidOk } from "@/lib/flyers/server";
import { parseTemplateContent } from "@/lib/flyers/scene";

type Params = { params: Promise<{ id: string }> };

/**
 * Publish the current draft as a new numbered version. New flyers use it;
 * flyers already started keep the version they were made from.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const admin = await flyerAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  if (!uuidOk(id)) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  try {
    const db = createAdminClient();
    const { data: t, error } = await db.from("flyer_templates").select("id, draft").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!t) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    const content = parseTemplateContent(t.draft);
    if (!content.ok) return NextResponse.json({ error: content.error }, { status: 400 });
    const sizes = Object.values(content.value.formats);
    if (!sizes.length) return NextResponse.json({ error: "Add at least one size before publishing." }, { status: 400 });
    if (sizes.some((s) => !s!.nodes.length)) return NextResponse.json({ error: "Every size needs at least one layer." }, { status: 400 });

    const { data: last } = await db.from("flyer_template_versions").select("version").eq("template_id", id).order("version", { ascending: false }).limit(1).maybeSingle();
    const version = ((last?.version as number) ?? 0) + 1;
    const { data: v, error: vErr } = await db.from("flyer_template_versions").insert({ template_id: id, version, content: content.value, published_by: admin.user.id }).select("id, version, published_at").single();
    if (vErr) throw vErr;
    const { error: uErr } = await db.from("flyer_templates").update({ current_version_id: v.id, status: "published", updated_by: admin.user.id, updated_at: new Date().toISOString() }).eq("id", id);
    if (uErr) throw uErr;
    return NextResponse.json({ ok: true, version: v });
  } catch (err) {
    return flyerError(err);
  }
}
