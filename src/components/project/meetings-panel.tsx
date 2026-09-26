"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { BUSINESS_TIMEZONE } from "@/lib/scheduler-time";
import { CalendarClock, MapPin, Link2, Pencil, X } from "lucide-react";

interface MeetingRow {
  id: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  meeting_url: string | null;
  notes: string | null;
  status: "scheduled" | "cancelled";
}

interface Draft {
  date: string;
  time: string;
  durationMinutes: number;
  location: string;
  meetingUrl: string;
  notes: string;
}

const EMPTY_DRAFT: Draft = { date: "", time: "", durationMinutes: 30, location: "", meetingUrl: "", notes: "" };
const DURATIONS = [15, 30, 45, 60, 90, 120];

function whenLabel(startsAt: string) {
  return new Date(startsAt).toLocaleString("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

// The form works in business-local time (same as the public scheduler), so
// an existing meeting has to be converted back before it can be edited.
function draftFromMeeting(m: MeetingRow): Draft {
  const start = new Date(m.starts_at);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: BUSINESS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(start)
      .map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    durationMinutes: Math.round((new Date(m.ends_at).getTime() - start.getTime()) / 60000),
    location: m.location ?? "",
    meetingUrl: m.meeting_url ?? "",
    notes: m.notes ?? ""
  };
}

export function MeetingsPanel({ eventId }: { eventId: string }) {
  const [meetings, setMeetings] = useState<MeetingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  function load() {
    fetch(`/api/events/${eventId}/meetings`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load meetings");
        setMeetings(data.meetings);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setMeetings([]);
      });
  }

  useEffect(load, [eventId]);

  function openNew() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(m: MeetingRow) {
    setEditingId(m.id);
    setDraft(draftFromMeeting(m));
    setError(null);
    setFormOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/meetings${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save meeting");
      setFormOpen(false);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(meetingId: string) {
    try {
      const res = await fetch(`/api/events/${eventId}/meetings/${meetingId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel meeting");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPendingCancelId(null);
    }
  }

  const upcoming = (meetings ?? []).filter((m) => m.status === "scheduled" && new Date(m.ends_at).getTime() >= now);
  const past = (meetings ?? []).filter((m) => m.status === "scheduled" && new Date(m.ends_at).getTime() < now);

  const inputClass = "w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none";

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Meetings</p>
          <p className="text-xs text-muted">Schedule a meeting with this client. They&rsquo;re emailed and it shows in their portal and on your calendar.</p>
        </div>
        {!formOpen && (
          <Button variant="secondary" size="sm" onClick={openNew} className="shrink-0">
            <CalendarClock size={14} /> Schedule Meeting
          </Button>
        )}
      </div>

      {meetings && upcoming.length === 0 && !formOpen && <p className="text-sm text-muted">No meeting scheduled.</p>}

      {upcoming.map((m) => (
        <div key={m.id} className="flex items-start justify-between gap-3 rounded-[10px] border border-black/10 bg-panel px-3 py-2.5">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{whenLabel(m.starts_at)}</p>
            {m.location && (
              <p className="flex items-center gap-1 text-xs text-muted">
                <MapPin size={12} /> {m.location}
              </p>
            )}
            {m.meeting_url && (
              <a href={m.meeting_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-gold hover:underline">
                <Link2 size={12} /> Join link
              </a>
            )}
            {m.notes && <p className="text-xs text-muted">{m.notes}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => openEdit(m)} className="text-muted hover:text-gold" aria-label="Reschedule meeting">
              <Pencil size={14} />
            </button>
            <button onClick={() => setPendingCancelId(m.id)} className="text-muted hover:text-status-declined" aria-label="Cancel meeting">
              <X size={15} />
            </button>
          </div>
        </div>
      ))}

      {past.length > 0 && <p className="text-[11px] text-muted">{past.length} past meeting{past.length === 1 ? "" : "s"}</p>}

      {formOpen && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <p className="text-xs uppercase tracking-wide text-muted">{editingId ? "Reschedule meeting" : "New meeting"} (Central time)</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Date</span>
              <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Time</span>
              <input type="time" value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Length</span>
              <select
                value={draft.durationMinutes}
                onChange={(e) => setDraft((d) => ({ ...d, durationMinutes: Number(e.target.value) }))}
                className={inputClass}
              >
                {(DURATIONS.includes(draft.durationMinutes) ? DURATIONS : [...DURATIONS, draft.durationMinutes].sort((a, b) => a - b)).map((n) => (
                  <option key={n} value={n}>
                    {n} min
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Location (optional)</span>
              <input value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} placeholder="Phone call, office, venue..." className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Video link (optional)</span>
              <input value={draft.meetingUrl} onChange={(e) => setDraft((d) => ({ ...d, meetingUrl: e.target.value }))} placeholder="https://meet.google.com/..." className={inputClass} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Notes for the client (optional)</span>
            <textarea value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} rows={2} className={inputClass} />
          </label>
          <div className="flex items-center gap-3">
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !draft.date || !draft.time}>
              {saving ? "Saving..." : editingId ? "Save & Notify Client" : "Schedule & Notify Client"}
            </Button>
            <Button variant="text" size="sm" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-status-declined">{error}</p>}

      <ConfirmModal
        open={!!pendingCancelId}
        title="Cancel this meeting?"
        body="The client will be emailed that it was cancelled."
        confirmLabel="Cancel Meeting"
        cancelLabel="Keep It"
        onConfirm={() => pendingCancelId && handleCancel(pendingCancelId)}
        onCancel={() => setPendingCancelId(null)}
      />
    </GlassCard>
  );
}
