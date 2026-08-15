"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { clientName } from "@/lib/format";
import { CalendarDays, Mail, Phone, Magnet } from "lucide-react";

interface EventRow {
  id: string;
  title: string;
  status: string;
  starts_at: string | null;
  created_at: string;
  quoted_amount: number | null;
  event_type: string | null;
  special_requests: string | null;
  clients: {
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

export default function AdminLeadsPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/events");
    const data = await res.json();
    setEvents(res.ok ? data.events : []);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: "confirm" | "decline") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/events/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  const leads = (events ?? [])
    .filter((e) => e.status === "inquiry")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <>
      <PageHeader title="Lead Capture" subtitle="New inquiries waiting on a response." />
      <div className="flex flex-col gap-4 p-6">
        {error && <p className="text-sm text-status-declined">{error}</p>}

        {events === null && <p className="text-sm text-muted">Loading…</p>}
        {events !== null && leads.length === 0 && (
          <EmptyState icon={Magnet} title="No new leads right now" body="New inquiries will show up here as they come in." />
        )}
        {leads.length > 0 && (
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {leads.map((e) => (
              <div key={e.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-sm text-muted">{clientName(e.clients) ?? "No client"}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                    {e.starts_at && (
                      <span className="flex items-center gap-1">
                        <CalendarDays size={12} /> {new Date(e.starts_at).toLocaleDateString()}
                      </span>
                    )}
                    {e.clients?.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={12} /> {e.clients.email}
                      </span>
                    )}
                    {e.clients?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={12} /> {e.clients.phone}
                      </span>
                    )}
                    {e.quoted_amount != null && <span>${e.quoted_amount.toLocaleString()} quoted</span>}
                  </div>
                  {e.special_requests && <p className="mt-1.5 text-sm">{e.special_requests}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" disabled={busyId === e.id} onClick={() => act(e.id, "confirm")}>
                    {busyId === e.id ? "…" : "Confirm"}
                  </Button>
                  <Button variant="destructive" disabled={busyId === e.id} onClick={() => act(e.id, "decline")}>
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
