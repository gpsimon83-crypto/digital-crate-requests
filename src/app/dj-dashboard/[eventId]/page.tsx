"use client";

import { use, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { Play, Square, Pause, PlayCircle, Zap, VolumeX, MessageSquare } from "lucide-react";

interface EventData {
  id: string;
  title: string;
  status: string;
  venues: { name: string } | null;
  djs: { display_name: string; photo_url: string | null } | null;
  guest_request_settings: GuestSettings;
}

interface GuestSettings {
  requestsPaused?: boolean;
  happyHourEnabled?: boolean;
  priorityModeEnabled?: boolean;
  explicitAllowed?: boolean;
  welcomeMessage?: string;
  priceAdjustmentCents?: number;
}

interface RequestRow {
  id: string;
  song_title: string;
  artist: string | null;
  vote_count: number;
  status: string;
}

interface FeedRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: "Awaiting Confirmation",
  confirmed: "Confirmed — Not Started",
  live: "Live",
  ended: "Ended",
  declined: "Declined",
};

export default function EventOverviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId: eventCode } = use(params);
  const [event, setEvent] = useState<EventData | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const eventRes = await fetch(`/api/events/code/${eventCode}`);
      const eventData = await eventRes.json();
      if (!eventRes.ok) throw new Error(eventData.error || "Failed to load event");
      setEvent(eventData.event);

      const [reqRes, feedRes] = await Promise.all([
        fetch(`/api/events/${eventData.event.id}/requests`),
        fetch(`/api/events/${eventData.event.id}/feed`),
      ]);
      const reqData = await reqRes.json();
      const feedData = await feedRes.json();
      if (reqRes.ok) setRequests(reqData.requests ?? []);
      if (feedRes.ok) setFeed(feedData.feed ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    load();
  }, [eventCode]);

  async function updateSettings(patch: Partial<GuestSettings>) {
    if (!event) return;
    setBusy(true);
    try {
      const merged = { ...event.guest_request_settings, ...patch };
      const res = await fetch(`/api/events/${event.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestRequestSettings: merged }),
      });
      const data = await res.json();
      if (res.ok) setEvent((e) => (e ? { ...e, guest_request_settings: merged } : e));
      else throw new Error(data.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function lifecycleAction(action: "start" | "close") {
    if (!event) return;
    setBusy(true);
    try {
      await fetch(`/api/events/${event.id}/${action}`, { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <>
        <PageHeader title="Event Overview" subtitle="" />
        <p className="p-6 text-sm text-status-declined">{error}</p>
      </>
    );
  }

  if (!event) {
    return (
      <>
        <PageHeader title="Event Overview" subtitle="" />
        <p className="p-6 text-sm text-muted">Loading...</p>
      </>
    );
  }

  const settings = event.guest_request_settings ?? {};
  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <>
      <PageHeader
        title={event.title}
        subtitle={`${event.venues?.name ?? "No venue"} · ${STATUS_LABEL[event.status] ?? event.status}`}
        action={event.djs && <DjAvatar name={event.djs.display_name} photoUrl={event.djs.photo_url} size={44} />}
      />
      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Pending Requests" value={String(pending)} />
          <StatCard label="Total Requests" value={String(requests.length)} />
          <StatCard label="Feed Activity" value={String(feed.length)} />
          <StatCard label="Status" value={STATUS_LABEL[event.status] ?? event.status} />
        </div>

        <GlassCard neon className="flex flex-col gap-4">
          <p className="text-sm font-semibold">Live DJ Controls</p>
          <div className="flex flex-wrap gap-2">
            {event.status === "confirmed" && (
              <ControlButton icon={Play} label="Start Event" onClick={() => lifecycleAction("start")} disabled={busy} accent="approved" />
            )}
            {event.status === "live" && (
              <ControlButton icon={Square} label="Close Event" onClick={() => lifecycleAction("close")} disabled={busy} accent="declined" />
            )}
            <ControlButton
              icon={settings.requestsPaused ? PlayCircle : Pause}
              label={settings.requestsPaused ? "Resume Requests" : "Pause Requests"}
              onClick={() => updateSettings({ requestsPaused: !settings.requestsPaused })}
              disabled={busy}
            />
            <ControlButton
              icon={Zap}
              label={settings.happyHourEnabled ? "Disable Happy Hour" : "Enable Happy Hour"}
              onClick={() => updateSettings({ happyHourEnabled: !settings.happyHourEnabled })}
              disabled={busy}
            />
            <ControlButton
              icon={Zap}
              label={settings.priorityModeEnabled ? "Disable Priority Mode" : "Enable Priority Mode"}
              onClick={() => updateSettings({ priorityModeEnabled: !settings.priorityModeEnabled })}
              disabled={busy}
            />
            <ControlButton
              icon={VolumeX}
              label={settings.explicitAllowed ? "Disable Explicit Songs" : "Allow Explicit Songs"}
              onClick={() => updateSettings({ explicitAllowed: !settings.explicitAllowed })}
              disabled={busy}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted">Price Adjustment (this event)</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateSettings({ priceAdjustmentCents: (settings.priceAdjustmentCents ?? 0) - 100 })}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-muted hover:text-foreground"
                >
                  − $1
                </button>
                <span className="text-sm font-semibold">
                  {(settings.priceAdjustmentCents ?? 0) >= 0 ? "+" : ""}
                  ${((settings.priceAdjustmentCents ?? 0) / 100).toFixed(2)}
                </span>
                <button
                  onClick={() => updateSettings({ priceAdjustmentCents: (settings.priceAdjustmentCents ?? 0) + 100 })}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-muted hover:text-foreground"
                >
                  + $1
                </button>
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
                <MessageSquare size={12} /> Welcome Message
              </span>
              <input
                defaultValue={settings.welcomeMessage ?? ""}
                onBlur={(e) => updateSettings({ welcomeMessage: e.target.value })}
                placeholder="Welcome! Request your song below..."
                className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2 text-sm focus:border-gold focus:outline-none"
              />
            </label>
          </div>
        </GlassCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <p className="mb-3 text-sm font-semibold">Requests needing action</p>
            {requests.filter((r) => r.status === "pending").length === 0 && (
              <p className="text-xs text-muted">Nothing pending.</p>
            )}
            <ul className="flex flex-col gap-2">
              {requests
                .filter((r) => r.status === "pending")
                .map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">
                      {r.song_title} <span className="text-muted">— {r.artist}</span>
                    </span>
                    <span className="text-gold font-semibold">{r.vote_count}▲</span>
                  </li>
                ))}
            </ul>
          </GlassCard>

          <GlassCard>
            <p className="mb-3 text-sm font-semibold">Live Party Feed</p>
            {feed.length === 0 && <p className="text-xs text-muted">No activity yet.</p>}
            <ul className="flex flex-col gap-2.5 text-sm">
              {feed.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3">
                  <span className="text-muted">{describeFeedEvent(f)}</span>
                  <span className="shrink-0 text-[11px] text-muted/70">
                    {new Date(f.created_at).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </div>
    </>
  );
}

function describeFeedEvent(f: FeedRow): string {
  const payload = f.payload ?? {};
  switch (f.type) {
    case "request":
      return `Requested: ${payload.songTitle ?? "a song"}`;
    case "tip":
      return `Tip received: $${((payload.amountCents as number) / 100).toFixed(2)}`;
    case "boost":
      return `Boosted: ${payload.songTitle ?? "a song"} +$${((payload.amountCents as number) / 100).toFixed(0)}`;
    case "played":
      return `Played: ${payload.songTitle ?? "a song"}`;
    default:
      return f.type;
  }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-extrabold">{value}</p>
    </GlassCard>
  );
}

function ControlButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  accent,
}: {
  icon: typeof Play;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: "approved" | "declined";
}) {
  const accentClass =
    accent === "approved"
      ? "border-status-approved/40 text-status-approved"
      : accent === "declined"
        ? "border-status-declined/40 text-status-declined"
        : "border-white/15 text-muted hover:text-foreground";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${accentClass}`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}
