"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { BUSINESS_TIMEZONE } from "@/lib/scheduler-time";
import { CalendarClock, MapPin, Link2 } from "lucide-react";

export interface PortalMeeting {
  id: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  meeting_url: string | null;
  notes: string | null;
}

function whenLabel(startsAt: string) {
  return new Date(startsAt).toLocaleString("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

export function UpcomingMeetingCard({ meetings }: { meetings: PortalMeeting[] }) {
  if (meetings.length === 0) return null;

  return (
    <GlassCard className="flex flex-col gap-3">
      <p className="text-sm font-semibold">{meetings.length === 1 ? "Your upcoming meeting" : "Your upcoming meetings"}</p>
      {meetings.map((m) => (
        <div key={m.id} className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold-dim">
            <CalendarClock size={16} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
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
        </div>
      ))}
    </GlassCard>
  );
}
