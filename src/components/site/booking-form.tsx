"use client";

import { useEffect, useRef, useState } from "react";
import { NeonButton } from "@/components/ui/neon-button";
import { EVENT_TYPES } from "@/lib/event-types";
import { BUDGET_RANGES } from "@/lib/security/inquiry-validation";
import { businessToday, checkPublicEventDate } from "@/lib/security/business-date";
import { TurnstileWidget, HoneypotField, newSubmissionId } from "@/components/site/turnstile-widget";
import { CheckEmailPanel } from "@/components/site/check-email-panel";

export function BookingForm({ djs }: { djs: { id: string; display_name: string }[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState("");
  const [preferredDjId, setPreferredDjId] = useState("");
  const [venueName, setVenueName] = useState("");
  const [expectedGuests, setExpectedGuests] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<string | null>(null);
  // "Today" in America/Chicago, refreshed when the page regains focus so a
  // form left open overnight doesn't keep offering yesterday.
  const [today, setToday] = useState(() => businessToday());
  const shownAt = useRef<number>(0);
  const submissionId = useRef<string>("");

  useEffect(() => {
    shownAt.current = Date.now();
    submissionId.current = newSubmissionId();
    const refresh = () => setToday(businessToday());
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const t = setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(t);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    // Re-check the date at the moment of submitting (the server checks again).
    const now = new Date();
    setToday(businessToday(now));
    const dateError = checkPublicEventDate(eventDate, now);
    if (dateError) {
      setFieldErrors({ eventDate: dateError });
      setError(dateError);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          eventDate,
          eventType,
          preferredDjId: preferredDjId || undefined,
          venueName: venueName || undefined,
          expectedGuests: expectedGuests ? Number(expectedGuests) : undefined,
          budgetRange: budgetRange || undefined,
          message: message || undefined,
          website: website || undefined,
          turnstileToken: captcha || undefined,
          elapsedMs: shownAt.current ? Date.now() - shownAt.current : undefined,
          submissionId: submissionId.current || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFieldErrors(data.fieldErrors ?? {});
        throw new Error(data.error || "We couldn't send your request. Please try again.");
      }
      setSent(data.message || "Please check your email to confirm your request.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
      // Each security-check token works once; get a fresh one for a retry.
      setCaptchaReset((k) => k + 1);
    }
  }

  if (sent) {
    return <CheckEmailPanel email={email} message={sent} firstName={name.trim().split(" ")[0]} />;
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-4" noValidate={false}>
      <HoneypotField value={website} onChange={setWebsite} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" value={name} onChange={setName} required placeholder="Your name" maxLength={100} autoComplete="name" error={fieldErrors.name} />
        <Field label="Email address" value={email} onChange={setEmail} required type="email" placeholder="your@email.com" maxLength={254} autoComplete="email" error={fieldErrors.email} />
        <Field label="Phone number" value={phone} onChange={setPhone} type="tel" placeholder="(000) 000-0000" maxLength={30} autoComplete="tel" error={fieldErrors.phone} />
        <Field label="Event date" value={eventDate} onChange={setEventDate} required type="date" min={today} error={fieldErrors.eventDate} />
        <SelectField label="Event type" value={eventType} onChange={setEventType} required options={EVENT_TYPES.map((t) => ({ id: t, label: t }))} placeholder="Select type" />
        <SelectField
          label="Preferred DJ"
          value={preferredDjId}
          onChange={setPreferredDjId}
          options={djs.map((d) => ({ id: d.id, label: d.display_name }))}
          placeholder="No preference"
        />
        <Field label="Venue" value={venueName} onChange={setVenueName} placeholder="Venue or location name" maxLength={150} error={fieldErrors.venueName} />
        <Field label="Expected guest count" value={expectedGuests} onChange={setExpectedGuests} type="number" placeholder="e.g. 120" min="1" max="5000" error={fieldErrors.expectedGuests} />
        <SelectField
          label="Budget range"
          value={budgetRange}
          onChange={setBudgetRange}
          options={BUDGET_RANGES.map((b) => ({ id: b, label: b }))}
          placeholder="Prefer not to say"
        />
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Tell us about your event</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={3000}
          placeholder="Venue, expected attendance, music preferences, start & end time..."
          className="min-h-[100px] w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
        />
      </label>

      <TurnstileWidget action="inquiry" onToken={setCaptcha} resetKey={captchaReset} />

      {error && (
        <p className="text-xs text-status-declined" role="alert">
          {error}
        </p>
      )}

      <p className="text-xs text-muted">We&apos;ll email you a link to confirm your request. Your date isn&apos;t reserved until our team confirms it with you.</p>

      <NeonButton color="gold" type="submit" disabled={submitting || !captcha} className="w-full sm:w-fit">
        {submitting ? "Sending..." : "Send Booking Request"}
      </NeonButton>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  error,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  error?: string;
  min?: string;
  max?: string;
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        {...rest}
        className={`w-full rounded-[2px] border bg-panel px-4 py-2.5 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none ${error ? "border-status-declined" : "border-black/10"}`}
      />
      {error && <span className="mt-1 block text-xs text-status-declined">{error}</span>}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
