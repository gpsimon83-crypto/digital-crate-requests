"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventRow {
  id: string;
  title: string;
  status: string;
  starts_at: string | null;
  djs: { display_name: string } | null;
  venues: { name: string } | null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_DOT: Record<string, string> = {
  inquiry: "bg-muted",
  pending_confirmation: "bg-amber-500",
  confirmed: "bg-status-approved",
  live: "bg-gold",
  ended: "bg-muted",
  declined: "bg-status-declined"
};

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<Date | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/events");
      const data = await res.json();
      setEvents(res.ok ? data.events : []);
    }
    load();
  }, []);

  const eventsWithDate = useMemo(
    () => (events ?? []).filter((e) => e.starts_at && e.status !== "declined"),
    [events]
  );

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [cursor]);

  const today = new Date();
  const selectedDay = selected ?? today;
  const dayEvents = eventsWithDate.filter((e) => sameDay(new Date(e.starts_at as string), selectedDay));

  return (
    <>
      <PageHeader title="Calendar" subtitle="Every confirmed and pending event, at a glance." />
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
        <GlassCard className="p-4">
          <div className="mb-4 flex items-center justify-between px-1">
            <p className="font-display text-xl font-light">{monthLabel}</p>
            <div className="flex gap-1">
              <button
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                className="rounded-[2px] p-1.5 hover:bg-black/5"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCursor(new Date())}
                className="rounded-[2px] px-2 text-xs font-medium text-muted hover:bg-black/5"
              >
                Today
              </button>
              <button
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                className="rounded-[2px] p-1.5 hover:bg-black/5"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-t border-l border-border">
            {WEEKDAYS.map((w) => (
              <div key={w} className="border-b border-r border-border px-2 py-1.5 text-center text-[11px] text-muted">
                {w}
              </div>
            ))}
            {days.map((d) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = sameDay(d, today);
              const isSelected = sameDay(d, selectedDay);
              const dayItems = eventsWithDate.filter((e) => sameDay(new Date(e.starts_at as string), d));
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelected(d)}
                  className={cn(
                    "flex min-h-[84px] flex-col items-start gap-1 border-b border-r border-border p-1.5 text-left align-top transition-colors hover:bg-black/5",
                    !inMonth && "opacity-40",
                    isSelected && "bg-gold/10"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-[2px] text-xs",
                      isToday && "bg-gold text-black"
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {dayItems.slice(0, 3).map((e) => (
                      <span key={e.id} className="flex items-center gap-1 text-[10px] text-muted">
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[e.status] ?? "bg-muted")} />
                        <span className="truncate">{e.title}</span>
                      </span>
                    ))}
                    {dayItems.length > 3 && <span className="text-[10px] text-muted">+{dayItems.length - 3} more</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="flex h-fit flex-col gap-3">
          <p className="text-sm font-semibold">
            {selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <div className="flex flex-col divide-y divide-border">
            {dayEvents.length === 0 && <p className="py-2 text-sm text-muted">Nothing scheduled.</p>}
            {dayEvents.map((e) => (
              <Link key={e.id} href="/admin/events" className="group flex flex-col py-2.5 first:pt-0">
                <span className="text-sm font-medium group-hover:text-gold">{e.title}</span>
                <span className="text-xs text-muted">
                  {e.djs?.display_name ?? "Unassigned"}
                  {e.venues?.name ? ` · ${e.venues.name}` : ""}
                </span>
              </Link>
            ))}
          </div>
        </GlassCard>
      </div>
    </>
  );
}
