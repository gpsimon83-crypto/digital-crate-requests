"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, MapPin, Video } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Col, Grid, MetricRow, MetricTile, PageShell, SectionCard } from "@/components/layout/grid";
import { ListState } from "@/components/dj/booking-list";
import { useMyBookings } from "@/lib/dj/use-my-bookings";

type Meeting = { id: string; event_id: string; starts_at: string; ends_at: string; location: string | null; meeting_url: string | null; notes: string | null; status: "scheduled" | "cancelled" };

/**
 * Meetings: client meetings on the DJ's bookings (planning calls, walk
 * throughs), from each booking's existing meetings. Upcoming first.
 */
export default function DjMeetingsPage() {
  const { bookings, loading, error } = useMyBookings();
  const [meetings, setMeetings] = useState<(Meeting & { title: string })[] | null>(null);

  useEffect(() => {
    if (loading) return;
    let live = true;
    Promise.all(
      bookings.slice(0, 30).map((b) =>
        fetch(`/api/events/${b.id}/meetings`)
          .then((r) => (r.ok ? r.json() : { meetings: [] }))
          .then((d) => ((d.meetings ?? []) as Meeting[]).map((m) => ({ ...m, title: b.title })))
          .catch(() => [])
      )
    ).then((lists) => live && setMeetings(lists.flat().sort((a, b) => a.starts_at.localeCompare(b.starts_at))));
    return () => {
      live = false;
    };
  }, [bookings, loading]);

  const now = new Date().toISOString();
  const upcoming = (meetings ?? []).filter((m) => m.ends_at >= now && m.status === "scheduled");
  const past = (meetings ?? []).filter((m) => m.ends_at < now || m.status === "cancelled").reverse();
  const when = (m: Meeting) => `${new Date(m.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${new Date(m.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}–${new Date(m.ends_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;

  const card = (m: Meeting & { title: string }) => (
    <li key={m.id} className="rounded-[14px] border border-border p-4">
      <p className="text-sm font-semibold">{m.title}</p>
      <p className="mt-0.5 text-sm tabular-nums text-muted">
        {when(m)}
        {m.status === "cancelled" && <span className="ml-2 text-status-declined">Cancelled</span>}
      </p>
      {m.location && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <MapPin size={13} aria-hidden /> {m.location}
        </p>
      )}
      {m.notes && <p className="mt-1.5 max-w-prose whitespace-pre-wrap text-sm">{m.notes}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {m.meeting_url && m.status === "scheduled" && (
          <a href={m.meeting_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-gold px-3 text-xs font-semibold text-[var(--on-gold,#1a140a)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
            <Video size={14} aria-hidden /> Join <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
        <Link href={`/dj-dashboard/projects/${m.event_id}`} className="inline-flex h-9 items-center rounded-[10px] border border-border px-3 text-xs font-semibold hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
          Open booking
        </Link>
      </div>
    </li>
  );

  const busy = loading || (meetings === null && !error);
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "My work" }, { label: "Meetings" }]} title="Meetings" subtitle="Client meetings on your bookings. The office schedules them from each booking." />
      <PageShell className="flex flex-col gap-4 xl:gap-5">
        <MetricRow cols={3}>
          <MetricTile icon={CalendarCheck} label="Coming up" value={busy ? "…" : upcoming.length} />
          <MetricTile icon={CalendarCheck} label="Next meeting" value={busy ? "…" : upcoming[0] ? new Date(upcoming[0].starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "None scheduled"} hint={upcoming[0]?.title} />
          <MetricTile icon={CalendarCheck} label="Past or cancelled" value={busy ? "…" : past.length} />
        </MetricRow>
        <Grid>
          <Col span={7}>
            <SectionCard title="Coming up">
              <ListState loading={busy} error={error} empty={!upcoming.length} emptyText="No meetings coming up." />
              {!busy && upcoming.length > 0 && <ul className="flex flex-col gap-3">{upcoming.map(card)}</ul>}
            </SectionCard>
          </Col>
          <Col span={5}>
            <SectionCard title="Past and cancelled">
              {!busy && !error && (past.length ? <ul className="flex flex-col gap-3">{past.slice(0, 12).map(card)}</ul> : <p className="text-sm text-muted">Nothing yet.</p>)}
            </SectionCard>
          </Col>
        </Grid>
      </PageShell>
    </>
  );
}
