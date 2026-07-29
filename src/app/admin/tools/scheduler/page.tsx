"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

interface AvailabilityRow {
  day_of_week: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

interface BookingRow {
  id: string;
  title: string;
  starts_at: string | null;
  status: string;
  clients: { first_name: string | null; last_name: string | null; email: string | null } | null;
}

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AdminSchedulerPage() {
  const [availability, setAvailability] = useState<AvailabilityRow[] | null>(null);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const [schedRes, eventsRes] = await Promise.all([fetch("/api/admin/scheduler"), fetch("/api/admin/events")]);
      const schedData = await schedRes.json();
      if (!schedRes.ok) throw new Error(schedData.error || "Failed to load scheduler settings");
      setAvailability(schedData.availability);
      setSlotMinutes(schedData.slotMinutes);

      const eventsData = await eventsRes.json();
      if (eventsRes.ok) {
        const now = Date.now();
        setBookings(
          (eventsData.events ?? [])
            .filter((e: { event_type: string | null; status: string; starts_at: string | null }) => e.event_type === "consultation" && e.status !== "declined" && e.starts_at && new Date(e.starts_at).getTime() >= now)
            .sort((a: { starts_at: string }, b: { starts_at: string }) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateDay(dayOfWeek: number, patch: Partial<AvailabilityRow>) {
    setAvailability((prev) => prev?.map((d) => (d.day_of_week === dayOfWeek ? { ...d, ...patch } : d)) ?? null);
  }

  async function handleSave() {
    if (!availability) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/admin/scheduler", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availability: availability.map((d) => ({
            dayOfWeek: d.day_of_week,
            enabled: d.enabled,
            startTime: d.start_time.slice(0, 5),
            endTime: d.end_time.slice(0, 5)
          })),
          slotMinutes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setAvailability(data.availability);
      setSlotMinutes(data.slotMinutes);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/schedule`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function bookerName(b: BookingRow) {
    const c = b.clients;
    if (!c) return "Unknown";
    return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unknown";
  }

  return (
    <>
      <PageHeader title="Scheduler" subtitle="Set your weekly availability for consultation calls." />
      <div className="flex flex-col gap-6 p-6">
        <GlassCard className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Booking link</p>
          <div className="flex items-center gap-1.5">
            <input
              readOnly
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/schedule`}
              className="flex-1 rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm text-muted"
            />
            <button onClick={copyLink} className="shrink-0 rounded-[2px] border border-black/10 p-2.5 hover:border-gold">
              {copied ? <Check size={14} className="text-status-approved" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-xs text-muted">
            Share this with leads so they can pick a time for a call. Bookings show up in{" "}
            <Link href="/admin/leads" className="text-gold hover:underline">Lead Capture</Link> and on your{" "}
            <Link href="/admin/calendar" className="text-gold hover:underline">Calendar</Link>.
          </p>
        </GlassCard>

        {availability === null && <p className="text-sm text-muted">Loading...</p>}

        {availability && (
          <GlassCard className="flex flex-col gap-4">
            <p className="text-sm font-semibold">Weekly availability</p>
            <div className="flex flex-col divide-y divide-border">
              {availability.map((d) => (
                <div key={d.day_of_week} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <label className="flex w-32 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) => updateDay(d.day_of_week, { enabled: e.target.checked })}
                      className="h-3.5 w-3.5 accent-gold"
                    />
                    {DAY_LABELS[d.day_of_week]}
                  </label>
                  <input
                    type="time"
                    value={d.start_time.slice(0, 5)}
                    disabled={!d.enabled}
                    onChange={(e) => updateDay(d.day_of_week, { start_time: e.target.value })}
                    className="rounded-[2px] border border-black/10 bg-panel px-2.5 py-1.5 text-sm disabled:opacity-40"
                  />
                  <span className="text-xs text-muted">to</span>
                  <input
                    type="time"
                    value={d.end_time.slice(0, 5)}
                    disabled={!d.enabled}
                    onChange={(e) => updateDay(d.day_of_week, { end_time: e.target.value })}
                    className="rounded-[2px] border border-black/10 bg-panel px-2.5 py-1.5 text-sm disabled:opacity-40"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 border-t border-border pt-4">
              <label className="text-sm text-muted">Call length</label>
              <input
                type="number"
                min={5}
                step={5}
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(Number(e.target.value))}
                className="w-20 rounded-[2px] border border-black/10 bg-panel px-2.5 py-1.5 text-sm"
              />
              <span className="text-sm text-muted">minutes</span>
            </div>

            {error && <p className="text-sm text-status-declined">{error}</p>}
            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save availability"}
              </Button>
              {saved && <span className="text-xs text-status-approved">Saved.</span>}
            </div>
          </GlassCard>
        )}

        <div>
          <p className="mb-2 text-xs uppercase tracking-[1.5px] text-muted">Upcoming calls</p>
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {bookings === null && <p className="py-3 text-sm text-muted">Loading...</p>}
            {bookings !== null && bookings.length === 0 && <p className="py-3 text-sm text-muted">No calls booked yet.</p>}
            {bookings?.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{bookerName(b)}</p>
                  <p className="text-xs text-muted">{b.clients?.email}</p>
                </div>
                <span className="text-xs text-muted">
                  {b.starts_at ? new Date(b.starts_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
