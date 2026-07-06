"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";

interface EventRow {
  id: string;
  event_code: string;
  title: string;
  starts_at: string | null;
  status: string;
  djs: { display_name: string } | null;
  venues: { name: string } | null;
}

interface Option {
  id: string;
  label: string;
}

const STATUS_CLASS: Record<string, string> = {
  pending_confirmation: "status-badge pending",
  confirmed: "status-badge approved",
  declined: "status-badge declined",
  live: "status-badge played",
  ended: "status-badge approved",
};

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: "Awaiting DJ",
  confirmed: "Confirmed",
  declined: "Declined",
  live: "Live",
  ended: "Ended",
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [djs, setDjs] = useState<Option[]>([]);
  const [venues, setVenues] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [djId, setDjId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [startsAt, setStartsAt] = useState("");

  async function loadAll() {
    try {
      const [eventsRes, djsRes, venuesRes] = await Promise.all([
        fetch("/api/admin/events"),
        fetch("/api/admin/djs"),
        fetch("/api/admin/venues"),
      ]);
      const eventsData = await eventsRes.json();
      const djsData = await djsRes.json();
      const venuesData = await venuesRes.json();

      if (!eventsRes.ok) throw new Error(eventsData.error || "Failed to load events");

      setEvents(eventsData.events ?? []);
      setDjs((djsData.djs ?? []).map((d: { id: string; display_name: string }) => ({ id: d.id, label: d.display_name })));
      setVenues((venuesData.venues ?? []).map((v: { id: string; name: string }) => ({ id: v.id, label: v.name })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleCreate() {
    if (!title || !startsAt) {
      setError("Title and date/time are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          djId: djId || undefined,
          venueId: venueId || undefined,
          startsAt: new Date(startsAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create event");

      setTitle("");
      setDjId("");
      setVenueId("");
      setStartsAt("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="Events" subtitle="Create events and assign a DJ. The DJ confirms the date from their dashboard." />
      <div className="flex flex-col gap-6 p-6">
        <GlassCard neon className="flex flex-col gap-4">
          <p className="text-sm font-semibold">Create Event</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Event Title" value={title} onChange={setTitle} placeholder="Anderson Wedding" />
            <Field label="Date & Time" value={startsAt} onChange={setStartsAt} type="datetime-local" />
            <SelectField label="Assign DJ" value={djId} onChange={setDjId} options={djs} placeholder="Unassigned" />
            <SelectField label="Venue" value={venueId} onChange={setVenueId} options={venues} placeholder="No venue" />
          </div>
          {error && <p className="text-xs text-status-declined">{error}</p>}
          <NeonButton color="gold" onClick={handleCreate} disabled={submitting} className="w-full sm:w-fit">
            {submitting ? "Creating..." : "Create Event"}
          </NeonButton>
          {djs.length === 0 && (
            <p className="text-xs text-muted">
              No DJs found in Supabase yet — add rows to the <code>djs</code> table to populate this dropdown.
            </p>
          )}
        </GlassCard>

        <div className="flex flex-col gap-3">
          {events === null && <p className="text-sm text-muted">Loading events...</p>}
          {events?.length === 0 && <p className="text-sm text-muted">No events yet.</p>}
          {events?.map((e) => (
            <GlassCard key={e.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{e.title}</p>
                <p className="text-xs text-muted">
                  {e.event_code} &middot; {e.djs?.display_name ?? "Unassigned"} &middot; {e.venues?.name ?? "No venue"}
                </p>
                <p className="text-xs text-muted">
                  {e.starts_at ? new Date(e.starts_at).toLocaleString() : "No date set"}
                </p>
              </div>
              <span className={STATUS_CLASS[e.status] ?? "status-badge pending"}>
                {STATUS_LABEL[e.status] ?? e.status}
              </span>
            </GlassCard>
          ))}
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
