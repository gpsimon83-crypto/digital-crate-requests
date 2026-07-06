"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";

interface DjRow {
  id: string;
  display_name: string;
}
interface VenueRow {
  id: string;
  name: string;
}
interface EventRow {
  id: string;
  status: string;
}
interface InviteCodeRow {
  id: string;
  used: boolean;
}

export default function AdminOverviewPage() {
  const [djs, setDjs] = useState<DjRow[] | null>(null);
  const [venues, setVenues] = useState<VenueRow[] | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [codes, setCodes] = useState<InviteCodeRow[] | null>(null);

  useEffect(() => {
    async function load() {
      const [djsRes, venuesRes, eventsRes, codesRes] = await Promise.all([
        fetch("/api/admin/djs"),
        fetch("/api/admin/venues"),
        fetch("/api/admin/events"),
        fetch("/api/admin/invite-codes"),
      ]);
      const djsData = await djsRes.json();
      const venuesData = await venuesRes.json();
      const eventsData = await eventsRes.json();
      const codesData = await codesRes.json();

      setDjs(djsRes.ok ? djsData.djs : []);
      setVenues(venuesRes.ok ? venuesData.venues : []);
      setEvents(eventsRes.ok ? eventsData.events : []);
      setCodes(codesRes.ok ? codesData.codes : []);
    }
    load();
  }, []);

  const activeCodes = codes?.filter((c) => !c.used).length ?? 0;

  return (
    <>
      <PageHeader title="Admin Overview" subtitle="Platform-wide stats and management." />
      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <GlassCard>
            <p className="text-xs text-muted">DJs</p>
            <p className="text-2xl font-extrabold">{djs?.length ?? "..."}</p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs text-muted">Venues</p>
            <p className="text-2xl font-extrabold">{venues?.length ?? "..."}</p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs text-muted">Total Events</p>
            <p className="text-2xl font-extrabold">{events?.length ?? "..."}</p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs text-muted">Active Invite Codes</p>
            <p className="text-2xl font-extrabold">{codes ? activeCodes : "..."}</p>
          </GlassCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <p className="mb-3 text-sm font-semibold">DJ Roster</p>
            <ul className="flex flex-col gap-2 text-sm">
              {djs === null && <li className="text-muted">Loading...</li>}
              {djs?.length === 0 && <li className="text-muted">No DJs yet.</li>}
              {djs?.map((d) => (
                <li key={d.id}>{d.display_name}</li>
              ))}
            </ul>
          </GlassCard>
          <GlassCard>
            <p className="mb-3 text-sm font-semibold">Venues</p>
            <ul className="flex flex-col gap-2 text-sm">
              {venues === null && <li className="text-muted">Loading...</li>}
              {venues?.length === 0 && <li className="text-muted">No venues yet.</li>}
              {venues?.map((v) => (
                <li key={v.id}>{v.name}</li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </div>
    </>
  );
}
