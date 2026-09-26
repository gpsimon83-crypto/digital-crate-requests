"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { MeetingForm, EMPTY_MEETING_DRAFT, draftFromMeeting, meetingWhenLabel, type MeetingDraft, type MeetingRow } from "@/components/project/meeting-form";
import { clientName } from "@/lib/format";
import { CalendarCheck, CalendarClock, MapPin, Link2, Pencil, X } from "lucide-react";

type ClientJoin = { first_name: string | null; last_name: string | null; company_name: string | null } | null;

interface MeetingWithProject extends MeetingRow {
  event_id: string;
  events: { title: string; clients: ClientJoin | ClientJoin[] } | { title: string; clients: ClientJoin | ClientJoin[] }[] | null;
}

interface ProjectOption {
  id: string;
  title: string;
  status: string;
}

function projectOf(m: MeetingWithProject) {
  const e = Array.isArray(m.events) ? m.events[0] : m.events;
  const c = e ? (Array.isArray(e.clients) ? e.clients[0] : e.clients) : null;
  return { title: e?.title ?? "Project", client: clientName(c) };
}

export default function AdminMeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingWithProject[] | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<{ eventId: string; meetingId: string } | null>(null);
  const [projectId, setProjectId] = useState("");
  const [draft, setDraft] = useState<MeetingDraft>(EMPTY_MEETING_DRAFT);
  const [saving, setSaving] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<MeetingWithProject | null>(null);
  const [showOlder, setShowOlder] = useState(false);
  const [now] = useState(() => Date.now());

  function load() {
    fetch("/api/admin/meetings")
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

  useEffect(() => {
    load();
    fetch("/api/admin/events")
      .then((r) => r.json())
      .then((data) => setProjects((data.events ?? []).filter((e: ProjectOption) => e.status !== "declined")))
      .catch(() => setProjects([]));
  }, []);

  function openNew() {
    setEditing(null);
    setProjectId("");
    setDraft(EMPTY_MEETING_DRAFT);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(m: MeetingWithProject) {
    setEditing({ eventId: m.event_id, meetingId: m.id });
    setProjectId(m.event_id);
    setDraft(draftFromMeeting(m));
    setError(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    const eventId = editing?.eventId ?? projectId;
    if (!eventId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/meetings${editing ? `/${editing.meetingId}` : ""}`, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save meeting");
      setFormOpen(false);
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(m: MeetingWithProject) {
    try {
      const res = await fetch(`/api/events/${m.event_id}/meetings/${m.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel meeting");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPendingCancel(null);
    }
  }

  const all = meetings ?? [];
  const upcoming = all.filter((m) => m.status === "scheduled" && new Date(m.ends_at).getTime() >= now);
  const older = all
    .filter((m) => m.status === "cancelled" || new Date(m.ends_at).getTime() < now)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  return (
    <>
      <PageHeader
        title="Meetings"
        subtitle="Every client meeting you've scheduled. Clients are emailed and it shows on your calendar."
        action={
          !formOpen ? (
            <Button variant="primary" size="sm" onClick={openNew}>
              <CalendarClock size={14} /> Schedule Meeting
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-4 p-6">
        {error && <p className="text-sm text-status-declined">{error}</p>}

        {formOpen && (
          <GlassCard className="flex flex-col gap-4">
            {!editing && (
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Project</span>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                >
                  <option value="">Choose a project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <MeetingForm
              draft={draft}
              onChange={setDraft}
              onSave={handleSave}
              onCancel={() => {
                setFormOpen(false);
                setEditing(null);
              }}
              saving={saving}
              editing={!!editing}
              disabled={!editing && !projectId}
            />
          </GlassCard>
        )}

        {meetings === null && <p className="text-sm text-muted">Loading…</p>}
        {meetings !== null && upcoming.length === 0 && !formOpen && (
          <EmptyState icon={CalendarCheck} title="No upcoming meetings" body="Use Schedule Meeting to set one up with a client." />
        )}

        {upcoming.length > 0 && (
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {upcoming.map((m) => {
              const p = projectOf(m);
              return (
                <div key={m.id} className="flex items-start justify-between gap-3 py-4">
                  <div className="flex flex-col gap-0.5">
                    <p className="font-medium">{meetingWhenLabel(m.starts_at)}</p>
                    <Link href={`/admin/events/${m.event_id}?tab=Details`} className="text-sm text-gold hover:underline">
                      {p.title}
                    </Link>
                    {p.client && <p className="text-xs text-muted">{p.client}</p>}
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
                  <div className="flex shrink-0 items-center gap-3">
                    <button onClick={() => openEdit(m)} className="text-muted hover:text-gold" aria-label="Reschedule meeting">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setPendingCancel(m)} className="text-muted hover:text-status-declined" aria-label="Cancel meeting">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {older.length > 0 && (
          <div>
            <button onClick={() => setShowOlder((v) => !v)} className="text-xs font-medium text-muted hover:text-gold">
              {showOlder ? "Hide" : "Show"} past &amp; cancelled ({older.length})
            </button>
            {showOlder && (
              <div className="mt-2 flex flex-col divide-y divide-border border-y border-border">
                {older.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 py-3 opacity-60">
                    <div>
                      <p className={m.status === "cancelled" ? "text-sm line-through" : "text-sm"}>{meetingWhenLabel(m.starts_at)}</p>
                      <Link href={`/admin/events/${m.event_id}?tab=Details`} className="text-xs text-muted hover:text-gold">
                        {projectOf(m).title}
                      </Link>
                    </div>
                    <span className="text-[11px] uppercase tracking-wide text-muted">{m.status === "cancelled" ? "Cancelled" : "Past"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!pendingCancel}
        title="Cancel this meeting?"
        body="The client will be emailed that it was cancelled."
        confirmLabel="Cancel Meeting"
        cancelLabel="Keep It"
        onConfirm={() => pendingCancel && handleCancel(pendingCancel)}
        onCancel={() => setPendingCancel(null)}
      />
    </>
  );
}
