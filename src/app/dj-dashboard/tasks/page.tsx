"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, FileText, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Col, Grid, PageShell, SectionCard } from "@/components/layout/grid";
import { PlaybookPanel } from "@/components/project/playbook-panel";
import { BookingList, ListState } from "@/components/dj/booking-list";
import { useMyBookings, whenLabel } from "@/lib/dj/use-my-bookings";

type Task = { id: string; completed_at: string | null; owner?: string | null; canAct?: boolean };

/**
 * Tasks & Planning: every booking's tasks in one place. The left column is
 * the DJ's bookings with how many tasks are still open; the right is that
 * booking's task list (the same panel as on the booking page) and a link to
 * its planning brief. Nothing new is stored: it reads the existing tasks.
 */
export default function DjTasksPage() {
  const { bookings, loading, error } = useMyBookings();
  const [picked, setPicked] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, number | null>>({});

  // Open-task counts for the next bookings (the same request the booking page makes).
  useEffect(() => {
    const ids = bookings.slice(0, 20).map((b) => b.id);
    let live = true;
    Promise.all(
      ids.map((id) =>
        fetch(`/api/events/${id}/tasks`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => [id, d ? ((d.tasks ?? []) as Task[]).filter((t) => !t.completed_at && t.canAct !== false).length : null] as const)
          .catch(() => [id, null] as const)
      )
    ).then((pairs) => live && setOpen(Object.fromEntries(pairs)));
    return () => {
      live = false;
    };
  }, [bookings]);

  const current = picked ?? bookings[0]?.id ?? null;
  const booking = bookings.find((b) => b.id === current) ?? null;
  const totalOpen = Object.values(open).reduce<number>((n, v) => n + (v ?? 0), 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "My work" }, { label: "Tasks & Planning" }]}
        title="Tasks & Planning"
        subtitle="What's left to do for each booking, and its planning brief."
      />
      <PageShell>
        <Grid>
          <Col span={4} wide>
            <SectionCard icon={ListChecks} title="Your bookings" description={loading ? undefined : `${totalOpen} open ${totalOpen === 1 ? "task" : "tasks"} across the next ${Math.min(bookings.length, 20)} bookings`}>
              <ListState loading={loading} error={error} empty={!bookings.length} emptyText="No bookings yet. Tasks show here once the office books you for a gig." />
              {bookings.length > 0 && (
                <BookingList
                  label="Bookings"
                  bookings={bookings}
                  picked={current}
                  onPick={setPicked}
                  badge={(b) => (open[b.id] == null ? null : open[b.id] === 0 ? "All done" : `${open[b.id]} open`)}
                />
              )}
            </SectionCard>
          </Col>
          <Col span={8} className="flex flex-col gap-4 xl:gap-5" data-tour="dj-tasks-detail">
            {booking ? (
              <>
                <SectionCard
                  icon={ClipboardList}
                  title={booking.title}
                  description={`${whenLabel(booking.starts_at)}${booking.venues?.name ? ` · ${booking.venues.name}` : ""}`}
                  actions={
                    <>
                      <Link href={`/dj-dashboard/projects/${booking.id}/brief`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border px-3 text-xs font-semibold hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                        <FileText size={14} aria-hidden /> Planning brief
                      </Link>
                      <Link href={`/dj-dashboard/projects/${booking.id}`} className="inline-flex h-9 items-center rounded-[10px] border border-border px-3 text-xs font-semibold hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                        Open booking
                      </Link>
                    </>
                  }
                />
                <PlaybookPanel key={booking.id} eventId={booking.id} />
              </>
            ) : (
              !loading && !error && <SectionCard title="Pick a booking" description="Its tasks and planning brief show here." />
            )}
          </Col>
        </Grid>
      </PageShell>
    </>
  );
}
