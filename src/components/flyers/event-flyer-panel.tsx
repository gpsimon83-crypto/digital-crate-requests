"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImagePlus, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

const field = "w-full rounded-[10px] border border-black/12 bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50";
const btn = "inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-black/12 px-3 text-xs font-medium hover:border-gold disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

/**
 * Admin event page: this night's drink specials (with the venue's default),
 * which flyer template this event uses, and a shortcut to make its flyer.
 * Specials here are the same list the venue edits in its portal.
 */
export function EventFlyerPanel({ eventId }: { eventId: string }) {
  const [sp, setSp] = useState<{ venueId: string | null; venueName: string | null; date: string | null; night: string | null; venueDefault: string | null } | null>(null);
  const [night, setNight] = useState("");
  const [venueDefault, setVenueDefault] = useState("");
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [override, setOverride] = useState<string>("");
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const s = await fetch(`/api/flyers/specials?event=${eventId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const t = await fetch("/api/admin/flyers/templates").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const a = await fetch("/api/admin/flyers/activations").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!live) return;
      if (s) {
        setSp(s);
        setNight(s.night ?? "");
        setVenueDefault(s.venueDefault ?? "");
      }
      setTemplates(((t?.templates ?? []) as { id: string; name: string; status: string }[]).filter((x) => x.status === "published"));
      setOverride(((a?.activations ?? []) as { scope: string; event_id: string | null; template_id: string }[]).find((x) => x.scope === "event" && x.event_id === eventId)?.template_id ?? "");
      setReady(a?.ready !== false);
    })();
    return () => {
      live = false;
    };
  }, [eventId]);

  async function saveSpecials(scope: "night" | "venue", text: string) {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/flyers/specials", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, scope, text }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? (scope === "night" ? "Saved this night's specials. Linked flyers pick them up." : "Saved the venue default.") : (j.error ?? "Couldn't save."));
  }
  async function saveOverride(templateId: string) {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/flyers/activations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "event", eventId, templateId: templateId || null }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? "Couldn't save.");
    setOverride(templateId);
    setMsg(templateId ? "New flyers for this event start from that template." : "This event uses the venue's (or company) template again.");
  }

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[1.5px] text-muted">Flyer &amp; drink specials</p>
        <Link href={`/dj-dashboard/flyers?event=${eventId}`} className={cn(btn, "border-gold bg-gold font-semibold text-[#1a140b]")}>
          <ImagePlus size={14} /> Make flyer
        </Link>
      </div>
      {!sp ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !sp.venueId ? (
        <p className="text-sm text-muted">Link this event to a venue to give it drink specials.</p>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">This night{sp.date ? ` (${new Date(`${sp.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })})` : ""}</span>
            <textarea className={cn(field, "min-h-[80px]")} maxLength={600} value={night} onChange={(e) => setNight(e.target.value)} placeholder={venueDefault ? `Empty uses the ${sp.venueName ?? "venue"} default` : "e.g. $5 Margaritas\n$3 Domestic bottles"} />
          </label>
          <button className={cn(btn, "self-start")} disabled={busy} onClick={() => void saveSpecials("night", night)}>
            Save for this night
          </button>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">{sp.venueName ?? "Venue"} default (nights without their own)</span>
            <textarea className={cn(field, "min-h-[64px]")} maxLength={600} value={venueDefault} onChange={(e) => setVenueDefault(e.target.value)} />
          </label>
          <button className={cn(btn, "self-start")} disabled={busy} onClick={() => void saveSpecials("venue", venueDefault)}>
            Save venue default
          </button>
        </>
      )}
      <label className="block border-t border-black/8 pt-3">
        <span className="mb-1 block text-xs font-semibold text-muted">Flyer template for this event</span>
        <select className={field} value={override} disabled={busy || !ready} onChange={(e) => void saveOverride(e.target.value)}>
          <option value="">Use the venue / company template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {!ready && <span className="mt-1 block text-[11px] text-status-pending">Needs migration 0052_flyer_event_links.sql.</span>}
      </label>
      {busy && <Loader2 size={14} className="animate-spin text-muted" />}
      {msg && <p className="text-xs text-muted" role="status">{msg}</p>}
    </GlassCard>
  );
}
