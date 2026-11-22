"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashLinksProvider, MiniCalendar } from "@/components/dashboard/overview/widgets";
import { MyGigs, type MyGigsState } from "@/components/dashboard/overview/my-gigs";
import { useDashLayout } from "@/lib/dashboard-layout";
import { DJ_LINKS } from "@/lib/dj/links";
import { calendarItems } from "@/lib/dj/overview";
import type { DashEvent } from "@/lib/dashboard/overview";
import type { MyGig } from "@/lib/data/my-gigs";

/** The DJ's month: bookings plus what the shared Google Calendar has for them, and the list ahead. */
export default function DjCalendarPage() {
  const layout = useDashLayout() ?? "studio";
  const [now] = useState(() => new Date());
  const [events, setEvents] = useState<DashEvent[] | null>(null);
  const [gigs, setGigs] = useState<Omit<MyGigsState, "djName"> | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((me) => {
        setName(me?.dj?.display_name ?? "");
        return fetch("/api/admin/events")
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((d) => setEvents((d.events ?? []).filter((e: DashEvent & { dj_id: string | null }) => !me?.dj?.id || e.dj_id === me.dj.id)));
      })
      .catch(() => {
        setError(true);
        setEvents([]);
      });
    fetch("/api/me/gigs")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((g) => setGigs({ gigs: (g.gigs ?? []) as MyGig[], calendarConnected: !!g.calendarConnected, loading: false, error: false }))
      .catch(() => setGigs({ gigs: [], calendarConnected: true, loading: false, error: true }));
  }, []);
  const all = calendarItems(gigs?.gigs ?? [], events ?? []);
  return (
    <DashLinksProvider value={DJ_LINKS}>
      <PageHeader title="Calendar" subtitle="Your bookings and everything on the shared Digital Crate DJs calendar with your name on it." />
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:gap-5">
        <MiniCalendar layout={layout} events={all} loading={events === null} error={error} now={now} />
        <MyGigs layout={layout} s={{ djName: name, ...(gigs ?? { gigs: [], calendarConnected: true, loading: true, error: false }) }} />
      </div>
    </DashLinksProvider>
  );
}
