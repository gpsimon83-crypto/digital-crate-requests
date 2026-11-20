"use client";

import { useState } from "react";
import { Ban, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAYMENT_KINDS, PAYMENT_METHODS, type PaymentKind, type PaymentMethod } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";

export type LedgerPayment = {
  id: string;
  kind: string;
  amount_cents: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  stripe_payment_intent_id?: string | null;
  method?: string | null;
  reference?: string | null;
  note?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
};

const money = (c: number) => `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const todayLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
const input = "rounded-[8px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none";

/**
 * Payment history on the Financials tab, with "Record a payment" for money
 * the client paid outside the portal (cash, check, Zelle, Venmo...). A
 * mistaken entry is voided with a reason; it stays listed but stops counting.
 */
export function PaymentLedger({ eventId, payments, balanceCents, depositCents, onChange }: { eventId: string; payments: LedgerPayment[]; balanceCents: number | null; depositCents: number | null; onChange: () => void }) {
  const paidAny = payments.some((p) => p.status === "succeeded");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ amount: "", kind: "deposit" as PaymentKind, method: "zelle" as PaymentMethod, paidOn: todayLocal(), reference: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function start() {
    // Sensible defaults: the deposit if nothing's been paid, otherwise the remaining balance.
    const kind: PaymentKind = paidAny ? "balance" : "deposit";
    const cents = kind === "deposit" && depositCents ? depositCents : balanceCents;
    setF({ amount: cents ? (cents / 100).toFixed(2) : "", kind, method: "zelle", paidOn: todayLocal(), reference: "", note: "" });
    setErr(null);
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/admin/events/${eventId}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Couldn't save the payment.");
    setOpen(false);
    onChange();
  }

  async function voidPayment(id: string) {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/admin/events/${eventId}/payments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "void", reason }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Couldn't void it.");
    setVoiding(null);
    setReason("");
    onChange();
  }

  const over = balanceCents != null && Math.round(Number(f.amount.replace(/[$,\s]/g, "")) * 100) > balanceCents;

  return (
    <div className="flex flex-col gap-3" data-tour="payment-ledger">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[1.5px] text-muted">Payment history</p>
        {!open && (
          <Button size="sm" variant="primary" onClick={start} data-tour="record-payment">
            <Plus size={13} /> Record a payment
          </Button>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-3 rounded-[12px] border border-gold/40 bg-card p-4" data-tour="record-payment-form">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Record a payment</p>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-muted">For money the client paid outside the portal. It counts toward the balance right away; card payments made in the portal are added automatically.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted">Amount</span>
              <span className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                <input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className={cn(input, "w-full pl-6")} aria-label="Amount" />
              </span>
              {over && <span className="text-status-pending">More than the balance due ({money(balanceCents!)}).</span>}
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted">Date paid</span>
              <input type="date" value={f.paidOn} max={todayLocal()} onChange={(e) => setF({ ...f, paidOn: e.target.value })} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted">For</span>
              <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as PaymentKind })} className={input}>
                {Object.entries(PAYMENT_KINDS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted">Paid by</span>
              <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as PaymentMethod })} className={input}>
                {Object.entries(PAYMENT_METHODS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted">Check # or confirmation (optional)</span>
              <input value={f.reference} maxLength={120} onChange={(e) => setF({ ...f, reference: e.target.value })} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted">Note for the team (optional)</span>
              <input value={f.note} maxLength={1000} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Handed to DJ Nova at the walkthrough" className={input} />
            </label>
          </div>
          {err && <p className="text-xs text-status-declined">{err}</p>}
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" disabled={busy || !f.amount.trim()} onClick={() => void save()}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : null} Save payment
            </Button>
            <Button variant="text" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col divide-y divide-border border-y border-border">
        {payments.length === 0 && <p className="py-3 text-sm text-muted">No payments yet.</p>}
        {payments.map((p) => {
          const voided = p.status === "voided";
          const manual = !p.stripe_payment_intent_id;
          const method = p.method ? (PAYMENT_METHODS[p.method as PaymentMethod] ?? p.method) : manual ? null : "Card";
          return (
            <div key={p.id} className="flex flex-col gap-1 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className={cn("min-w-0 flex-1 text-sm", voided && "text-muted line-through")}>
                  {PAYMENT_KINDS[p.kind as PaymentKind] ?? p.kind}
                  {method && <span className="text-muted"> · {method}</span>}
                  {p.reference && <span className="text-muted"> · {p.reference}</span>}
                </span>
                <span className="text-xs text-muted">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</span>
                <span className={cn("w-24 text-right text-sm font-semibold", voided && "text-muted line-through")}>{money(p.amount_cents)}</span>
                {p.status !== "succeeded" && !voided && <span className="text-xs capitalize text-status-pending">{p.status}</span>}
                {manual && !voided && p.status === "succeeded" && voiding !== p.id && (
                  <button onClick={() => { setVoiding(p.id); setReason(""); setErr(null); }} className="flex items-center gap-1 text-xs text-muted hover:text-status-declined" aria-label={`Void ${money(p.amount_cents)} payment`}>
                    <Ban size={12} /> Void
                  </button>
                )}
              </div>
              {p.note && <p className="text-xs text-muted">{p.note}</p>}
              {voided && <p className="text-xs text-status-declined">Voided{p.voided_at ? ` ${new Date(p.voided_at).toLocaleDateString()}` : ""}{p.void_reason ? `: ${p.void_reason}` : ""}. Not counted.</p>}
              {voiding === p.id && (
                <div className="mt-1 flex flex-col gap-2 rounded-[10px] border border-status-declined/30 bg-status-declined/5 p-3 sm:flex-row sm:items-center">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? e.g. entered twice" className={cn(input, "flex-1")} aria-label="Reason for voiding" autoFocus />
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" disabled={busy || !reason.trim()} onClick={() => void voidPayment(p.id)}>
                      Void payment
                    </Button>
                    <Button size="sm" variant="text" onClick={() => setVoiding(null)}>
                      Keep
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {err && !open && <p className="text-xs text-status-declined">{err}</p>}
    </div>
  );
}
