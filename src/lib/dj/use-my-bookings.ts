"use client";

import { useEffect, useState } from "react";

export type MyBooking = {
  id: string;
  title: string;
  status: string;
  starts_at: string | null;
  ends_at?: string | null;
  event_type: string | null;
  dj_id: string | null;
  venues: { name: string } | null;
  clients: { first_name: string | null; last_name: string | null; company_name: string | null; email?: string | null } | null;
};

/**
 * The signed-in DJ's own bookings (the same list Home and My Gigs use: the
 * events API already limits a DJ login to their own; staff in DJ View get
 * filtered to their linked profile here). Upcoming first, then the last
 * 90 days, declined left out.
 */
export function useMyBookings() {
  const [state, setState] = useState<{ dj: { id: string; display_name: string } | null; bookings: MyBooking[]; loading: boolean; error: boolean }>({ dj: null, bookings: [], loading: true, error: false });
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const me = await fetch("/api/me").then((r) => (r.ok ? r.json() : Promise.reject()));
        const dj = me?.dj ?? null;
        const d = await fetch("/api/admin/events").then((r) => (r.ok ? r.json() : Promise.reject()));
        const now = Date.now();
        const since = now - 90 * 86400000;
        const mine = ((d.events ?? []) as MyBooking[])
          .filter((e) => !!dj && e.dj_id === dj.id && e.status !== "declined")
          .filter((e) => !e.starts_at || Date.parse(e.starts_at) >= since);
        const t = (e: MyBooking) => (e.starts_at ? Date.parse(e.starts_at) : Infinity);
        const upcoming = mine.filter((e) => t(e) >= now - 12 * 3600000).sort((a, b) => t(a) - t(b));
        const past = mine.filter((e) => t(e) < now - 12 * 3600000).sort((a, b) => t(b) - t(a));
        if (live) setState({ dj, bookings: [...upcoming, ...past], loading: false, error: false });
      } catch {
        if (live) setState({ dj: null, bookings: [], loading: false, error: true });
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export const clientLabel = (c: MyBooking["clients"]) => (c ? c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || null : null);
export const whenLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "Date to be set");
