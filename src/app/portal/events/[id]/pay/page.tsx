"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { ArrowLeft } from "lucide-react";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function PortalPayPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string; amount?: string }>;
}) {
  const { id } = use(params);
  const { kind: kindParam, amount } = use(searchParams);

  const kind = kindParam ?? "balance";
  const amountCents = Number(amount) || 0;

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (amountCents <= 0) {
      setError("Missing or invalid amount.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/portal/events/${id}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, amountCents })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start payment.");
        if (!cancelled) setClientSecret(data.clientSecret);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, kind, amountCents]);

  const options = useMemo(
    () => (clientSecret ? { clientSecret, appearance: { theme: "stripe" as const, variables: { colorPrimary: "#BA8B4B" } } } : null),
    [clientSecret]
  );

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Link href={`/portal/events/${id}`} className="mb-6 flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Back to your event
      </Link>

      <h1 className="font-display text-3xl font-light">{kind === "deposit" ? "Pay Deposit" : "Pay Remaining Balance"}</h1>
      <p className="mt-1 text-sm text-muted">${(amountCents / 100).toFixed(2)}</p>

      {error && <p className="mt-4 text-sm text-status-declined">{error}</p>}
      {loading && !error && <p className="mt-4 text-sm text-muted">Preparing secure payment...</p>}

      {options && (
        <Elements stripe={stripePromise} options={options}>
          <PayForm eventId={id} />
        </Elements>
      )}
    </div>
  );
}

function PayForm({ eventId }: { eventId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Payment details are incomplete.");
      setSubmitting(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/portal/events/${eventId}`
      },
      redirect: "if_required"
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed.");
      setSubmitting(false);
      return;
    }

    router.push(`/portal/events/${eventId}`);
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <GlassCard>
        <PaymentElement />
      </GlassCard>
      {error && <p className="text-sm text-status-declined">{error}</p>}
      <NeonButton color="gold" onClick={handlePay} disabled={!stripe || submitting} className="w-full">
        {submitting ? "Processing..." : "Pay Now"}
      </NeonButton>
    </div>
  );
}
