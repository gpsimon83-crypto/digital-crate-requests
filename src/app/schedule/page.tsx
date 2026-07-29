"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";
import { CalendarDays, Check } from "lucide-react";

interface Slot {
  time: string;
  available: boolean;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function to12Hour(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

const NEXT_DAYS = Array.from({ length: 14 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return d;
});

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(NEXT_DAYS[0]);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ date: string; time: string } | null>(null);

  const dk = useMemo(() => dateKey(selectedDate), [selectedDate]);

  useEffect(() => {
    setSlots(null);
    setSelectedTime(null);
    fetch(`/api/scheduler/availability?date=${dk}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]));
  }, [dk]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTime) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/scheduler/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: phone || undefined, date: dk, time: selectedTime, message: message || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to book");
      setConfirmed({ date: dk, time: selectedTime });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-approved/15 text-status-approved">
          <Check size={24} />
        </span>
        <h1 className="font-display text-3xl font-light">You&rsquo;re booked</h1>
        <p className="mt-2 text-sm text-muted">
          {new Date(`${confirmed.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          {" at "}
          {to12Hour(confirmed.time)}
        </p>
        <p className="mt-4 text-sm text-muted">We&rsquo;ll follow up at the email you gave us to confirm the call.</p>
        <Link href="/" className="mt-6 text-sm text-gold hover:underline">← Back to cratesdjs.com</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo variant="icon" brand="crates-djs" size={44} />
        <div>
          <h1 className="font-display text-3xl font-light">Book a Call</h1>
          <p className="mt-1 text-xs text-muted">Pick a time that works for you — 15 minutes, no obligation.</p>
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {NEXT_DAYS.map((d) => {
          const active = dateKey(d) === dk;
          return (
            <button
              key={dateKey(d)}
              onClick={() => setSelectedDate(d)}
              className={cn(
                "flex shrink-0 flex-col items-center gap-0.5 rounded-[2px] border px-3 py-2 text-xs",
                active ? "border-gold bg-gold text-black" : "border-black/10 text-muted hover:border-gold"
              )}
            >
              <span className="font-semibold uppercase tracking-wide">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <span>{d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            </button>
          );
        })}
      </div>

      <GlassCard className="flex flex-col gap-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarDays size={14} />
          {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>

        {slots === null && <p className="text-sm text-muted">Loading times...</p>}
        {slots !== null && slots.length === 0 && <p className="text-sm text-muted">No availability this day — try another date.</p>}

        {slots && slots.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => (
              <button
                key={s.time}
                disabled={!s.available}
                onClick={() => setSelectedTime(s.time)}
                className={cn(
                  "rounded-[2px] border px-2 py-2 text-xs font-medium",
                  !s.available && "cursor-not-allowed border-black/5 text-muted/40 line-through",
                  s.available && selectedTime === s.time && "border-gold bg-gold text-black",
                  s.available && selectedTime !== s.time && "border-black/10 hover:border-gold"
                )}
              >
                {to12Hour(s.time)}
              </button>
            ))}
          </div>
        )}
      </GlassCard>

      {selectedTime && (
        <GlassCard neon className="mt-6 flex flex-col gap-3">
          <p className="text-sm font-semibold">
            {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} at {to12Hour(selectedTime)}
          </p>
          <form onSubmit={handleBook} className="flex flex-col gap-3">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Anything we should know before the call? (optional)"
              className="min-h-[80px] rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
            {error && <p className="text-xs text-status-declined">{error}</p>}
            <NeonButton color="gold" type="submit" disabled={submitting} className="w-full">
              {submitting ? "Booking..." : "Confirm booking"}
            </NeonButton>
          </form>
        </GlassCard>
      )}
    </div>
  );
}
