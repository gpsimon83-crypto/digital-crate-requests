"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { createClient, setRememberPreference } from "@/lib/supabase/client";
import { Logo } from "@/components/site/logo";

export default function PortalLoginPage() {
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
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    setRememberPreference(rememberMe);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    router.push(searchParams.get("next") ?? "/portal");
    router.refresh();
  }

  return (
    <div className="auth-page">
      <div className="auth-card-wrap">
        <div className="auth-card">
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            <Logo variant="icon" brand="crates-djs" size={48} />
            <div>
              <h1 className="font-display text-3xl font-light text-foreground">Welcome Back</h1>
              <p className="mt-1 text-xs text-muted">Sign in to manage your event</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                Email Address
              </span>
              <div className="auth-input-wrap">
                <Mail size={16} />
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                />
              </div>
            </label>

            <label className="block">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Password</span>
                <Link href="/auth/forgot-password" className="text-[11px] text-gold hover:text-gold-light">
                  Forgot password?
                </Link>
              </div>
              <div className="auth-input-wrap">
                <Lock size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="auth-eye-btn"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className="flex items-center gap-2 text-[11px] text-muted">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-black/20 bg-transparent accent-gold"
              />
              Remember me
            </label>

            {error && <p className="text-xs text-status-declined">{error}</p>}

            <button type="submit" disabled={submitting} className="auth-submit mt-1">
              {submitting ? "Signing in..." : "Sign In"}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-muted">
            Booked an event but no account yet?{" "}
            <Link href="/portal/signup" className="text-gold hover:text-gold-light">
              Create one
            </Link>
          </p>
          <p className="mt-2 text-center text-[11px] text-muted">
            <Link href="/" className="hover:text-foreground">
              Back to cratesdjs.com
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
