"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { ArrowLeft, X, CalendarDays } from "lucide-react";

interface EventDetail {
  id: string;
  title: string;
  starts_at: string | null;
  status: string;
  must_play: string[] | null;
  do_not_play: string[] | null;
  special_requests: string | null;
  djs: { display_name: string } | null;
  venues: { name: string } | null;
}

export default function PortalEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [mustPlay, setMustPlay] = useState<string[]>([]);
  const [doNotPlay, setDoNotPlay] = useState<string[]>([]);
  const [specialRequests, setSpecialRequests] = useState("");
  const [newMustPlay, setNewMustPlay] = useState("");
  const [newDoNotPlay, setNewDoNotPlay] = useState("");

  async function load() {
    try {
      const res = await fetch(`/api/portal/events/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load event");
      setEvent(data.event);
      setMustPlay(data.event.must_play ?? []);
      setDoNotPlay(data.event.do_not_play ?? []);
      setSpecialRequests(data.event.special_requests ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/portal/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mustPlay, doNotPlay, specialRequests })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !event) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-status-declined">{error}</p>
        <Link href="/portal" className="mt-4 inline-block text-sm text-gold">← Back to your events</Link>
      </div>
    );
  }

  if (!event) {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-sm text-muted">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/portal" className="mb-6 flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Your events
      </Link>

      <h1 className="text-2xl font-bold">{event.title}</h1>
      <p className="mt-1 flex items-center gap-1 text-sm text-muted">
        <CalendarDays size={13} />
        {event.starts_at ? new Date(event.starts_at).toLocaleString() : "Date TBD"}
        {event.venues?.name ? ` · ${event.venues.name}` : ""}
        {event.djs?.display_name ? ` · ${event.djs.display_name}` : ""}
      </p>

      <p className="mt-6 text-sm text-muted">
        Build your night — tell your DJ exactly what to play and what to skip. Changes save to your event automatically
        for the DJ to see.
      </p>

      <GlassCard neon className="mt-6 flex flex-col gap-3">
        <p className="text-sm font-semibold">Must-Play List</p>
        <SongList items={mustPlay} onRemove={(i) => setMustPlay(mustPlay.filter((_, idx) => idx !== i))} />
        <div className="flex gap-2">
          <input
            value={newMustPlay}
            onChange={(e) => setNewMustPlay(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newMustPlay.trim()) {
                e.preventDefault();
                setMustPlay([...mustPlay, newMustPlay.trim()]);
                setNewMustPlay("");
              }
            }}
            placeholder="Song title — Artist"
            className="flex-1 rounded-xl border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
          />
          <button
            onClick={() => {
              if (newMustPlay.trim()) {
                setMustPlay([...mustPlay, newMustPlay.trim()]);
                setNewMustPlay("");
              }
            }}
            className="rounded-xl border border-black/10 px-4 text-sm font-medium hover:border-gold"
          >
            Add
          </button>
        </div>
      </GlassCard>

      <GlassCard className="mt-4 flex flex-col gap-3">
        <p className="text-sm font-semibold">Do-Not-Play List</p>
        <SongList items={doNotPlay} onRemove={(i) => setDoNotPlay(doNotPlay.filter((_, idx) => idx !== i))} />
        <div className="flex gap-2">
          <input
            value={newDoNotPlay}
            onChange={(e) => setNewDoNotPlay(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newDoNotPlay.trim()) {
                e.preventDefault();
                setDoNotPlay([...doNotPlay, newDoNotPlay.trim()]);
                setNewDoNotPlay("");
              }
            }}
            placeholder="Song title — Artist"
            className="flex-1 rounded-xl border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
          />
          <button
            onClick={() => {
              if (newDoNotPlay.trim()) {
                setDoNotPlay([...doNotPlay, newDoNotPlay.trim()]);
                setNewDoNotPlay("");
              }
            }}
            className="rounded-xl border border-black/10 px-4 text-sm font-medium hover:border-gold"
          >
            Add
          </button>
        </div>
      </GlassCard>

      <GlassCard className="mt-4 flex flex-col gap-2">
        <p className="text-sm font-semibold">Notes for your DJ</p>
        <textarea
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value)}
          placeholder="First dance song, timeline details, anything else your DJ should know..."
          className="min-h-[100px] w-full rounded-xl border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
        />
      </GlassCard>

      {error && <p className="mt-3 text-sm text-status-declined">{error}</p>}
      {saved && <p className="mt-3 text-sm text-status-approved">Saved.</p>}

      <NeonButton color="gold" onClick={handleSave} disabled={saving} className="mt-4">
        {saving ? "Saving..." : "Save changes"}
      </NeonButton>
    </div>
  );
}

function SongList({ items, onRemove }: { items: string[]; onRemove: (index: number) => void }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted">Nothing added yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className="flex items-center gap-1.5 rounded-full border border-black/10 bg-panel px-3 py-1.5 text-xs">
          {item}
          <button onClick={() => onRemove(i)} className="text-muted hover:text-status-declined">
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}
