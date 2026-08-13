"use client";

import { use as usePromise, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { EmailThreadPanel } from "@/components/project/email-thread-panel";
import { TasksPanel } from "@/components/project/tasks-panel";
import { FilesPanel } from "@/components/project/files-panel";
import { QuestionnaireSummary } from "@/components/project/questionnaire-summary";
import type { MergeContext } from "@/lib/merge-fields";

interface ClientRow {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
}

interface EventDetail {
  id: string;
  event_code: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  event_type: string | null;
  expected_guests: number | null;
  final_amount: number | null;
  quoted_amount: number | null;
  deposit_amount: number | null;
  djs: { display_name: string } | null;
  venues: { name: string } | null;
  clients: ClientRow | null;
}

interface Balance {
  totalDueCents: number;
  paidCents: number;
  balanceCents: number;
}

function clientName(c: ClientRow | null) {
  if (!c) return null;
  return c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed contact";
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function DjProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/events/${id}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load project");
        setEvent(data.event);
        setBalance(data.balance);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }, [id]);

  if (error) {
    return (
      <>
        <PageHeader title="Project" action={<BackLink />} />
        <p className="p-6 text-sm text-status-declined">{error}</p>
      </>
    );
  }

  if (!event) {
    return (
      <>
        <PageHeader title="Project" action={<BackLink />} />
        <p className="p-6 text-sm text-muted">Loading...</p>
      </>
    );
  }

  const name = clientName(event.clients);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const balanceCents = balance?.balanceCents ?? 0;

  const mergeContext: MergeContext = {
    clientFirstName: event.clients?.first_name ?? name ?? undefined,
    clientFullName: name ?? undefined,
    eventType: event.event_type ?? undefined,
    eventDate: event.starts_at ? new Date(event.starts_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : undefined,
    eventTime: event.starts_at ? new Date(event.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : undefined,
    eventEndTime: event.ends_at ? new Date(event.ends_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : undefined,
    venueName: event.venues?.name ?? undefined,
    guestCount: event.expected_guests != null ? String(event.expected_guests) : undefined,
    djName: event.djs?.display_name ?? undefined,
    totalAmount: event.final_amount ?? event.quoted_amount ? money(Math.round((event.final_amount ?? event.quoted_amount ?? 0) * 100)) : undefined,
    depositAmount: event.deposit_amount != null ? money(Math.round(event.deposit_amount * 100)) : undefined,
    balanceDue: money(balanceCents),
    portalLink: `${origin}/portal/events/${id}`,
    schedulerLink: `${origin}/schedule`,
    eventCode: event.event_code
  };

  return (
    <>
      <PageHeader title={event.title} subtitle={name ?? "No client linked"} action={<BackLink />} />
      <div className="flex flex-col gap-6 p-6">
        <GlassCard className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={14} />
            {event.starts_at ? new Date(event.starts_at).toLocaleString() : "Date TBD"}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={14} /> {event.venues?.name ?? "No venue"}
          </span>
          {balanceCents > 0 && <span>Balance due: {money(balanceCents)}</span>}
        </GlassCard>

        <QuestionnaireSummary eventId={id} />

        <TasksPanel eventId={id} />

        <FilesPanel eventId={id} />

        <EmailThreadPanel eventId={id} hasClient={!!event.clients} clientDisplayName={name} mergeContext={mergeContext} />
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/dj-dashboard/bookings"
      className="flex items-center gap-1.5 rounded-[2px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-black/25 hover:text-foreground"
    >
      <ArrowLeft size={14} /> Back to Bookings
    </Link>
  );
}
