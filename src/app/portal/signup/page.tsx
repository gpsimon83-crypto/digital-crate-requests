"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { Logo } from "@/components/site/logo";

export default function PortalSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    if (!data.session) {
      setNeedsConfirmation(true);
      setSubmitting(false);
      return;
    }

    router.push("/portal");
    router.refresh();
  }

  if (needsConfirmation) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-bold">Check your email</h1>
        <p className="text-sm text-muted">
          We sent a confirmation link to {email}. Confirm it, then{" "}
          <Link href="/portal/login" className="text-gold">sign in</Link> to reach your event.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo variant="icon" brand="crates-djs" size={44} />
        <div>
          <h1 className="text-xl font-bold">Create your account</h1>
          <p className="mt-1 text-xs text-muted">Use the same email you booked with — we&rsquo;ll connect it to your event.</p>
        </div>
      </div>

      <GlassCard neon>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </label>

          {error && <p className="text-xs text-status-declined">{error}</p>}

          <NeonButton color="gold" type="submit" disabled={submitting} className="w-full">
            {submitting ? "Creating account..." : "Create account"}
          </NeonButton>
        </form>
      </GlassCard>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link href="/portal/login" className="text-gold">Sign in</Link>
      </p>
    </div>
  );
}
