"use client";

import { Button } from "@/components/ui/button";
import { BUSINESS_TIMEZONE } from "@/lib/scheduler-time";

export interface MeetingRow {
  id: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  meeting_url: string | null;
  notes: string | null;
  status: "scheduled" | "cancelled";
}

export interface MeetingDraft {
  date: string;
  time: string;
  durationMinutes: number;
  location: string;
  meetingUrl: string;
  notes: string;
}

export const EMPTY_MEETING_DRAFT: MeetingDraft = { date: "", time: "", durationMinutes: 30, location: "", meetingUrl: "", notes: "" };
const DURATIONS = [15, 30, 45, 60, 90, 120];

export function meetingWhenLabel(startsAt: string) {
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
export function draftFromMeeting(m: MeetingRow): MeetingDraft {
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

const inputClass = "w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none";

export function MeetingForm({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  editing,
  disabled
}: {
  draft: MeetingDraft;
  onChange: (next: MeetingDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  editing: boolean;
  disabled?: boolean;
}) {
  const set = <K extends keyof MeetingDraft>(key: K, value: MeetingDraft[K]) => onChange({ ...draft, [key]: value });
  const durations = DURATIONS.includes(draft.durationMinutes) ? DURATIONS : [...DURATIONS, draft.durationMinutes].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs uppercase tracking-wide text-muted">{editing ? "Reschedule meeting" : "New meeting"} (Central time)</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Date</span>
          <input type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Time</span>
          <input type="time" value={draft.time} onChange={(e) => set("time", e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Length</span>
          <select value={draft.durationMinutes} onChange={(e) => set("durationMinutes", Number(e.target.value))} className={inputClass}>
            {durations.map((n) => (
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
          <input value={draft.location} onChange={(e) => set("location", e.target.value)} placeholder="Phone call, office, venue..." className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Video link (optional)</span>
          <input value={draft.meetingUrl} onChange={(e) => set("meetingUrl", e.target.value)} placeholder="https://meet.google.com/..." className={inputClass} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Notes for the client (optional)</span>
        <textarea value={draft.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={inputClass} />
      </label>
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={onSave} disabled={saving || disabled || !draft.date || !draft.time}>
          {saving ? "Saving..." : editing ? "Save & Notify Client" : "Schedule & Notify Client"}
        </Button>
        <Button variant="text" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
