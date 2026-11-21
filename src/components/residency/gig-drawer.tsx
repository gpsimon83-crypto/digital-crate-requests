"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Pin } from "lucide-react";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { fmtGigDate, fmtHours, RECAP_PROMPTS } from "@/lib/residency";
import { cn } from "@/lib/utils";
import { GigChip } from "./residency-header";
import { api, errOf, money, type ResGig, type ResidencyData } from "./types";

const input = "w-full rounded-[10px] border border-border bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none";
const label = "text-[11px] font-semibold uppercase tracking-[2px] text-muted";

function Scope({ value, onChange, name, futureHint }: { value: "one" | "future"; onChange: (v: "one" | "future") => void; name: string; futureHint: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5 text-sm" data-tour="gig-scope">
      <legend className="sr-only">Apply to</legend>
      {(
        [
          ["one", "This gig only"],
          ["future", "This and future gigs"]
        ] as const
      ).map(([v, l]) => (
        <label key={v} className="flex items-start gap-2">
          <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} className="mt-1 accent-[var(--gold)]" />
          <span>
            {l}
            {v === "future" && <span className="block text-xs text-muted">{futureHint}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * One date's detail: DJ coverage, hours, this night's notes, played /
 * canceled, its recap, and (finance staff) the venue payment and DJ payout.
 */
export function GigDrawer(props: { eventId: string; data: ResidencyData; gig: ResGig | null; focus?: "dj"; onClose: () => void; onChanged: () => void }) {
  if (!props.gig) return null;
  // Fresh form whenever the gig (or its saved values) changes.
  return <GigDrawerInner key={`${props.gig.id}:${props.gig.dj_id}:${props.gig.start_time}:${props.gig.end_time}:${props.gig.gig_date}:${props.gig.notes}:${props.gig.outcome}:${props.gig.venue_fee_cents}:${props.gig.dj_payout_cents}`} {...props} gig={props.gig} />;
}

function GigDrawerInner({ eventId, data, gig, focus, onClose, onChanged }: { eventId: string; data: ResidencyData; gig: ResGig; focus?: "dj"; onClose: () => void; onChanged: () => void }) {
  const r0 = data.residency;
  const feeC = gig.venue_fee_cents ?? r0.venue_fee_cents ?? null;
  const payC = gig.dj_payout_cents ?? r0.dj_payout_cents ?? null;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dj, setDj] = useState(gig.dj_id ?? "");
  const [djScope, setDjScope] = useState<"one" | "future">("one");
  const [start, setStart] = useState(gig.start_time);
  const [end, setEnd] = useState(gig.end_time);
  const [timeScope, setTimeScope] = useState<"one" | "future">("one");
  const [date, setDate] = useState(gig.gig_date);
  const [notes, setNotes] = useState(gig.notes ?? "");
  const [cancelReason, setCancelReason] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [fee, setFee] = useState(feeC != null ? String(feeC / 100) : "");
  const [payout, setPayout] = useState(payC != null ? String(payC / 100) : "");
  const [moneyScope, setMoneyScope] = useState<"one" | "future">("one");
  const [method, setMethod] = useState("check");
  const [pinText, setPinText] = useState(data.recaps.find((x) => x.gig_id === gig.id)?.next_dj ?? "");
  const djRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (focus === "dj") djRef.current?.focus();
  }, [focus]);


  const past = gig.gig_date < data.today;
  const recap = data.recaps.find((x) => x.gig_id === gig.id) ?? null;
  const djs = [...data.djs].sort((a, b) => Number(b.playsHere) - Number(a.playsHere) || a.display_name.localeCompare(b.display_name));
  const future = `${fmtGigDate(gig.gig_date)} onward. Dates edited on their own, and dates another DJ already confirmed, stay as they are.`;

  async function act(name: string, body: Record<string, unknown>, url = `/api/admin/events/${eventId}/residency/gigs/${gig.id}`, method = "PATCH") {
    setBusy(name);
    setErr(null);
    const r = await api(url, method, body);
    setBusy(null);
    if (!r.ok) {
      setErr(errOf(r.data));
      return false;
    }
    onChanged();
    return true;
  }

  const timesChanged = start !== gig.start_time || end !== gig.end_time;
  const dateChanged = date !== gig.gig_date;

  return (
    <SideDrawer open onClose={onClose} title={fmtGigDate(gig.gig_date, { weekday: "long", month: "long", day: "numeric" })} subtitle={`${data.residency.name} · ${fmtHours(gig.start_time, gig.end_time)}`}>
      <div className="flex flex-col gap-6" data-tour="gig-drawer">
        <div className="flex flex-wrap items-center gap-2">
          <GigChip status={gig.status} />
          {gig.detached && <span className="text-xs text-muted">Edited for this date only</span>}
          {gig.off_schedule && <span className="text-xs text-status-pending">No longer on the schedule</span>}
        </div>
        {gig.change_note && <p className="rounded-[10px] border border-border bg-panel p-3 text-xs">{gig.change_note}</p>}
        {gig.outcome === "canceled" && <p className="rounded-[10px] border border-status-declined/40 bg-status-declined/5 p-3 text-sm">Canceled: {gig.cancel_reason}</p>}
        {err && <p className="rounded-[10px] border border-status-declined/40 bg-status-declined/5 p-3 text-sm text-status-declined">{err}</p>}

        {/* DJ coverage */}
        {gig.outcome !== "canceled" && (
          <section className="flex flex-col gap-3">
            <p className={label}>DJ coverage</p>
            <select ref={djRef} value={dj} onChange={(e) => setDj(e.target.value)} className={input} aria-label="DJ for this gig" disabled={gig.outcome === "played"}>
              <option value="">No DJ (unassigned)</option>
              {djs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.display_name}
                  {d.playsHere ? " · plays here" : ""}
                </option>
              ))}
            </select>
            {dj !== (gig.dj_id ?? "") && (
              <>
                {!past && <Scope value={djScope} onChange={setDjScope} name="dj-scope" futureHint={future} />}
                <Button variant="primary" size="sm" className="self-start" disabled={!!busy} onClick={() => void act("dj", { action: "assign", djId: dj || null, scope: past ? "one" : djScope })}>
                  {busy === "dj" && <Loader2 size={13} className="animate-spin" />} {dj ? "Assign and ask to confirm" : "Remove DJ"}
                </Button>
                {dj && <p className="text-xs text-muted">The DJ gets a notice and confirms in My Bookings.</p>}
              </>
            )}
            {dj === (gig.dj_id ?? "") && gig.coverage === "awaiting" && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                Waiting for {gig.djName} to confirm.
                <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => void act("confirm", { action: "confirm" })}>
                  <Check size={13} /> They confirmed another way
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Hours and date */}
        {!past && gig.outcome === "scheduled" && (
          <section className="flex flex-col gap-3">
            <p className={label}>Date and hours</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2 flex flex-col gap-1 text-xs text-muted">
                Date (this gig only)
                <input type="date" value={date} min={data.today} onChange={(e) => setDate(e.target.value)} className={input} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Start
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={input} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                End
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={input} />
              </label>
            </div>
            {timesChanged && <Scope value={timeScope} onChange={setTimeScope} name="time-scope" futureHint={`New standing hours from ${fmtGigDate(gig.gig_date)}. Confirmed DJs keep the date and see a note.`} />}
            {(timesChanged || dateChanged) && (
              <Button variant="primary" size="sm" className="self-start" disabled={!!busy} onClick={() => void act("time", { action: "edit", ...(dateChanged ? { date } : {}), ...(timesChanged ? { start, end, scope: timeScope } : {}) })}>
                {busy === "time" && <Loader2 size={13} className="animate-spin" />} Save date and hours
              </Button>
            )}
          </section>
        )}

        {/* This night's instructions */}
        <section className="flex flex-col gap-2">
          <p className={label}>Notes for this night</p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} placeholder="e.g. Packers game until 3, keep it low until the final whistle" className={input} />
          <p className="text-xs text-muted">The DJ sees these with the venue brief. For every night, edit the Venue Brief instead.</p>
          {notes !== (gig.notes ?? "") && (
            <Button variant="secondary" size="sm" className="self-start" disabled={!!busy} onClick={() => void act("notes", { action: "edit", notes })}>
              Save notes
            </Button>
          )}
        </section>

        {/* Played / canceled */}
        <section className="flex flex-col gap-2">
          <p className={label}>Outcome</p>
          <div className="flex flex-wrap gap-2">
            {gig.outcome === "scheduled" && past && gig.dj_id && (
              <Button variant="primary" size="sm" disabled={!!busy} onClick={() => void act("played", { action: "played" })}>
                <Check size={13} /> Mark played
              </Button>
            )}
            {gig.outcome === "scheduled" && !canceling && (
              <Button variant="secondary" size="sm" onClick={() => setCanceling(true)}>
                Cancel this date
              </Button>
            )}
            {gig.outcome === "canceled" && (
              <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => void act("restore", { action: "restore" })}>
                Restore this date
              </Button>
            )}
            {gig.source === "manual" && !gig.dj_id && gig.outcome === "scheduled" && !past && (
              <Button variant="text" size="sm" disabled={!!busy} onClick={() => void act("delete", { action: "delete_date" }).then((ok) => ok && onClose())}>
                Remove this added date
              </Button>
            )}
          </div>
          {canceling && (
            <div className="flex flex-col gap-2 rounded-[10px] border border-status-declined/30 bg-status-declined/5 p-3">
              <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Why? e.g. venue closed for a private party" className={input} aria-label="Reason for canceling" />
              <div className="flex gap-2">
                <Button variant="primary" size="sm" disabled={!cancelReason.trim() || !!busy} onClick={() => void act("cancel", { action: "cancel", reason: cancelReason }).then((ok) => ok && setCanceling(false))}>
                  Cancel the gig
                </Button>
                <Button variant="text" size="sm" onClick={() => setCanceling(false)}>
                  Keep it
                </Button>
              </div>
              {gig.dj_id && <p className="text-xs text-muted">{gig.djName} is told it&rsquo;s canceled.</p>}
            </div>
          )}
          {gig.outcome === "played" && !recap && <p className="text-xs text-status-pending">Played. Waiting for {gig.djName ?? "the DJ"}&rsquo;s recap.</p>}
        </section>

        {/* Recap */}
        {recap && (
          <section className="flex flex-col gap-2" data-tour="gig-recap">
            <p className={label}>Recap · {recap.djName ?? "DJ"}</p>
            <dl className="flex flex-col gap-2 rounded-[12px] border border-border bg-panel/60 p-3 text-sm">
              {RECAP_PROMPTS.map((p) => (
                <div key={p.key}>
                  <dt className="text-xs text-muted">{p.label}</dt>
                  <dd>{recap[p.key]}</dd>
                </div>
              ))}
            </dl>
            {recap.issue && (
              <div className={cn("rounded-[12px] border p-3 text-sm", recap.issue_resolved_at ? "border-border" : "border-status-pending/50 bg-status-pending/5")}>
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle size={14} className="text-status-pending" /> Issue for staff {recap.issue_resolved_at ? "(resolved)" : ""}
                </p>
                <p className="mt-1">{recap.issue}</p>
                {!recap.issue_resolved_at && (
                  <Button variant="secondary" size="sm" className="mt-2" disabled={!!busy} onClick={() => void act("resolve", { action: "resolve_issue" })}>
                    Mark resolved
                  </Button>
                )}
              </div>
            )}
            {data.venue && (
              <div className="flex flex-col gap-2 rounded-[12px] border border-border p-3">
                <p className="text-xs text-muted">Pin advice to the venue brief so every DJ sees it. This recap stays as written.</p>
                <textarea value={pinText} onChange={(e) => setPinText(e.target.value)} rows={2} maxLength={500} className={input} aria-label="Advice to pin" />
                <Button variant="secondary" size="sm" className="self-start" disabled={!pinText.trim() || !!busy} onClick={() => void act("pin", { text: pinText, recapId: recap.id }, `/api/admin/venues/${data.venue!.id}/brief`, "POST")}>
                  <Pin size={13} /> Pin to brief
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Money: finance staff only */}
        {data.finance && (
          <section className="flex flex-col gap-3" data-tour="gig-money">
            <p className={label}>Money (staff only)</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Venue pays
                <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} disabled={!data.canManageMoney} className={input} placeholder="0" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                DJ payout
                <input inputMode="decimal" value={payout} onChange={(e) => setPayout(e.target.value)} disabled={!data.canManageMoney} className={input} placeholder="0" />
              </label>
            </div>
            {data.canManageMoney && (
              <>
                <Scope value={moneyScope} onChange={setMoneyScope} name="money-scope" futureHint={`New standing rates from ${fmtGigDate(gig.gig_date)}.`} />
                <Button variant="secondary" size="sm" className="self-start" disabled={!!busy} onClick={() => void act("money", { action: "set_money", venueFee: fee, djPayout: payout, scope: moneyScope })}>
                  Save rates
                </Button>
                {gig.outcome === "played" && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-[10px] border border-border bg-panel px-2 py-1.5 text-sm" aria-label="How the venue paid">
                      {Object.entries(PAYMENT_METHODS).map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => void act("vpaid", { action: "venue_paid", amount: fee || undefined, method })}>
                      Venue paid {fee ? money(Math.round(Number(fee.replace(/[$,]/g, "")) * 100)) : ""}
                    </Button>
                    {gig.dj_id && (
                      <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => void act("payout", { action: "payout", amount: payout || undefined, status: "paid" })}>
                        DJ paid
                      </Button>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted">See the month on the Financials tab. Rates never show in the venue or client portal.</p>
              </>
            )}
          </section>
        )}
      </div>
    </SideDrawer>
  );
}
