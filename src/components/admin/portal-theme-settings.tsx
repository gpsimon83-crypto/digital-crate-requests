"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { EVENT_CATEGORY_LABELS, type EventCategory } from "@/lib/event-category";
import { DEFAULT_PORTAL_THEME_BY_CATEGORY, PORTAL_THEMES, resolvePortalTheme } from "@/lib/portal-themes";

/**
 * Admin → Settings: which client-portal look each event type uses. A single
 * event can still pick its own in the project's Customize Portal panel.
 */
export function PortalThemeSettings() {
  const [byCategory, setByCategory] = useState<Record<string, string> | null>(null);
  const [ready, setReady] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings/portal-themes")
      .then((r) => r.json())
      .then((j) => {
        setReady(j.ready !== false);
        setByCategory(j.byCategory ?? {});
      })
      .catch(() => setByCategory({}));
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    const r = await fetch("/api/admin/settings/portal-themes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ byCategory }) });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    setMsg(r.ok ? "Saved" : (j.error ?? "Couldn't save."));
  }

  const categories = Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[];
  return (
    <GlassCard className="flex flex-col gap-4" data-tour="settings-portal-looks">
      <div className="flex items-center gap-3">
        <Palette size={18} className="shrink-0 text-gold" />
        <div>
          <p className="text-sm font-semibold">Client portal looks</p>
          <p className="text-xs text-muted">The palette clients see for each event type. Any event can override it in its project&rsquo;s Customize Portal panel.</p>
        </div>
      </div>
      {!ready && <p className="rounded-[10px] bg-status-pending/10 p-3 text-xs text-status-pending">Run migration 0057_portal_themes.sql in Supabase to save these. Until then the built-in defaults apply.</p>}
      {byCategory && (
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((c) => {
            const value = resolvePortalTheme(c, null, byCategory);
            const swatch = PORTAL_THEMES.find((t) => t.id === value)!.swatch;
            return (
              <label key={c} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 overflow-hidden rounded-full border border-black/10" aria-hidden>
                  <span className="h-full w-1/2" style={{ background: swatch[0] }} />
                  <span className="h-full w-1/2" style={{ background: swatch[1] }} />
                </span>
                <span className="w-40 shrink-0">{EVENT_CATEGORY_LABELS[c]}</span>
                <select
                  value={value}
                  onChange={(e) => setByCategory((b) => ({ ...(b ?? {}), [c]: e.target.value }))}
                  className="min-w-0 flex-1 rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                >
                  {PORTAL_THEMES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {DEFAULT_PORTAL_THEME_BY_CATEGORY[c] === t.id || (!DEFAULT_PORTAL_THEME_BY_CATEGORY[c] && t.id === "ink-brass") ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={save} disabled={saving || !ready || !byCategory} className="w-fit">
          {saving ? "Saving…" : "Save looks"}
        </Button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
    </GlassCard>
  );
}
