"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { EVENT_TYPES } from "@/lib/event-types";

export function BookingForm({ djs }: { djs: { id: string; display_name: string }[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState("");
  const [preferredDjId, setPreferredDjId] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
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
          message: message || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send booking request");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <GlassCard className="text-center">
        <p className="font-semibold">Thank you, {name.split(" ")[0]}.</p>
        <p className="mt-2 text-sm text-muted">
          Your booking request has been received — the Digital Crate team will be in touch within 24 hours.
        </p>
      </GlassCard>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" value={name} onChange={setName} required placeholder="Your name" />
        <Field label="Email address" value={email} onChange={setEmail} required type="email" placeholder="your@email.com" />
        <Field label="Phone number" value={phone} onChange={setPhone} type="tel" placeholder="(000) 000-0000" />
        <Field label="Event date" value={eventDate} onChange={setEventDate} required type="date" />
        <SelectField label="Event type" value={eventType} onChange={setEventType} required options={EVENT_TYPES.map((t) => ({ id: t, label: t }))} placeholder="Select type" />
        <SelectField
          label="Preferred DJ"
          value={preferredDjId}
          onChange={setPreferredDjId}
          options={djs.map((d) => ({ id: d.id, label: d.display_name }))}
          placeholder="No preference"
        />
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Tell us about your event</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Venue, expected attendance, music preferences, start & end time..."
          className="min-h-[100px] w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
        />
      </label>

      {error && <p className="text-xs text-status-declined">{error}</p>}

      <NeonButton color="gold" type="submit" disabled={submitting} className="w-full sm:w-fit">
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
  required = false
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
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
        className="w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
      />
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
