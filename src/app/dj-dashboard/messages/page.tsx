"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Col, Grid, PageShell, SectionCard } from "@/components/layout/grid";
import { EmailThreadPanel } from "@/components/project/email-thread-panel";
import { BookingList, ListState } from "@/components/dj/booking-list";
import { useMyBookings, whenLabel } from "@/lib/dj/use-my-bookings";
import { bookingClientName, bookingMergeContext, type BookingForMerge } from "@/lib/dj/booking-merge";

type Last = { at: string; inbound: boolean; unread: boolean } | null;

/**
 * Messages: the email conversations on each of the DJ's bookings. Left:
 * bookings with the latest message; right: that booking's conversation and
 * reply box (the same panel as on the booking page, sent from the DJ's own
 * mailbox, with the office copy rules unchanged).
 */
export default function DjMessagesPage() {
  const { bookings, loading, error } = useMyBookings();
  const [picked, setPicked] = useState<string | null>(null);
  const [last, setLast] = useState<Record<string, Last>>({});
  const [detail, setDetail] = useState<{ id: string; event: BookingForMerge; balanceCents: number } | { id: string; error: string } | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all(
      bookings.slice(0, 20).map((b) =>
        fetch(`/api/events/${b.id}/messages`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            const msgs = (d?.messages ?? []) as { created_at: string; direction: string; seen_at: string | null }[];
            const m = msgs[msgs.length - 1];
            return [b.id, m ? { at: m.created_at, inbound: m.direction === "inbound", unread: msgs.some((x) => x.direction === "inbound" && !x.seen_at) } : null] as const;
          })
          .catch(() => [b.id, null] as const)
      )
    ).then((pairs) => live && setLast(Object.fromEntries(pairs)));
    return () => {
      live = false;
    };
  }, [bookings]);

  // Newest conversation first; bookings with no messages after.
  const sorted = [...bookings].sort((a, b) => (last[b.id]?.at ?? "").localeCompare(last[a.id]?.at ?? ""));
  const current = picked ?? sorted[0]?.id ?? null;

  useEffect(() => {
    if (!current) return;
    let live = true;
    fetch(`/api/admin/events/${current}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!live) return;
        if (!ok) throw new Error(d.error || "This booking couldn't load.");
        setDetail({ id: current, event: d.event, balanceCents: d.balance?.balanceCents ?? 0 });
      })
      .catch((e) => live && setDetail({ id: current, error: e instanceof Error ? e.message : "This booking couldn't load." }));
    return () => {
      live = false;
    };
  }, [current]);

  const booking = bookings.find((b) => b.id === current) ?? null;
  const shown = detail && detail.id === current ? detail : null;

  return (
    <>
      <PageHeader breadcrumbs={[{ label: "My work" }, { label: "Messages" }]} title="Messages" subtitle="Email with your clients, by booking. Replies go out from your own mailbox." />
      <PageShell>
        <Grid>
          <Col span={4} wide>
            <SectionCard icon={MessagesSquare} title="Conversations">
              <ListState loading={loading} error={error} empty={!bookings.length} emptyText="No bookings yet, so no conversations." />
              {bookings.length > 0 && (
                <BookingList
                  label="Conversations"
                  bookings={sorted}
                  picked={current}
                  onPick={setPicked}
                  badge={(b) => {
                    const l = last[b.id];
                    if (l === undefined) return null;
                    if (!l) return "No messages";
                    return (
                      <span className="flex items-center gap-1.5">
                        {l.unread && <span className="h-2 w-2 rounded-full bg-gold" aria-label="Unread reply" />}
                        {new Date(l.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    );
                  }}
                />
              )}
            </SectionCard>
          </Col>
          <Col span={8} className="flex flex-col gap-4" data-tour="dj-messages-thread">
            {booking && (
              <SectionCard
                title={booking.title}
                description={`${whenLabel(booking.starts_at)}${shown && "event" in shown && bookingClientName(shown.event.clients) ? ` · ${bookingClientName(shown.event.clients)}` : ""}`}
                actions={
                  <Link href={`/dj-dashboard/projects/${booking.id}`} className="inline-flex h-9 items-center rounded-[10px] border border-border px-3 text-xs font-semibold hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                    Open booking
                  </Link>
                }
              >
                {!shown ? (
                  <p className="text-sm text-muted">Loading the conversation…</p>
                ) : "error" in shown ? (
                  <p role="alert" className="text-sm text-status-declined">{shown.error}</p>
                ) : (
                  <EmailThreadPanel
                    key={shown.id}
                    eventId={shown.id}
                    hasClient={!!shown.event.clients}
                    clientDisplayName={bookingClientName(shown.event.clients)}
                    clientEmail={shown.event.clients?.email ?? null}
                    mergeContext={bookingMergeContext(shown.event, shown.balanceCents, typeof window !== "undefined" ? window.location.origin : "")}
                  />
                )}
              </SectionCard>
            )}
          </Col>
        </Grid>
      </PageShell>
    </>
  );
}
