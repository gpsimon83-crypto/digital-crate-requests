"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";

const GENRES = ["Hip-Hop", "Pop", "House", "R&B", "Latin", "Country"];

export default function LoginPage({ params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = use(params);
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleGenre(g: string) {
    setGenres((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  }

  async function handleSubmit() {
    if (!fullName.trim()) {
      setError("Enter your name to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          birthday: birthday || undefined,
          favoriteGenres: genres,
          marketingOptIn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile");
      localStorage.setItem("dcdj_guest_id", data.customer.id);
      localStorage.setItem("dcdj_guest_name", data.customer.full_name);
      router.push(`/r/${eventCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-col gap-6 px-5 pt-10">
      <header className="text-center">
        <h1 className="gold-text-gradient text-xl font-extrabold">Create Your Profile</h1>
        <p className="mt-1 text-sm text-muted">
          Save your requests, tips, and rewards across every Digital Crate DJs event.
        </p>
      </header>

      <GlassCard className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <Field label="Full Name" type="text" placeholder="Jordan Smith" value={fullName} onChange={setFullName} />
          <Field label="Phone Number" type="tel" placeholder="(555) 555-0100" value={phone} onChange={setPhone} />
          <Field label="Email" type="email" placeholder="you@email.com" value={email} onChange={setEmail} />
          <Field label="Birthday (optional)" type="date" value={birthday} onChange={setBirthday} />

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
              Favorite Genres
            </label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    genres.includes(g) ? "border-gold text-gold" : "border-white/10 bg-panel text-muted"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 accent-[var(--neon-cyan)]"
            />
            Send me updates about future Digital Crate DJs events and offers.
          </label>

          {error && <p className="text-xs text-status-declined">{error}</p>}

          <NeonButton color="cyan" className="mt-2 w-full" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Continue"}
          </NeonButton>
        </div>
      </GlassCard>
    </main>
  );
}

function Field({
  label,
  type,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-neon-cyan focus:outline-none"
      />
    </label>
  );
}
