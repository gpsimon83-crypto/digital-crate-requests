"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { MeetingForm, EMPTY_MEETING_DRAFT, draftFromMeeting, meetingWhenLabel, type MeetingRow, type MeetingDraft } from "@/components/project/meeting-form";
import { CalendarClock, MapPin, Link2, Pencil, X } from "lucide-react";

export function MeetingsPanel({ eventId }: { eventId: string }) {
  const [meetings, setMeetings] = useState<MeetingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MeetingDraft>(EMPTY_MEETING_DRAFT);
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
    setDraft(EMPTY_MEETING_DRAFT);
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
            <p className="text-sm font-medium">{meetingWhenLabel(m.starts_at)}</p>
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
        <div className="border-t border-border pt-3">
          <MeetingForm draft={draft} onChange={setDraft} onSave={handleSave} onCancel={() => setFormOpen(false)} saving={saving} editing={!!editingId} />
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
