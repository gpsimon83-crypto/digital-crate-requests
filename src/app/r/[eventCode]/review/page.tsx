"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { DisclaimerBanner } from "@/components/ui/disclaimer-banner";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function ReviewPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventCode: string }>;
  searchParams: Promise<{ type?: string; songTitle?: string; artist?: string; amount?: string; message?: string }>;
}) {
  const { eventCode } = use(params);
  const { type, songTitle, artist, amount, message } = use(searchParams);
  const router = useRouter();
  const isTip = type === "tip";
  const amountCents = Number(amount) || 0;

  const [requireDisclaimer, setRequireDisclaimer] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setRequireDisclaimer(data.settings?.require_disclaimer_acceptance ?? true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (amountCents <= 0) {
      setError("Missing or invalid amount.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function createIntent() {
      try {
        const eventRes = await fetch(`/api/events/code/${eventCode}`);
        if (!eventRes.ok) throw new Error("Could not find this event.");
        const { event } = await eventRes.json();
        const customerId = localStorage.getItem("dcdj_guest_id") || undefined;

        const endpoint = isTip ? "/api/tips/create-intent" : "/api/requests/create-intent";
        const body = isTip
          ? { eventId: event.id, djId: event.djs?.id, customerId, amountCents, message: message ?? "" }
          : { eventId: event.id, songTitle, artist, amountCents, customerId };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start payment.");
        if (!cancelled) setClientSecret(data.clientSecret);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    createIntent();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventCode, isTip, amountCents]);

  const canSubmit = !requireDisclaimer || accepted;

  const options = useMemo(
    () => (clientSecret ? { clientSecret, appearance: { theme: "night" as const, variables: { colorPrimary: "#d4af37" } } } : null),
    [clientSecret]
  );

  return (
    <main className="flex flex-col gap-5 px-5 pt-10">
      <header>
        <h1 className="gold-text-gradient text-xl font-extrabold">Review &amp; Pay</h1>
        <p className="mt-1 text-sm text-muted">
          {isTip
            ? "Your tip is captured immediately and sent to the DJ."
            : "Your card will be authorized now, but only charged if the DJ plays your song."}
        </p>
      </header>

      <GlassCard className="flex flex-col gap-3 text-sm">
        {!isTip && songTitle && (
          <Row label="Song" value={artist ? `${songTitle} — ${artist}` : songTitle} />
        )}
        <Row label={isTip ? "Tip amount" : "Request fee"} value={`$${(amountCents / 100).toFixed(2)}`} />
        <div className="h-px bg-black/10" />
        <Row label="Total" value={`$${(amountCents / 100).toFixed(2)}`} bold />
      </GlassCard>

      {!isTip && (
        <GlassCard className="text-xs text-muted">
          <p className="mb-1 font-semibold text-foreground">How this charge works</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Your card is authorized now — not charged yet.</li>
            <li>If the DJ plays your song, the charge is captured.</li>
            <li>If it&apos;s declined or unplayed, the authorization is released.</li>
          </ul>
        </GlassCard>
      )}

      <DisclaimerBanner />

      {requireDisclaimer && (
        <label className="flex items-start gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 accent-gold"
          />
          I have read and accept the disclaimer above.
        </label>
      )}

      {error && <p className="text-xs text-status-declined">{error}</p>}

      {loading && !error && <p className="text-sm text-muted">Preparing secure payment...</p>}

      {options && (
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm
            eventCode={eventCode}
            isTip={isTip}
            canSubmit={canSubmit}
            onError={setError}
          />
        </Elements>
      )}
    </main>
  );
}

function CheckoutForm({
  eventCode,
  isTip,
  canSubmit,
  onError,
}: {
  eventCode: string;
  isTip: boolean;
  canSubmit: boolean;
  onError: (msg: string | null) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handlePay() {
    if (!stripe || !elements || !canSubmit) return;
    setSubmitting(true);
    onError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      onError(submitError.message ?? "Payment details are incomplete.");
      setSubmitting(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/r/${eventCode}/confirmation`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      onError(confirmError.message ?? "Payment failed.");
      setSubmitting(false);
      return;
    }

    router.push(`/r/${eventCode}/confirmation`);
  }

  return (
    <div className="flex flex-col gap-4">
      <GlassCard>
        <PaymentElement />
      </GlassCard>
      <NeonButton
        color={isTip ? "pink" : "cyan"}
        className="w-full"
        onClick={handlePay}
        disabled={!canSubmit || !stripe || submitting}
      >
        {submitting ? "Processing..." : isTip ? "Send Tip" : "Authorize & Submit"}
      </NeonButton>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-muted" : ""}>{label}</span>
      <span className={bold ? "text-base font-bold" : muted ? "text-muted" : ""}>{value}</span>
    </div>
  );
}
