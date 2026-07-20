"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { DisclaimerBanner } from "@/components/ui/disclaimer-banner";
import { SongSearch, type SelectedTrack } from "@/components/guest/song-search";
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "@/lib/pricing";

export default function RequestSongPage({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const { eventCode } = use(params);
  const router = useRouter();
  const [config, setConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);
  const [track, setTrack] = useState<SelectedTrack | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtist, setManualArtist] = useState("");
  const [note, setNote] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((data) => setConfig(data.config))
      .catch(() => {});
  }, []);

  const songTitle = track?.title || manualTitle;
  const artist = track?.artist || manualArtist;

  async function handleSubmit() {
    if (!songTitle) {
      setError("Enter or select a song first.");
      return;
    }
    if (amountCents > 0) {
      router.push(
        `/r/${eventCode}/review?type=request&songTitle=${encodeURIComponent(songTitle)}&artist=${encodeURIComponent(artist)}&amount=${amountCents}`
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const eventRes = await fetch(`/api/events/code/${eventCode}`);
      if (!eventRes.ok) throw new Error("Could not find this event. Connect Supabase and add an event with this code.");
      const { event } = await eventRes.json();

      const customerId = localStorage.getItem("dcdj_guest_id") || undefined;
      const res = await fetch("/api/requests/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, songTitle, artist, amountCents: 0, customerId }),
      });
      if (!res.ok) throw new Error("Failed to submit request.");

      router.push(`/r/${eventCode}/confirmation`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-col gap-5 px-5 pt-10">
      <header>
        <h1 className="gold-text-gradient text-xl font-extrabold">Request a Song</h1>
        <p className="mt-1 text-sm text-muted">Search or type a song and artist below.</p>
      </header>

      <GlassCard className="flex flex-col gap-4">
        <SongSearch onSelect={setTrack} />

        {!track && (
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="Or type song title..."
              className="w-full rounded-xl border border-black/10 bg-panel px-4 py-3 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
            />
            <input
              value={manualArtist}
              onChange={(e) => setManualArtist(e.target.value)}
              placeholder="Artist"
              className="w-full rounded-xl border border-black/10 bg-panel px-4 py-3 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-muted">How would you like to submit?</span>
          <div className="grid grid-cols-3 gap-2">
            {config.requestPricing.presetCents.map((cents) => (
              <button
                key={cents}
                type="button"
                onClick={() => setAmountCents(cents)}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
                  amountCents === cents ? "border-gold bg-gold/10 text-gold" : "border-black/10 bg-panel"
                }`}
              >
                {cents === 0 ? "Free" : `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
            Add a note (optional)
          </span>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. play it for our anniversary dance"
            className="w-full rounded-xl border border-black/10 bg-panel px-4 py-3 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
          />
        </label>
      </GlassCard>

      {error && <p className="text-xs text-status-declined">{error}</p>}

      <DisclaimerBanner />

      <div className="flex flex-col gap-3 pb-4">
        <NeonButton color="gold" className="w-full" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Submitting..." : amountCents > 0 ? "Continue to Payment" : "Submit Request"}
        </NeonButton>
        <Link
          href={`/r/${eventCode}/vote`}
          className="text-center text-xs text-muted underline underline-offset-4"
        >
          See existing requests to vote instead
        </Link>
      </div>
    </main>
  );
}
