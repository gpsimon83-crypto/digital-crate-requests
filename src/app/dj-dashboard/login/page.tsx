"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { Logo } from "@/components/site/logo";
import { createClient } from "@/lib/supabase/client";

export default function DjLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "admin_only" ? "That page requires an admin account." : null
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    const next = searchParams.get("next") || "/dj-dashboard/bookings";
    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <GlassCard neon className="w-full max-w-sm flex-col gap-5 p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo variant="icon" color="white" size={32} />
          <p className="text-sm font-semibold">DJ Login</p>
          <p className="text-xs text-muted">Sign in to manage your bookings and events.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          {error && <p className="text-xs text-status-declined">{error}</p>}
          <NeonButton type="submit" color="gold" disabled={submitting} className="mt-1 w-full">
            {submitting ? "Signing in..." : "Sign In"}
          </NeonButton>
        </form>

        <p className="text-center text-[11px] text-muted">
          Don&apos;t have login credentials yet? Ask your Digital Crate DJs admin to set them up.
        </p>
      </GlassCard>
    </div>
  );
}
