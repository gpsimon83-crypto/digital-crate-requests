"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Music2, DollarSign, Sparkles, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventSummary {
  eventId: string;
  eventCode: string;
  title: string | null;
  startsAt: string | null;
  status: string;
  djName: string | null;
  requestCount: number;
  paidRequestCents: number;
  boostCents: number;
  tipCents: number;
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const STATUS_LABEL: Record<string, string> = {
  live: "Live now",
  ended: "Ended",
  confirmed: "Upcoming",
  pending_confirmation: "Pending",
  inquiry: "Inquiry",
  declined: "Declined"
};

export default function AdminCrateRequestsPage() {
  const [events, setEvents] = useState<EventSummary[] | null>(null);

  function load() {
    fetch("/api/admin/crate-requests")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]));
  }

  useEffect(load, []);

  const loading = events === null;
  const rows = events ?? [];
  const totalRequests = rows.reduce((sum, e) => sum + e.requestCount, 0);
  const totalTips = rows.reduce((sum, e) => sum + e.tipCents, 0);
  const totalPaidRevenue = rows.reduce((sum, e) => sum + e.paidRequestCents + e.boostCents, 0);

  return (
    <>
      <PageHeader
        title="Crate Requests"
        subtitle="Live song-request activity and revenue, across every event."
        action={
          <Link
            href="/admin/monetization"
            className="flex items-center gap-1.5 rounded-[2px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-gold/40 hover:text-gold"
          >
            <Settings2 size={14} /> Pricing
          </Link>
        }
      />
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap border border-border">
          <StatTile icon={Music2} label="Total requests" value={loading ? "…" : totalRequests} />
          <StatTile icon={Sparkles} label="Tip revenue" value={loading ? "…" : money(totalTips)} />
          <StatTile icon={DollarSign} label="Paid request + boost revenue" value={loading ? "…" : money(totalPaidRevenue)} />
        </div>

        <div className="flex flex-col divide-y divide-border border-y border-border">
          {loading && <p className="py-4 text-sm text-muted">Loading...</p>}
          {!loading && rows.length === 0 && (
            <p className="py-4 text-sm text-muted">No events yet — Crate Request activity will show up here once an event goes live.</p>
          )}
          {rows.map((e) => (
            <div key={e.eventId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{e.title ?? "Untitled event"}</p>
                  <span
                    className={cn(
                      "status-badge",
                      e.status === "live" ? "played" : e.status === "ended" ? "approved" : e.status === "declined" ? "declined" : "pending"
                    )}
                  >
                    {STATUS_LABEL[e.status] ?? e.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {e.djName ?? "Unassigned"} · {e.startsAt ? new Date(e.startsAt).toLocaleDateString() : "No date"} · {e.eventCode}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
                <span>
                  <span className="font-semibold text-foreground">{e.requestCount}</span> requests
                </span>
                <span>
                  <span className="font-semibold text-foreground">{money(e.tipCents)}</span> tips
                </span>
                <span>
                  <span className="font-semibold text-foreground">{money(e.paidRequestCents + e.boostCents)}</span> paid/boosts
                </span>
                <div className="flex gap-2">
                  <Link
                    href={`/dj-dashboard/${e.eventCode}/queue`}
                    className="rounded-[2px] border border-black/12 px-2.5 py-1 font-medium transition-colors hover:border-gold/40 hover:text-gold"
                  >
                    Live Requests
                  </Link>
                  <Link
                    href={`/dj-dashboard/${e.eventCode}/pulse`}
                    className="rounded-[2px] border border-black/12 px-2.5 py-1 font-medium transition-colors hover:border-gold/40 hover:text-gold"
                  >
                    Pulse
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
