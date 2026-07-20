"use client";

import { use, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { DjAvatar } from "@/components/dashboard/dj-avatar";

interface EventDj {
  display_name: string;
  photo_url: string | null;
}

const STATUS_CLASS: Record<string, string> = {
  authorized: "status-badge pending",
  captured: "status-badge approved",
  canceled: "status-badge declined",
};

const TYPE_LABEL: Record<string, string> = {
  tip: "Tip",
  request: "Paid Request",
  boost: "Boost",
};

interface PaymentRow {
  id: string;
  type: "tip" | "request" | "boost";
  guest: string;
  song: string | null;
  amountCents: number;
  status: "authorized" | "captured" | "canceled";
  createdAt: string;
}

export default function PaymentsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: eventCode } = use(params);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [dj, setDj] = useState<EventDj | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const eventRes = await fetch(`/api/events/code/${eventCode}`);
        const eventData = await eventRes.json();
        if (!eventRes.ok) throw new Error(eventData.error || "Failed to load event");
        setDj(eventData.event.djs ?? null);

        const payRes = await fetch(`/api/events/${eventData.event.id}/payments`);
        const payData = await payRes.json();
        if (!payRes.ok) throw new Error(payData.error || "Failed to load payments");
        setPayments(payData.payments ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [eventCode]);

  const total = payments.filter((p) => p.status === "captured").reduce((sum, p) => sum + p.amountCents, 0);
  const pendingAuth = payments.filter((p) => p.status === "authorized").length;

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Tips capture instantly. Paid requests authorize now, capture only when played."
        action={dj && <DjAvatar name={dj.display_name} photoUrl={dj.photo_url} size={44} />}
      />
      <div className="flex flex-col gap-6 p-6">
        {error && <p className="text-sm text-status-declined">{error}</p>}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <GlassCard>
            <p className="text-xs text-muted">Captured Tonight</p>
            <p className="text-2xl font-extrabold">${(total / 100).toFixed(2)}</p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs text-muted">Pending Authorization</p>
            <p className="text-2xl font-extrabold">{pendingAuth}</p>
          </GlassCard>
        </div>

        <GlassCard className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs text-muted">
                <th className="pb-2 font-medium">Guest</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Song</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-xs text-muted">
                    No payments yet.
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-black/5 last:border-0">
                  <td className="py-2.5">{p.guest}</td>
                  <td className="py-2.5 text-muted">{TYPE_LABEL[p.type]}</td>
                  <td className="py-2.5 text-muted">{p.song ?? "—"}</td>
                  <td className="py-2.5 font-semibold">${(p.amountCents / 100).toFixed(2)}</td>
                  <td className="py-2.5">
                    <span className={STATUS_CLASS[p.status]}>{p.status}</span>
                  </td>
                  <td className="py-2.5 text-xs text-muted">{new Date(p.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </div>
    </>
  );
}
