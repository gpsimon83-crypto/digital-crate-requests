"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DjAvatar } from "@/components/dashboard/dj-avatar";

interface EventInfo {
  title: string;
  djs: { display_name: string; photo_url: string | null } | null;
}

export function EventBreadcrumb() {
  const params = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventInfo | null>(null);

  useEffect(() => {
    fetch(`/api/events/code/${params.eventId}`)
      .then((r) => r.json())
      .then((data) => setEvent(data?.event ?? null))
      .catch(() => {});
  }, [params.eventId]);

  return (
    <div className="flex items-center gap-2.5 border-b border-white/8 bg-panel/40 px-4 py-2.5 text-xs sm:px-8">
      <Link
        href="/dj-dashboard/bookings"
        className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 font-medium text-muted transition-colors hover:border-gold/40 hover:text-gold"
      >
        <ChevronLeft size={13} /> All Events
      </Link>
      {event?.djs && <DjAvatar name={event.djs.display_name} photoUrl={event.djs.photo_url} size={22} />}
      {event?.title && (
        <span className="truncate text-muted">
          <span className="mr-2 text-white/20">/</span>
          {event.title}
          <span className="ml-2 font-mono text-gold/80">{params.eventId}</span>
        </span>
      )}
    </div>
  );
}
