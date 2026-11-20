import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TIMING, TEMPLATES } from "@/lib/playbook";

/** Staff: when each Wedding Playbook task is due (days from the wedding date or the booking). */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { data, error } = await createAdminClient().from("playbook_task_timing").select("key, anchor, offset_days, active");
  const saved = new Map(((error ? [] : data) ?? []).map((r: { key: string; anchor: string; offset_days: number; active: boolean }) => [r.key, r]));
  return NextResponse.json({
    ready: !error,
    timing: TEMPLATES.map((t) => {
      const r = saved.get(t.key);
      return { key: t.key, title: t.title, stage: t.stage, owner: t.owner, anchor: r?.anchor ?? DEFAULT_TIMING[t.key].anchor, offset: r?.offset_days ?? DEFAULT_TIMING[t.key].offset, active: r?.active ?? true };
    })
  });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { timing?: { key: string; offset: number; active?: boolean }[] };
  const rows = (body.timing ?? [])
    .filter((t) => DEFAULT_TIMING[t.key] && Number.isInteger(t.offset) && t.offset >= -400 && t.offset <= 120)
    .map((t) => ({ key: t.key, anchor: DEFAULT_TIMING[t.key].anchor, offset_days: t.offset, active: t.active !== false, updated_at: new Date().toISOString() }));
  if (!rows.length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const { error } = await createAdminClient().from("playbook_task_timing").upsert(rows, { onConflict: "key" });
  if (error) return NextResponse.json({ error: "Run migration 0059_wedding_playbook.sql first." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
