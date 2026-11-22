"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashLinksProvider, MiniCalendar } from "@/components/dashboard/overview/widgets";
import { MyGigs, type MyGigsState } from "@/components/dashboard/overview/my-gigs";
import { useDashLayout } from "@/lib/dashboard-layout";
import { DJ_LINKS } from "@/lib/dj/links";
import { calendarItems } from "@/lib/dj/overview";
import type { DashEvent } from "@/lib/dashboard/overview";
import type { MyGig } from "@/lib/data/my-gigs";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
/** The days a month grid can show: a week before the 1st to a week after the last day. */
function gridRange(first: Date) {
  const from = new Date(first.getFullYear(), first.getMonth(), 1 - 7);
  const to = new Date(first.getFullYear(), first.getMonth() + 1, 7);
  return { from: ymd(from), to: ymd(to) };
}

/**
 * The DJ's month: bookings plus every entry on the shared DCDJ Google
 * Calendar with their name on it. Each month loads as the DJ pages to it,
 * back through the past year and as far ahead as the calendar goes.
 */
export default function DjCalendarPage() {
  const layout = useDashLayout() ?? "studio";
  const [now] = useState(() => new Date());
  const [events, setEvents] = useState<DashEvent[] | null>(null);
  const [gigs, setGigs] = useState<Omit<MyGigsState, "djName"> | null>(null);
  const [monthGigs, setMonthGigs] = useState<Map<string, MyGig>>(() => new Map());
  const [monthState, setMonthState] = useState<Record<string, "loading" | "ok" | "error">>(() => ({ [monthKey(now)]: "loading" }));
  const [shown, setShown] = useState(() => monthKey(now));
  const [name, setName] = useState("");
  const [error, setError] = useState(false);
  const asked = useRef(new Set<string>([monthKey(now)]));

  // Only sets state when the answer arrives (safe to start from an effect).
  const fetchMonth = useCallback((first: Date) => {
    const k = monthKey(first);
    const r = gridRange(first);
    fetch(`/api/me/gigs?from=${r.from}&to=${r.to}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((g) => {
        setMonthGigs((m) => {
          const next = new Map(m);
          for (const x of (g.gigs ?? []) as MyGig[]) next.set(x.key, x);
          return next;
        });
        setMonthState((s) => ({ ...s, [k]: "ok" }));
      })
      .catch(() => {
        asked.current.delete(k); // try again next time they page here
        setMonthState((s) => ({ ...s, [k]: "error" }));
      });
  }, []);

  const loadMonth = useCallback(
    (first: Date) => {
      const k = monthKey(first);
      setShown(k);
      if (asked.current.has(k)) return;
      asked.current.add(k);
      setMonthState((s) => ({ ...s, [k]: "loading" }));
      fetchMonth(first);
    },
    [fetchMonth]
  );

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
    fetchMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }, [fetchMonth, now]);

  // Upcoming list plus every month loaded so far, once each.
  const merged = new Map<string, MyGig>(monthGigs);
  for (const g of gigs?.gigs ?? []) merged.set(g.key, g);
  const all = calendarItems([...merged.values()], events ?? []);
  const st = monthState[shown];
  const note =
    st === "loading" ? (
      <span aria-live="polite">Loading this month from the calendar…</span>
    ) : st === "error" ? (
      <span role="alert" className="text-status-declined">
        This month&apos;s calendar dates couldn&apos;t load. Page away and back to try again.
      </span>
    ) : null;

  return (
    <DashLinksProvider value={DJ_LINKS}>
      <PageHeader title="Calendar" subtitle="Your bookings and every date on the shared Digital Crate DJs calendar with your name on it." />
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:gap-5">
        <div data-tour="dj-calendar-month">
          <MiniCalendar layout={layout} events={all} loading={events === null} error={error} now={now} onMonth={loadMonth} monthNote={note} />
        </div>
        <MyGigs layout={layout} s={{ djName: name, ...(gigs ?? { gigs: [], calendarConnected: true, loading: true, error: false }) }} />
      </div>
    </DashLinksProvider>
  );
}
