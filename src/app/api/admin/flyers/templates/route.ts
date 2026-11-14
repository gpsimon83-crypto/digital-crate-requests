import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureSampleTemplate, flyerAdmin, flyerError, uuidOk } from "@/lib/flyers/server";
import { emptyScene, parseTemplateContent } from "@/lib/flyers/scene";
import { FORMATS, type FormatKey, type TemplateContent } from "@/lib/flyers/types";

/** Staff: every template (drafts, published, archived) with version counts and how many flyers use each. */
export async function GET() {
  const admin = await flyerAdmin();
  if (admin instanceof NextResponse) return admin;
  try {
    const db = createAdminClient();
    await ensureSampleTemplate(db, admin.user.id);
    const { data, error } = await db.from("flyer_templates").select("id, slug, name, description, venue_id, status, current_version_id, draft, updated_at").order("updated_at", { ascending: false });
    if (error) throw error;
    const { data: versions } = await db.from("flyer_template_versions").select("id, template_id, version, published_at");
    const { data: designs } = await db.from("flyer_designs").select("template_id");
    const { data: venues } = await db.from("venues").select("id, name").order("name");
    const rows = (data ?? []) as { id: string; draft: TemplateContent; current_version_id: string | null }[];
    return NextResponse.json({
      templates: rows.map((t) => {
        const vs = ((versions ?? []) as { id: string; template_id: string; version: number; published_at: string }[]).filter((v) => v.template_id === t.id);
        const current = vs.find((v) => v.id === t.current_version_id);
        return {
          ...t,
          formats: Object.keys(t.draft?.formats ?? {}),
          versions: vs.length,
          current_version: current?.version ?? null,
          published_at: current?.published_at ?? null,
          designs: ((designs ?? []) as { template_id: string | null }[]).filter((d) => d.template_id === t.id).length
        };
      }),
      venues: venues ?? []
    });
  } catch (err) {
    return flyerError(err);
  }
}

/** Create a template (optionally as a copy of another), starting with the chosen sizes. */
export async function POST(req: NextRequest) {
  const admin = await flyerAdmin();
  if (admin instanceof NextResponse) return admin;
  const b = (await req.json().catch(() => ({}))) as { name?: string; formats?: string[]; copyFrom?: string; venueId?: string | null; draft?: unknown };
  const name = (b.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "Give the template a name." }, { status: 400 });
  try {
    const db = createAdminClient();
    let draft: TemplateContent = { formats: {} };
    if (b.draft !== undefined) {
      // e.g. a layered SVG imported in the browser
      const p = parseTemplateContent(b.draft);
      if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
      if (!Object.keys(p.value.formats).length) return NextResponse.json({ error: "Nothing to import." }, { status: 400 });
      draft = p.value;
    } else if (b.copyFrom && uuidOk(b.copyFrom)) {
      const { data } = await db.from("flyer_templates").select("draft").eq("id", b.copyFrom).maybeSingle();
      if (data) draft = data.draft as TemplateContent;
    } else {
      const keys = (b.formats ?? ["portrait"]).filter((f): f is FormatKey => f in FORMATS);
      for (const k of keys.length ? keys : (["portrait"] as FormatKey[])) draft.formats[k] = emptyScene(k);
    }
    const { data, error } = await db
      .from("flyer_templates")
      .insert({ name, status: "draft", draft, venue_id: b.venueId && uuidOk(b.venueId) ? b.venueId : null, created_by: admin.user.id, updated_by: admin.user.id })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (err) {
    return flyerError(err);
  }
}
