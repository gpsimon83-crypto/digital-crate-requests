"use client";

import { use as usePromise, useEffect, useState } from "react";
import { Logo } from "@/components/site/logo";
import { clientName } from "@/lib/format";

interface ClientRow {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
}

interface EventDetail {
  title: string;
  event_code: string;
  starts_at: string | null;
  quoted_amount: number | null;
  final_amount: number | null;
  deposit_amount: number | null;
  clients: ClientRow | null;
  venues: { name: string } | null;
}

interface PaymentRow {
  id: string;
  kind: string;
  amount_cents: number;
  status: string;
  paid_at: string | null;
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/events/${id}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load invoice");
        setEvent(data.event);
        setPayments(data.payments ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }, [id]);

  if (error) return <div className="p-10 text-sm text-status-declined">{error}</div>;
  if (!event) return <div className="p-10 text-sm text-muted">Loading...</div>;

  const totalDueCents = Math.round((event.final_amount ?? event.quoted_amount ?? 0) * 100);
  const succeeded = payments.filter((p) => p.status === "succeeded");
  const paidCents = succeeded.reduce((sum, p) => sum + p.amount_cents, 0);
  const balanceCents = Math.max(totalDueCents - paidCents, 0);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl bg-white px-8 py-12 text-foreground print:px-0 print:py-0">
      <div className="mb-8 flex items-center justify-between print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-[2px] border border-black/12 px-4 py-2 text-sm font-medium hover:border-gold"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Logo variant="icon" brand="crates-djs" size={36} />
          <div>
            <p className="text-sm font-semibold">Digital Crate DJs</p>
            <p className="text-xs text-muted">digitalcratedjs.com</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-light">Invoice</p>
          <p className="text-xs text-muted">#{event.event_code}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6 border-y border-border py-4 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted">Bill To</p>
          <p className="mt-1 font-medium">{clientName(event.clients, "—") ?? "—"}</p>
          {event.clients?.email && <p className="text-muted">{event.clients.email}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted">Event</p>
          <p className="mt-1 font-medium">{event.title}</p>
          <p className="text-muted">
            {event.starts_at ? new Date(event.starts_at).toLocaleDateString() : "Date TBD"}
            {event.venues?.name ? ` · ${event.venues.name}` : ""}
          </p>
        </div>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted">
            <th className="pb-2 font-medium">Description</th>
            <th className="pb-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <tr>
            <td className="py-2.5">DJ Services — {event.title}</td>
            <td className="py-2.5 text-right">{money(totalDueCents)}</td>
          </tr>
          {succeeded.map((p) => (
            <tr key={p.id} className="text-muted">
              <td className="py-2.5">
                Payment received{p.kind ? ` — ${p.kind}` : ""}
                {p.paid_at ? ` (${new Date(p.paid_at).toLocaleDateString()})` : ""}
              </td>
              <td className="py-2.5 text-right">-{money(p.amount_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
        <div className="flex w-56 justify-between">
          <span className="text-muted">Total</span>
          <span>{money(totalDueCents)}</span>
        </div>
        <div className="flex w-56 justify-between">
          <span className="text-muted">Paid</span>
          <span>{money(paidCents)}</span>
        </div>
        <div className="flex w-56 justify-between border-t border-border pt-1 text-base font-semibold">
          <span>Balance Due</span>
          <span>{money(balanceCents)}</span>
        </div>
      </div>
    </div>
  );
}
