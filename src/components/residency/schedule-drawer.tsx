"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Button } from "@/components/ui/button";
import { DAYS, fmtGigDate, recurrenceLabel, scheduleDates, addDays, type Pattern } from "@/lib/residency";
import { cn } from "@/lib/utils";
import { api, errOf, type ResidencyData } from "./types";

const input = "w-full rounded-[10px] border border-border bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none";
const WEEKS: [number, string][] = [
  [1, "1st"],
  [2, "2nd"],
  [3, "3rd"],
  [4, "4th"],
  [5, "Last"]
];

type Form = { name: string; pattern: Pattern; weekday: number; weeks: number[]; start_time: string; end_time: string; starts_on: string; ends_on: string; defaultDjId: string; applyDjToFuture: boolean; effectiveFrom: string; venueFee: string; djPayout: string; moneyNotes: string };

/**
 * Set up or edit the recurring schedule. Editing always applies to this and
 * future gigs from the chosen date; past gigs and dates edited on their own
 * are left as they are.
 */
export function ScheduleDrawer({
  eventId,
  data,
  today,
  djs,
  canManageMoney,
  defaults,
  onClose,
  onSaved
}: {
  eventId: string;
  data: ResidencyData | null;
  today: string;
  djs: { id: string; display_name: string }[];
  canManageMoney: boolean;
  defaults?: { name?: string; weekday?: number; start?: string; end?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!data;
  const r = data?.residency;
  const dollars = (c: number | null | undefined) => (c == null ? "" : String(c / 100));
  const [f, setF] = useState<Form>(() => ({
    name: r?.name ?? defaults?.name ?? "",
    pattern: r?.pattern ?? "weekly",
    weekday: r?.weekday ?? defaults?.weekday ?? 5,
    weeks: r?.weeks?.length ? r.weeks : [1, 3],
    start_time: r?.start_time ?? defaults?.start ?? "21:00",
    end_time: r?.end_time ?? defaults?.end ?? "01:00",
    starts_on: r?.starts_on ?? today,
    ends_on: r?.ends_on ?? "",
    defaultDjId: r?.default_dj_id ?? "",
    applyDjToFuture: false,
    effectiveFrom: today,
    venueFee: dollars(r?.venue_fee_cents),
    djPayout: dollars(r?.dj_payout_cents),
    moneyNotes: r?.money_notes ?? ""
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<Form>) => {
    setErr(null);
    setF((x) => ({ ...x, ...p }));
  };

  const preview = f.pattern === "manual" ? [] : scheduleDates({ ...f, weekday: f.weekday, ends_on: f.ends_on || null }, editing ? f.effectiveFrom : f.starts_on > today ? f.starts_on : today, addDays(today, 120)).slice(0, 4);

  async function save() {
    setBusy(true);
    const body: Record<string, unknown> = {
      name: f.name,
      pattern: f.pattern,
      weekday: f.pattern === "manual" ? null : f.weekday,
      weeks: f.pattern === "monthly" ? f.weeks : [],
      start_time: f.start_time,
      end_time: f.end_time,
      starts_on: f.starts_on,
      ends_on: f.ends_on || null,
      defaultDjId: f.defaultDjId || null
    };
    if (editing) {
      body.effectiveFrom = f.effectiveFrom;
      body.applyDjToFuture = f.applyDjToFuture;
      if (f.defaultDjId === (r?.default_dj_id ?? "")) delete body.defaultDjId;
    }
    if (canManageMoney) Object.assign(body, { venueFee: f.venueFee, djPayout: f.djPayout, moneyNotes: f.moneyNotes });
    const res = await api(`/api/admin/events/${eventId}/residency`, editing ? "PATCH" : "POST", body);
    setBusy(false);
    if (!res.ok) return setErr(errOf(res.data));
    onSaved();
  }

  return (
    <SideDrawer open onClose={onClose} title={editing ? "Edit the schedule" : "Make this a recurring booking"} subtitle={editing ? "Changes apply to this and future gigs." : "Dates are created for the next four months and keep rolling forward."}>
      <div className="flex flex-col gap-5 text-sm" data-tour="schedule-drawer">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Name of the night</span>
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Sunday Funday" maxLength={80} className={input} />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs text-muted">Repeats</legend>
          <div className="grid grid-cols-3 gap-1 rounded-[12px] border border-border bg-panel p-1">
            {(
              [
                ["weekly", "Weekly"],
                ["monthly", "Some weeks"],
                ["manual", "Pick dates"]
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={f.pattern === v} onClick={() => set({ pattern: v })} className={cn("rounded-[9px] px-2 py-1.5 text-xs font-medium", f.pattern === v ? "bg-gold text-[var(--on-gold)]" : "text-foreground/80 hover:text-foreground")}>
                {l}
              </button>
            ))}
          </div>
          {f.pattern !== "manual" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Night</span>
              <select value={f.weekday} onChange={(e) => set({ weekday: Number(e.target.value) })} className={input}>
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          )}
          {f.pattern === "monthly" && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weeks of the month">
              {WEEKS.map(([w, l]) => {
                const on = f.weeks.includes(w);
                return (
                  <button key={w} type="button" aria-pressed={on} onClick={() => set({ weeks: on ? f.weeks.filter((x) => x !== w) : [...f.weeks, w].sort() })} className={cn("rounded-full border px-3 py-1 text-xs", on ? "border-gold bg-gold-soft text-gold" : "border-border text-foreground/80")}>
                    {l} {DAYS[f.weekday].slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}
          {f.pattern === "manual" && <p className="text-xs text-muted">Add each date with &ldquo;Add a date&rdquo; on the Coverage tab.</p>}
        </fieldset>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Set starts</span>
            <input type="time" value={f.start_time} onChange={(e) => set({ start_time: e.target.value })} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Set ends</span>
            <input type="time" value={f.end_time} onChange={(e) => set({ end_time: e.target.value })} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">First date</span>
            <input type="date" value={f.starts_on} onChange={(e) => set({ starts_on: e.target.value })} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Last date (optional)</span>
            <input type="date" value={f.ends_on} onChange={(e) => set({ ends_on: e.target.value })} className={input} />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Usual DJ (optional)</span>
          <select value={f.defaultDjId} onChange={(e) => set({ defaultDjId: e.target.value })} className={input}>
            <option value="">None: assign each date</option>
            {djs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.display_name}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted">New dates go to this DJ to confirm.</span>
          {editing && f.defaultDjId !== (r?.default_dj_id ?? "") && (
            <label className="mt-1 flex items-start gap-2 text-xs">
              <input type="checkbox" checked={f.applyDjToFuture} onChange={(e) => set({ applyDjToFuture: e.target.checked })} className="mt-0.5 accent-[var(--gold)]" />
              Also ask them to cover the dates already scheduled from the date below (dates another DJ confirmed are kept)
            </label>
          )}
        </label>

        {canManageMoney && (
          <fieldset className="flex flex-col gap-2 rounded-[12px] border border-border p-3">
            <legend className="px-1 text-xs text-muted">Rates (staff only, never shown to the venue)</legend>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Venue pays per gig</span>
                <input inputMode="decimal" value={f.venueFee} onChange={(e) => set({ venueFee: e.target.value })} placeholder="$" className={input} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">DJ payout per gig</span>
                <input inputMode="decimal" value={f.djPayout} onChange={(e) => set({ djPayout: e.target.value })} placeholder="$" className={input} />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Negotiation notes</span>
              <textarea value={f.moneyNotes} onChange={(e) => set({ moneyNotes: e.target.value })} rows={2} maxLength={2000} className={input} />
            </label>
          </fieldset>
        )}

        {editing && (
          <label className="flex flex-col gap-1 rounded-[12px] border border-gold/40 bg-gold-soft/40 p-3" data-tour="schedule-scope">
            <span className="text-xs font-semibold">Apply to this and future gigs from</span>
            <input type="date" value={f.effectiveFrom} min={today} onChange={(e) => set({ effectiveFrom: e.target.value })} className={input} />
            <span className="text-xs text-muted">Past gigs, dates edited on their own and added dates stay as they are. A date that drops off the schedule is removed unless a DJ or a note is on it; then it&rsquo;s kept and marked for you to cancel.</span>
          </label>
        )}

        <div className="rounded-[12px] border border-border bg-panel/60 p-3 text-xs">
          <p className="font-semibold">{f.pattern === "manual" ? "Selected dates" : `${recurrenceLabel({ pattern: f.pattern, weekday: f.weekday, weeks: f.weeks })}`}</p>
          {preview.length > 0 ? <p className="mt-1 text-muted">Next: {preview.map((d) => fmtGigDate(d)).join(" · ")}</p> : f.pattern !== "manual" && <p className="mt-1 text-muted">No dates in the next four months.</p>}
        </div>

        {err && <p className="text-sm text-status-declined">{err}</p>}
        <div className="flex gap-2">
          <Button variant="primary" size="sm" disabled={busy || !f.name.trim()} onClick={() => void save()}>
            {busy && <Loader2 size={13} className="animate-spin" />} {editing ? "Save this and future gigs" : "Create the schedule"}
          </Button>
          <Button variant="text" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </SideDrawer>
  );
}

/** Schedule one more date (a one-off, or dates for a "pick dates" residency). */
export function AddDateDrawer({ eventId, data, onClose, onSaved }: { eventId: string; data: ResidencyData; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState("");
  const [start, setStart] = useState(data.residency.start_time);
  const [end, setEnd] = useState(data.residency.end_time);
  const [dj, setDj] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    const r = await api(`/api/admin/events/${eventId}/residency/gigs`, "POST", { date, start, end, djId: dj || null, notes });
    setBusy(false);
    if (!r.ok) return setErr(errOf(r.data));
    onSaved();
  }
  return (
    <SideDrawer open onClose={onClose} title="Schedule a gig" subtitle={`${data.residency.name} · one date`}>
      <div className="flex flex-col gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Date</span>
          <input type="date" value={date} min={data.today} onChange={(e) => setDate(e.target.value)} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Start</span>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">End</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={input} />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">DJ (optional)</span>
          <select value={dj} onChange={(e) => setDj(e.target.value)} className={input}>
            <option value="">Assign later</option>
            {data.djs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Notes for this night (optional)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className={input} />
        </label>
        {err && <p className="text-sm text-status-declined">{err}</p>}
        <Button variant="primary" size="sm" className="self-start" disabled={busy || !date} onClick={() => void save()}>
          {busy && <Loader2 size={13} className="animate-spin" />} Schedule gig
        </Button>
      </div>
    </SideDrawer>
  );
}
