"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";
import { CalendarDays, MailCheck } from "lucide-react";
import { businessToday, checkPublicEventDate } from "@/lib/security/business-date";
import { TurnstileWidget, HoneypotField, newSubmissionId } from "@/components/site/turnstile-widget";
import { CheckEmailPanel } from "@/components/site/check-email-panel";

interface Slot {
  time: string;
  available: boolean;
}

// Days are calendar dates in America/Chicago, held as UTC-noon Date objects
// and always formatted in UTC, so a visitor's own timezone can't shift them.
function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function nextDays(today: string, count = 14) {
  const base = new Date(`${today}T12:00:00Z`).getTime();
  return Array.from({ length: count }, (_, i) => new Date(base + i * 86400000));
}

const UTC = { timeZone: "UTC" } as const;

function to12Hour(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}



export default function SchedulePage() {
  const [today, setToday] = useState(() => businessToday());
  const NEXT_DAYS = useMemo(() => nextDays(today), [today]);
  const [selectedDate, setSelectedDate] = useState<Date>(() => nextDays(businessToday())[0]);
  const [website, setWebsite] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const shownAt = useRef(0);
  const submissionId = useRef("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the page sat open past midnight, a day that's now in the past is never used.
  const activeDate = dateKey(selectedDate) < today ? NEXT_DAYS[0] : selectedDate;
  const dk = dateKey(activeDate);

  useEffect(() => {
    shownAt.current = Date.now();
    submissionId.current = newSubmissionId();
    const refresh = () => setToday(businessToday());
    window.addEventListener("focus", refresh);
    const t = setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("focus", refresh);
      clearInterval(t);
    };
  }, []);

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
    setError(null);
    const dateError = checkPublicEventDate(dk);
    if (dateError) {
      setError(dateError);
      setToday(businessToday());
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/scheduler/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          date: dk,
          time: selectedTime,
          message: message || undefined,
          website: website || undefined,
          turnstileToken: captcha || undefined,
          elapsedMs: shownAt.current ? Date.now() - shownAt.current : undefined,
          submissionId: submissionId.current || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "We couldn't book that time. Please try again.");
      setSentMessage(data.message || "Please check your email to confirm your call.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
      setCaptchaReset((k) => k + 1);
    }
  }

  if (sentMessage) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
          <MailCheck size={24} />
        </span>
        <p className="mb-4 text-center text-sm text-muted">
          Holding {activeDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", ...UTC })}
          {selectedTime ? ` at ${to12Hour(selectedTime)} Central` : ""} while you confirm.
        </p>
        <CheckEmailPanel email={email} message={sentMessage} firstName={name.trim().split(" ")[0]} />
        <Link href="/" className="mt-6 text-center text-sm text-gold hover:underline">← Back to cratesdjs.com</Link>
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
              <span className="font-semibold uppercase tracking-wide">{d.toLocaleDateString(undefined, { weekday: "short", ...UTC })}</span>
              <span>{d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...UTC })}</span>
            </button>
          );
        })}
      </div>

      <GlassCard className="flex flex-col gap-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarDays size={14} />
          {activeDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", ...UTC })}
          <span className="font-normal text-muted">· times in Central</span>
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
            {activeDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", ...UTC })} at {to12Hour(selectedTime)} Central
          </p>
          <form onSubmit={handleBook} className="relative flex flex-col gap-3">
            <HoneypotField value={website} onChange={setWebsite} />
            <input
              required
              maxLength={100}
              autoComplete="name"
              aria-label="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
            <input
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
            <input
              type="tel"
              maxLength={30}
              autoComplete="tel"
              aria-label="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Anything we should know before the call? (optional)"
              aria-label="Anything we should know before the call? (optional)"
              maxLength={2000}
              className="min-h-[80px] rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
            <TurnstileWidget action="consultation" onToken={setCaptcha} resetKey={captchaReset} />
            {error && (
              <p className="text-xs text-status-declined" role="alert">
                {error}
              </p>
            )}
            <p className="text-xs text-muted">We&apos;ll hold this time and email you a link to confirm it.</p>
            <NeonButton color="gold" type="submit" disabled={submitting || !captcha} className="w-full">
              {submitting ? "Booking..." : "Request this time"}
            </NeonButton>
          </form>
        </GlassCard>
      )}
    </div>
  );
}
