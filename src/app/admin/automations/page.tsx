"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Music2, Zap } from "lucide-react";

interface EventRow {
  event_type: string | null;
  paid_cents: number;
  wedding_music_plan_sent_at: string | null;
}

export default function AdminAutomationsPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/events")
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]));
  }, []);

  const readyCount = (events ?? []).filter(
    (e) => e.event_type?.toLowerCase() === "wedding" && e.paid_cents > 0 && !e.wedding_music_plan_sent_at
  ).length;

  return (
    <>
      <PageHeader title="Automations" subtitle="Automatic follow-ups, reminders, and status changes." />
      <div className="flex flex-col gap-4 p-6">
        <GlassCard className="flex items-start gap-3">
          <Music2 size={20} className="mt-0.5 shrink-0 text-gold" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Wedding Music Plan reminder</p>
            <p className="mt-1 text-sm text-muted">
              When a wedding&rsquo;s first payment comes in, it shows up under Tasks Needing Attention on your Home
              dashboard so you don&rsquo;t forget to send the music planning form.
            </p>
            <Link href="/admin" className="mt-2 inline-block text-xs text-gold hover:underline">
              {events === null ? "Checking…" : `${readyCount} wedding${readyCount === 1 ? "" : "s"} ready right now →`}
            </Link>
          </div>
        </GlassCard>

        <div className="flex items-start gap-3 border border-border p-4">
          <Zap size={18} className="mt-0.5 shrink-0 text-muted" />
          <p className="text-sm text-muted">
            This is a suggestion, not an auto-send — you still review and send the form yourself from a project&rsquo;s
            Files tab. A full workflow engine (auto lead follow-ups, payment reminders) isn&rsquo;t built yet.
          </p>
        </div>
      </div>
    </>
  );
}
