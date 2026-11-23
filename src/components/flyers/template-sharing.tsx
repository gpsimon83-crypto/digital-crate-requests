"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Button } from "@/components/ui/button";
import { INPUT } from "@/components/layout/grid";
import { cn } from "@/lib/utils";
import { shareLabel, type ShareMode } from "@/lib/flyers/sharing";

/** The Share button on a template card, and the drawer to pick who gets it. */
export function TemplateSharing({ template, djs, ready, onSaved }: { template: { id: string; name: string; status: string; share_mode: ShareMode; shared_dj_ids: string[] }; djs: { id: string; display_name: string }[]; ready: boolean; onSaved: (mode: ShareMode, ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ShareMode>(template.share_mode);
  const [ids, setIds] = useState<string[]>(template.shared_dj_ids);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const shown = useMemo(() => djs.filter((d) => d.display_name.toLowerCase().includes(q.trim().toLowerCase())), [djs, q]);

  function openDrawer() {
    setMode(template.share_mode);
    setIds(template.shared_dj_ids);
    setErr(null);
    setOpen(true);
  }
  async function save() {
    if (mode === "selected" && ids.length === 0) return setErr("Pick at least one DJ, or choose Office only.");
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/flyers/templates/${template.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shareMode: mode, sharedDjIds: mode === "selected" ? ids : [] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Couldn't save");
      onSaved(mode, mode === "selected" ? ids : []);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const label = shareLabel(template.share_mode, template.shared_dj_ids.length);
  return (
    <>
      <button type="button" onClick={openDrawer} data-tour="flyer-tpl-share" aria-label={`Who gets ${template.name}: ${label}`} className={cn("inline-flex h-8 items-center gap-1 rounded-[8px] border px-2.5 text-xs hover:border-gold", template.share_mode === "office" ? "border-black/12 text-muted" : "border-gold/50")}>
        <Users size={13} aria-hidden /> {label}
      </button>
      <SideDrawer open={open} onClose={() => setOpen(false)} title={`Share “${template.name}”`} subtitle={template.status === "published" ? "Who sees it in their DJ portal Flyers." : "Who will see it once it's published."}>
        {!ready ? (
          <p className="text-sm">Run migration <strong>0068_flyer_template_sharing.sql</strong> in Supabase to choose who gets templates. Until then every published template goes to all DJs.</p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Who gets it</legend>
              {(
                [
                  ["all", "All DJs", "Every DJ, including ones you add later."],
                  ["selected", "Chosen DJs", "Only the DJs you tick below."],
                  ["office", "Office only", "Hidden from DJs. Staff can still use it."]
                ] as const
              ).map(([v, l, h]) => (
                <label key={v} className={cn("flex cursor-pointer gap-3 rounded-[10px] border p-3", mode === v ? "border-gold bg-gold/5" : "border-border")}>
                  <input type="radio" name="share-mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="mt-1 accent-[var(--gold)]" />
                  <span>
                    <span className="block text-sm font-semibold">{l}</span>
                    <span className="block text-xs text-muted">{h}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {mode === "selected" && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  DJs ({ids.length} picked)
                </legend>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search DJs" aria-label="Search DJs" className={INPUT} />
                <div className="flex gap-3 text-xs">
                  <button type="button" className="text-gold hover:underline" onClick={() => setIds([...new Set([...ids, ...shown.map((d) => d.id)])])}>
                    Tick all shown
                  </button>
                  <button type="button" className="text-muted hover:underline" onClick={() => setIds([])}>
                    Clear
                  </button>
                </div>
                <ul className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto">
                  {shown.map((d) => (
                    <li key={d.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-sm hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)]">
                        <input type="checkbox" checked={ids.includes(d.id)} onChange={(e) => setIds((x) => (e.target.checked ? [...x, d.id] : x.filter((y) => y !== d.id)))} className="h-4 w-4 accent-[var(--gold)]" />
                        {d.display_name}
                      </label>
                    </li>
                  ))}
                  {shown.length === 0 && <li className="px-2 text-sm text-muted">No DJs match.</li>}
                </ul>
              </fieldset>
            )}
            <p className="text-xs text-muted">Flyers DJs already made from it stay theirs. A template you turn on for a venue or event (Activate) still starts that venue&apos;s or event&apos;s flyers.</p>
            {err && (
              <p role="alert" className="text-sm text-status-declined">
                {err}
              </p>
            )}
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </form>
        )}
      </SideDrawer>
    </>
  );
}
