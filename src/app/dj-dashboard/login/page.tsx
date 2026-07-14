"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="gl-page">
      <div className="gl-grain" />
      <div className="gl-glow" style={{ top: "-10%", left: "50%", transform: "translateX(-50%)" }} />

      <div className="gl-card-wrap">
        <div className="gl-card">
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            <Logo variant="full" color="gold" size={44} />
            <div>
              <h1 className="text-xl font-bold text-white">Welcome Back</h1>
              <p className="mt-1 text-xs text-[#9299A3]">Sign in to manage your bookings and events</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#8a8f98]">
                Email Address
              </span>
              <div className="gl-input-wrap">
                <Mail size={16} />
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="gl-input"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#8a8f98]">
                Password
              </span>
              <div className="gl-input-wrap">
                <Lock size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="gl-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="gl-eye-btn"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {error && <p className="text-xs text-status-declined">{error}</p>}

            <button type="submit" disabled={submitting} className="gl-submit mt-1">
              {submitting ? "Signing in..." : "Sign In"}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-[#6b7078]">
            Don&apos;t have login credentials yet? Ask your Digital Crate DJs admin to set them up.
          </p>
        </div>
      </div>
    </div>
  );
}
