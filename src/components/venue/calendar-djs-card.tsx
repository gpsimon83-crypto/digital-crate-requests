"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DJ_CALENDAR_OPTIONS, type CalendarDjName } from "@/lib/venue/calendar-options";

const inputCls = "w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none";
const OTHER = "__other__";

/**
 * Admin → Venue Portals: DJs as they're written on the shared DCDJ calendar
 * ("Que", "GMO") and the actual name the venue portals show for them.
 */
export function CalendarDjsCard() {
  const [djs, setDjs] = useState<CalendarDjName[] | null>(null);
  const [migrated, setMigrated] = useState(true);
  const [pick, setPick] = useState("");
  const [other, setOther] = useState("");
  const [actual, setActual] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/venues/calendar-djs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load the DJ list.");
      setDjs(data.djs ?? []);
      setMigrated(data.migrated !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setDjs([]);
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function save(calendarName: string, displayName: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/venues/calendar-djs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendar_name: calendarName, display_name: displayName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save.");
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/venues/calendar-djs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't remove.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const used = new Set((djs ?? []).map((d) => d.calendar_name.toLowerCase()));
  const options = DJ_CALENDAR_OPTIONS.filter((o) => !used.has(o.toLowerCase()));
  const calendarName = pick === OTHER ? other.trim() : pick;

  async function add() {
    if (!calendarName || !actual.trim()) return;
    if (await save(calendarName, actual.trim())) {
      setPick("");
      setOther("");
      setActual("");
    }
  }

  return (
    <section className="border border-border p-4" data-tour="venue-calendar-djs">
      <h2 className="text-sm font-semibold">DJs on the DCDJ calendar</h2>
      <p className="mt-1 text-xs text-muted">
        Pick how a DJ is written on the calendar, then type the name venues should see. A night like “Casey Key / Que” shows on the
        Casey Key portal as the actual name you give Que here.
      </p>

      {!migrated && (
        <p className="mt-3 rounded-[10px] border border-status-pending/40 bg-status-pending/10 p-3 text-xs">
          One database update is needed first: run migration <b>0047_calendar_dj_names</b> in Supabase (SQL Editor), then reload this page.
        </p>
      )}

      {djs && djs.length > 0 && (
        <div className="mt-3 divide-y divide-border border border-border">
          {djs.map((d) => {
            const val = edits[d.id] ?? d.display_name;
            const changed = val.trim() !== d.display_name;
            return (
              <div key={d.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <span className="w-32 shrink-0 text-sm">
                  <span className="text-[10px] uppercase tracking-wide text-muted">On calendar</span>
                  <br />
                  {d.calendar_name}
                </span>
                <label className="flex-1">
                  <span className="sr-only">Actual name for {d.calendar_name}</span>
                  <input className={inputCls} value={val} onChange={(e) => setEdits({ ...edits, [d.id]: e.target.value })} />
                </label>
                <div className="flex gap-2">
                  {changed && (
                    <Button
                      variant="primary"
                      disabled={busy || val.trim().length < 2}
                      onClick={async () => {
                        if (await save(d.calendar_name, val.trim())) setEdits((e) => { const n = { ...e }; delete n[d.id]; return n; });
                      }}
                    >
                      Save
                    </Button>
                  )}
                  <button
                    className="rounded-[10px] border border-border p-2 text-muted hover:text-status-declined"
                    aria-label={`Remove ${d.calendar_name}`}
                    disabled={busy}
                    onClick={() => remove(d.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {migrated && (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block sm:w-48">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Name on calendar</span>
            <select className={inputCls} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose a DJ…</option>
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              <option value={OTHER}>Other…</option>
            </select>
          </label>
          {pick === OTHER && (
            <label className="block sm:w-40">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">As written</span>
              <input className={inputCls} value={other} maxLength={40} placeholder="e.g. J Prime" onChange={(e) => setOther(e.target.value)} />
            </label>
          )}
          <label className="block flex-1">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Actual name</span>
            <input
              className={inputCls}
              value={actual}
              maxLength={80}
              placeholder="e.g. DJ Que"
              onChange={(e) => setActual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add();
                }
              }}
            />
          </label>
          <Button variant="primary" className="shrink-0" disabled={busy || !calendarName || actual.trim().length < 2} onClick={add}>
            Add DJ
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-status-declined">{error}</p>}
    </section>
  );
}
